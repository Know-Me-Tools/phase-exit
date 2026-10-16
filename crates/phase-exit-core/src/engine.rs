//! Evidence predicates, dependency evaluation and exact action authorization.
use crate::{*, lifecycle::*, store::{bounded_read, bytes_hash, MAX_JSON}};
use serde_json::{json, Value};
use std::{collections::{BTreeMap, BTreeSet}, path::{Path, PathBuf}};
#[derive(Default)]
pub struct EvaluationOptions { pub jev_fixture: Option<PathBuf> }
#[derive(Clone, PartialEq, Eq)]
enum Check { Pass, Missing, Failed, External, Running, Review, Contradiction, Invalid }
struct Finding { check: Check, code: &'static str, message: String }
impl Finding { fn new(check: Check, code: &'static str, message: &str) -> Self { Self { check,code,message:message.into() } } }
fn artifact(receipt: &Receipt) -> Result<Vec<u8>> {
    let bytes = bounded_read(Path::new(&receipt.artifact_path),MAX_JSON)?;
    require(bytes_hash(&bytes) == receipt.artifact_sha256,"artifact changed since receipt")?; Ok(bytes)
}
fn command_matches(c: &CommandReceipt, a: &Action) -> bool { c.action_id == a.id && c.executable == a.executable && c.argv == a.argv && c.cwd == a.cwd }
fn inspect(contract: &Contract, criterion: &Criterion, receipt: Option<&Receipt>, time: u64) -> Finding {
    let Some(receipt) = receipt else { return if matches!(criterion.predicate,Predicate::ExternalReady { .. }) { Finding::new(Check::External,"EXTERNAL_UNAVAILABLE","Required collaborator evidence is unavailable") } else { Finding::new(Check::Missing,"MISSING_EVIDENCE","No current receipt establishes this criterion") }; };
    if receipt.expires_at.is_some_and(|expiry| expiry <= time) { return Finding::new(Check::Missing,"STALE_EVIDENCE","Receipt freshness window expired"); }
    let bytes = match artifact(receipt) { Ok(bytes) => bytes, Err(_) => return Finding::new(Check::Invalid,"ARTIFACT_BINDING_FAILED","Receipt artifact is missing, changed, or too large") };
    if let Some(operation) = &receipt.operation {
        if operation.state == OperationState::Running {
            let matching = matches!(&criterion.predicate,Predicate::CommandSuccess { action_id } if *action_id == operation.action_id);
            return if matching && operation.expires_at > time && operation.started_at <= time { Finding::new(Check::Running,"ACTIVE_OPERATION","An exact matching action is still running") } else { Finding::new(Check::Failed,"STALE_OR_MISMATCHED_OPERATION","Running receipt expired or names another action") };
        }
    }
    match &criterion.predicate {
        Predicate::FileSha256 { sha256 } => if &receipt.artifact_sha256 == sha256 { Finding::new(Check::Pass,"PASS","Exact required artifact bytes match") } else { Finding::new(Check::Failed,"EXPECTED_HASH_MISMATCH","Artifact does not match required bytes") },
        Predicate::CommandSuccess { action_id } => {
            let Ok(proof) = serde_json::from_slice::<CommandReceipt>(&bytes) else { return Finding::new(Check::Invalid,"INVALID_COMMAND_RECEIPT","Command evidence has wrong schema"); };
            let Some(action) = contract.actions.iter().find(|a| &a.id == action_id) else { return Finding::new(Check::Failed,"UNKNOWN_ACTION","Command action not found"); };
            if !command_matches(&proof,action) { return Finding::new(Check::Invalid,"COMMAND_IDENTITY_MISMATCH","Executable, argv, cwd, or action ID differs from approved action"); }
            if absolute(&proof.stdout_path).is_err() || absolute(&proof.stderr_path).is_err() || valid_hash(&proof.stdout_sha256).is_err() || valid_hash(&proof.stderr_sha256).is_err() || file_hash(&proof.stdout_path).ok().as_ref() != Some(&proof.stdout_sha256) || file_hash(&proof.stderr_path).ok().as_ref() != Some(&proof.stderr_sha256) { return Finding::new(Check::Invalid,"COMMAND_OUTPUT_HASH_MISMATCH","Command stdout/stderr bytes do not match receipt"); }
            if proof.exit_code == 0 { Finding::new(Check::Pass,"PASS","Exact approved command succeeded with bound outputs") } else { Finding::new(Check::Failed,"COMMAND_FAILED","Approved command returned a nonzero exit code") }
        },
        Predicate::JsonEquals { pointer, expected } => match serde_json::from_slice::<Value>(&bytes) {
            Err(_) => Finding::new(Check::Invalid,"MALFORMED_ARTIFACT_JSON","Evidence artifact is not valid JSON"),
            Ok(value) => match value.pointer(pointer).cloned() {
            Some(actual) if &actual == expected => Finding::new(Check::Pass,"PASS","Required JSON fact equals expected value"),
            _ => Finding::new(Check::Failed,"JSON_PREDICATE_FAILED","Required JSON fact is absent or differs from expected value"),
            },
        },
        Predicate::ExternalReady { pointer } => match serde_json::from_slice::<Value>(&bytes) {
            Err(_) => Finding::new(Check::Invalid,"MALFORMED_ARTIFACT_JSON","Evidence artifact is not valid JSON"),
            Ok(value) => match value.pointer(pointer).cloned() {
            Some(Value::Bool(true)) => Finding::new(Check::Pass,"PASS","Required collaborator readiness is evidenced"),
            _ => Finding::new(Check::External,"EXTERNAL_UNAVAILABLE","Required collaborator is unavailable or readiness is unproven"),
            },
        },
        Predicate::Semantic { .. } => Finding::new(Check::Review,"SEMANTIC_PENDING","Semantic evidence awaits pinned judgement"),
    }
}
fn stage_passes(contract: &Contract, stage: &str, findings: &BTreeMap<String,Finding>, visited: &mut BTreeSet<String>) -> bool {
    if !visited.insert(stage.to_string()) { return false; }
    let Some(s) = contract.stages.iter().find(|s| s.id == stage) else { return false; };
    let own = contract.criteria.iter().filter(|c| c.stage == stage).all(|c| criterion_passes(contract,&c.id,findings,&mut BTreeSet::new()));
    own && s.depends_on.iter().all(|dep|stage_passes(contract,dep,findings,&mut visited.clone()))
}
fn criterion_passes(contract: &Contract, id: &str, findings: &BTreeMap<String,Finding>, visited: &mut BTreeSet<String>) -> bool {
    if !visited.insert(id.into()) { return false; }
    let Some(c) = contract.criteria.iter().find(|c| c.id == id) else { return false; };
    findings.get(id).is_some_and(|f| f.check == Check::Pass) && c.depends_on.iter().all(|dep|criterion_passes(contract,dep,findings,&mut visited.clone()))
}
fn implementation_complete(contract: &Contract, findings: &BTreeMap<String,Finding>) -> bool { contract.boundary.implementation_stages.iter().all(|s|stage_passes(contract,s,findings,&mut BTreeSet::new())) }
fn eligible(contract: &Contract, action: &Action, findings: &BTreeMap<String,Finding>) -> bool {
    if action.kind == ActionKind::Repair { return action.repairs_criteria.iter().any(|id|findings.get(id).is_some_and(|f|f.check == Check::Failed)); }
    let Some(stage) = contract.stages.iter().find(|s| s.id == action.stage) else { return false; };
    if !stage.depends_on.iter().all(|dep|stage_passes(contract,dep,findings,&mut BTreeSet::new())) { return false; }
    if matches!(action.kind,ActionKind::Gate|ActionKind::Publication) && (!implementation_complete(contract,findings) || !contract.prerequisites.iter().all(|id|criterion_passes(contract,id,findings,&mut BTreeSet::new()))) { return false; }
    let affected: Vec<_> = contract.criteria.iter().filter(|c| c.stage == action.stage && match &c.predicate {
        Predicate::CommandSuccess { action_id } => action_id == &action.id,
        _ => action.covers_criteria.contains(&c.id),
    }).collect();
    // A gate runs only for missing/stale evidence. Failed evidence requires an approved repair first.
    affected.iter().any(|c| findings.get(&c.id).is_some_and(|f|f.check == Check::Missing))
        && affected.iter().all(|c|findings.get(&c.id).is_some_and(|f|matches!(f.check,Check::Pass|Check::Missing)))
        && affected.iter().all(|c|c.depends_on.iter().all(|dep|criterion_passes(contract,dep,findings,&mut BTreeSet::new())))
}
fn relevant_criteria(contract: &Contract, stage: &str) -> BTreeSet<String> {
    let mut stages = BTreeSet::from([stage.to_string()]); let mut ids = BTreeSet::new();
    if contract.stages.iter().any(|s| s.id == stage && s.kind != StageKind::Implementation) { stages.extend(contract.boundary.implementation_stages.iter().cloned()); ids.extend(contract.prerequisites.iter().cloned()); }
    loop {
        let before = (stages.len(),ids.len());
        for s in &contract.stages { if stages.contains(&s.id) { stages.extend(s.depends_on.iter().cloned()); } }
        for c in &contract.criteria { if stages.contains(&c.stage) || ids.contains(&c.id) { ids.insert(c.id.clone()); ids.extend(c.depends_on.iter().cloned()); } }
        if before == (stages.len(),ids.len()) { break; }
    } ids
}
fn failed_attempts(store: &Store, contract: &Contract, records: &[Receipt]) -> BTreeMap<String,u32> {
    let mut counts = BTreeMap::new();
    for r in records {
        if let Some(c) = contract.criteria.iter().find(|c| c.id == r.criterion_id) {
            if let Predicate::CommandSuccess { action_id } = &c.predicate {
                let path = store.root.join("evidence-artifacts").join(&r.artifact_sha256);
                if let Ok(bytes) = bounded_read(&path,MAX_JSON) { if bytes_hash(&bytes) == r.artifact_sha256 {
                    if let Ok(proof) = serde_json::from_slice::<CommandReceipt>(&bytes) { if proof.exit_code != 0 && contract.actions.iter().any(|a| &a.id == action_id && command_matches(&proof,a)) { *counts.entry(c.id.clone()).or_insert(0) += 1; } }
                } }
            }
        }
    } counts
}
fn blank(contract: &Contract, stage: &str) -> Result<Decision> { Ok(Decision { schema_version:1,decision_id:String::new(),contract_digest:digest(contract)?,evaluated_stage:stage.into(),verdict:Verdict::Invalid,stage_complete:false,phase_complete:false,unmet_criteria:Vec::new(),evidence_refs:Vec::new(),reasons:Vec::new(),next_authorized_action:None }) }
fn finalize(store: &Store, contract: &Contract, mut decision: Decision) -> Result<Decision> {
    if let Err(error) = crate::hooks::run(store,contract,"decision.finalized",json!({"contract":contract,"decision":decision})) {
        decision.verdict = Verdict::Blocked; decision.stage_complete = false; decision.phase_complete = false; decision.next_authorized_action = None;
        decision.reasons.push(Reason { code:"HOOK_BLOCKED".into(),criterion_id:None,message:error.to_string() });
    }
    decision.decision_id = digest(&decision)?; store.put_named("decisions",&decision.decision_id,&decision)?; Ok(decision)
}
pub fn evaluate(store: &Store, contract: &Contract, evidence: &Evidence, stage: &str, options: &EvaluationOptions) -> Result<Decision> {
    if std::env::var_os("PHASE_EXIT_HOOK_ACTIVE").is_some() { return Err(Error::Hook("recursive evaluation rejected".into())); }
    validate_contract(contract)?; require_active(store,contract)?; require(contract.stages.iter().any(|s|s.id == stage),"unknown evaluated stage")?;
    let mut decision = blank(contract,stage)?;
    let hooks = import_evidence(store,contract,evidence).and_then(|_|crate::hooks::run(store,contract,"evaluation.before",json!({"contract":contract,"stage":stage,"evidence":evidence})));
    if let Err(error) = hooks {
        if !matches!(error,Error::Hook(_)) { return Err(error); }
        decision.verdict = Verdict::Blocked; decision.reasons.push(Reason { code:"HOOK_BLOCKED".into(),criterion_id:None,message:error.to_string() }); return finalize(store,contract,decision);
    }
    let hash = digest(contract)?;
    let mut records = Vec::new();
    for path in store.list("evidence")? { let r: Receipt = read_json(path)?; if r.contract_digest == hash { require(r.identity == contract.identity && r.origin.artifact_identity == contract.identity,"stored receipt identity changed")?; records.push(r); } }
    let superseded: BTreeSet<_> = records.iter().filter_map(|r|r.supersedes.clone()).collect();
    let mut current = BTreeMap::new();
    for r in &records { if !superseded.contains(&r.id) { require(current.insert(r.criterion_id.clone(),r).is_none(),"multiple unsuperseded receipts for a criterion; explicit supersession required")?; } }
    let time = now()?; let mut findings = BTreeMap::new();
    for c in &contract.criteria { findings.insert(c.id.clone(),inspect(contract,c,current.get(&c.id).copied(),time)); }
    let relevant = relevant_criteria(contract,stage);
    // Call inference only after all deterministic implementation facts and criterion prerequisites hold.
    for _round in 0..contract.criteria.len() {
    let mut progressed = false;
    for c in &contract.criteria {
        if !matches!(c.predicate,Predicate::Semantic { .. }) || !findings.get(&c.id).is_some_and(|f|f.code == "SEMANTIC_PENDING") { continue; }
        let semantic_scope = relevant_criteria(contract,&c.stage);
        let deterministic_ready = contract.criteria.iter().filter(|other|semantic_scope.contains(&other.id) && !matches!(other.predicate,Predicate::Semantic { .. })).all(|other|findings.get(&other.id).is_some_and(|f|f.check == Check::Pass));
        let stage_dependencies_ready = contract.stages.iter().find(|s|s.id==c.stage).is_some_and(|s|s.depends_on.iter().all(|dep|stage_passes(contract,dep,&findings,&mut BTreeSet::new())));
        if !implementation_complete(contract,&findings) || !deterministic_ready || !stage_dependencies_ready || !c.depends_on.iter().all(|id|criterion_passes(contract,id,&findings,&mut BTreeSet::new())) { continue; }
        let Some(receipt) = current.get(&c.id) else { continue; };
        let bytes = artifact(receipt)?; let value: Value = serde_json::from_slice(&bytes)?;
        let Predicate::Semantic { pointer, .. } = &c.predicate else { continue; };
        let Some(statement) = value.pointer(pointer) else { findings.insert(c.id.clone(),Finding::new(Check::Failed,"SEMANTIC_FACT_MISSING","Semantic evidence JSON pointer is absent")); continue; };
        let judgement = crate::jev::judge(store,contract,c,receipt,statement,options.jev_fixture.as_deref());
        let result = match judgement {
            Ok(j) if j.contradiction >= 0.95 => Finding::new(Check::Contradiction,"SEMANTIC_CONTRADICTION","Pinned judge confidently contradicts required outcome"),
            Ok(j) if !j.live && j.support >= contract.jev.support_threshold && j.contradiction <= contract.jev.contradiction_threshold => Finding::new(Check::Review,"FIXTURE_NOT_AUTHORITY","Controlled transport is never live completion authority"),
            Ok(j) if j.support >= contract.jev.support_threshold && j.contradiction <= contract.jev.contradiction_threshold => Finding::new(Check::Pass,"PASS","Pinned semantic support and contradiction thresholds passed"),
            Ok(_) => Finding::new(Check::Review,"SEMANTIC_UNCERTAIN","Semantic probabilities do not establish required confidence"),
            Err(Error::Hook(_)) => Finding::new(Check::External,"HOOK_BLOCKED","Judgement hook vetoed certification"),
            Err(error) => Finding { check:Check::Review,code:"JEV_UNAVAILABLE",message:error.to_string() },
        }; findings.insert(c.id.clone(),result); progressed = true;
    }
    if !progressed { break; }
    }
    for finding in findings.values_mut() { if finding.code == "SEMANTIC_PENDING" { *finding = Finding::new(Check::Missing,"SEMANTIC_PREREQUISITE","Deterministic facts, stage or criterion dependency is incomplete"); } }
    let attempts = failed_attempts(store,contract,&records);
    let exhausted = relevant.iter().any(|id| attempts.get(id).is_some_and(|count|*count >= contract.retry_limits.max_attempts));
    let mut candidates: Vec<_> = contract.actions.iter().filter(|a| eligible(contract,a,&findings)).collect();
    candidates.retain(|a| a.kind != ActionKind::Repair || !a.repairs_criteria.iter().any(|id| attempts.get(id).is_some_and(|count|*count >= contract.retry_limits.max_attempts)));
    let candidate = candidates.iter().find(|a| a.stage == stage).or_else(||candidates.first()).copied();
    decision.stage_complete = stage_passes(contract,stage,&findings,&mut BTreeSet::new()) && relevant.iter().all(|id|criterion_passes(contract,id,&findings,&mut BTreeSet::new()));
    decision.phase_complete = contract.stages.iter().all(|s|stage_passes(contract,&s.id,&findings,&mut BTreeSet::new()));
    for id in &relevant {
        if let Some(r) = current.get(id) { decision.evidence_refs.push(r.id.clone()); }
        if !criterion_passes(contract,id,&findings,&mut BTreeSet::new()) {
            decision.unmet_criteria.push(id.clone());
            if let Some(f) = findings.get(id) { decision.reasons.push(Reason { code:if f.check == Check::Pass { "DEPENDENCY_INCOMPLETE".into() } else { f.code.into() },criterion_id:Some(id.clone()),message:if f.check == Check::Pass { "Criterion dependency is incomplete".into() } else { f.message.clone() } }); }
        }
    }
    for (id,finding) in &findings { if finding.check == Check::Invalid && !relevant.contains(id) { decision.unmet_criteria.push(id.clone()); decision.reasons.push(Reason {code:finding.code.into(),criterion_id:Some(id.clone()),message:finding.message.clone()}); } }
    let any = |kind:Check| relevant.iter().any(|id|findings.get(id).is_some_and(|f|f.check == kind));
    decision.verdict = if findings.values().any(|f|f.check == Check::Invalid) { decision.stage_complete=false; decision.phase_complete=false; Verdict::Invalid }
        else if decision.stage_complete { Verdict::Complete }
        else if any(Check::External) { Verdict::Blocked }
        else if exhausted { decision.reasons.push(Reason { code:"ATTEMPT_BUDGET_EXHAUSTED".into(),criterion_id:None,message:"Distinct failed runtime receipts exhaust the adopted repair budget".into() }); Verdict::ReviewRequired }
        else if any(Check::Running) { Verdict::Wait }
        else if any(Check::Review) || any(Check::Contradiction) { Verdict::ReviewRequired }
        else if any(Check::Failed) && !candidate.is_some_and(|a|a.kind == ActionKind::Repair) { Verdict::ReviewRequired }
        else if candidate.is_some() { Verdict::Continue }
        else { Verdict::ReviewRequired };
    if matches!(decision.verdict,Verdict::Continue|Verdict::Complete) && !decision.phase_complete { decision.next_authorized_action = candidate.map(|a|NextAction { id:a.id.clone(),kind:a.kind.clone() }); }
    finalize(store,contract,decision)
}
pub fn authorize(store: &Store, contract: &Contract, evidence: &Evidence, request: &ActionRequest, options: &EvaluationOptions) -> Result<Authorization> {
    if std::env::var_os("PHASE_EXIT_HOOK_ACTIVE").is_some() { return Err(Error::Hook("recursive action authorization rejected".into())); }
    version(request.schema_version)?;
    let action = contract.actions.iter().find(|a|a.id == request.action_id).ok_or_else(||Error::Invalid("action is not in adopted contract".into()))?;
    let decision = evaluate(store,contract,evidence,&action.stage,options)?;
    let exact = action.kind == request.kind && action.executable == request.executable && action.argv == request.argv && action.cwd == request.cwd;
    let authorized = exact && decision.next_authorized_action.as_ref().is_some_and(|a|a.id == action.id) && matches!(decision.verdict,Verdict::Continue|Verdict::Complete);
    let result = Authorization { schema_version:1,authorized,action_id:request.action_id.clone(),reason:if authorized { "Exact adopted action is eligible at the current boundary" } else { "Action differs from approved invocation or its boundary is closed" }.into(),decision };
    store.put("authorizations",&result)?; Ok(result)
}
