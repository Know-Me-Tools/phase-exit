//! Contract review/adoption, evidence history, and amendment invalidation.
use crate::{*, types::*, store::read_json};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet};

pub fn validate_contract(contract: &Contract) -> Result<()> {
    version(contract.schema_version)?; valid_id(&contract.id)?;
    valid_id(&contract.project)?; valid_id(&contract.phase)?;
    require((1..=3).contains(&contract.retry_limits.max_attempts) && (1..=90).contains(&contract.retry_limits.max_elapsed_seconds), "retry bounds exceed supported policy")?;
    require(contract.jev.model == "jev-1.14.0" && !contract.jev.rubric_version.is_empty() && contract.jev.support_threshold.is_finite() && (0.95..=1.0).contains(&contract.jev.support_threshold) && contract.jev.contradiction_threshold.is_finite() && (0.0..=0.05).contains(&contract.jev.contradiction_threshold), "JEV policy must pin model and preserve minimum thresholds")?;
    require(contract.revision > 0, "revision must be positive")?;
    if let Some(parent) = &contract.parent_digest { valid_hash(parent)?; }
    require(!contract.identity.is_empty() && contract.identity.iter().all(|(k,v)| !k.trim().is_empty() && !v.trim().is_empty()), "identity must contain exact nonempty bindings")?;
    require(!contract.sources.is_empty() && !contract.stages.is_empty() && !contract.criteria.is_empty(), "sources, stages and criteria must not be empty")?;
    let mut sources = BTreeSet::new();
    for source in &contract.sources { valid_id(&source.id)?; require(sources.insert(source.id.clone()), "duplicate source ID")?; absolute(&source.path)?; valid_hash(&source.sha256)?; require(file_hash(&source.path)? == source.sha256, format!("source {} hash changed", source.id))?; }
    let stages: BTreeMap<_,_> = contract.stages.iter().map(|s| (s.id.as_str(), s)).collect();
    require(stages.len() == contract.stages.len(), "duplicate stage ID")?;
    for stage in &contract.stages {
        valid_id(&stage.id)?;
        require(contract.criteria.iter().any(|c| c.stage == stage.id), "every stage must have criteria")?;
        let mut unique = BTreeSet::new();
        for dep in &stage.depends_on { require(stages.contains_key(dep.as_str()) && dep != &stage.id && unique.insert(dep), "invalid or duplicate stage dependency")?; }
    }
    let mut done = BTreeSet::new();
    loop { let before = done.len(); for s in &contract.stages { if s.depends_on.iter().all(|d| done.contains(d)) { done.insert(s.id.clone()); } } if done.len() == before { break; } }
    require(done.len() == stages.len(), "stage dependency cycle")?;
    let mut criteria = BTreeSet::new(); let mut actions = BTreeSet::new();
    for action in &contract.actions {
        valid_id(&action.id)?; require(actions.insert(action.id.clone()), "duplicate action ID")?; absolute(&action.executable)?; absolute(&action.cwd)?;
        require(stages.get(action.stage.as_str()).is_some_and(|s| matches!((&s.kind,&action.kind), (StageKind::Implementation,ActionKind::Implementation) | (StageKind::Gate,ActionKind::Gate) | (StageKind::Publication,ActionKind::Publication)) || action.kind == ActionKind::Repair), "action stage/kind mismatch")?;
        require((action.kind == ActionKind::Repair) == !action.repairs_criteria.is_empty() && action.repairs_criteria.iter().all(|id| contract.criteria.iter().any(|c| &c.id == id)), "repair actions must identify existing affected criteria")?;
        let mut coverage = BTreeSet::new();
        for id in &action.covers_criteria {
            require(coverage.insert(id), "duplicate action coverage criterion")?;
            require(contract.criteria.iter().any(|c| &c.id == id && c.stage == action.stage && match &c.predicate { Predicate::CommandSuccess { action_id } => action_id == &action.id, _ => true }), "action coverage must name its own same-stage criteria; command action ID is authoritative")?;
        }
        require(action.kind != ActionKind::Repair || action.covers_criteria.is_empty(), "repair scope belongs in repairs_criteria, not collection coverage")?;
    }
    for criterion in &contract.criteria {
        valid_id(&criterion.id)?; require(criteria.insert(criterion.id.clone()), "duplicate criterion ID")?;
        require(stages.contains_key(criterion.stage.as_str()) && sources.contains(&criterion.source_id) && !criterion.description.trim().is_empty() && !criterion.expected_outcome.trim().is_empty(), "criterion stage/source/description/outcome invalid")?;
        require(criterion.depends_on.iter().all(|id| id != &criterion.id && contract.criteria.iter().any(|c| &c.id == id)), "criterion dependency missing or self-referential")?;
        match &criterion.predicate {
            Predicate::FileSha256 { sha256 } => valid_hash(sha256)?,
            Predicate::JsonEquals { pointer, .. } | Predicate::ExternalReady { pointer } | Predicate::Semantic { pointer, .. } => { require(pointer.is_empty() || pointer.starts_with('/'), "invalid JSON pointer")?; },
            Predicate::CommandSuccess { action_id } => require(contract.actions.iter().any(|a| &a.id == action_id && a.stage == criterion.stage), "command predicate must name action in same stage")?,
        }
        if let Predicate::Semantic { question, .. } = &criterion.predicate { require(!question.trim().is_empty(), "semantic question must be explicit")?; }
        if stages.get(criterion.stage.as_str()).is_some_and(|s| s.kind == StageKind::Implementation) {
            require(!matches!(criterion.predicate, Predicate::Semantic { .. } | Predicate::CommandSuccess { .. }), "implementation boundary requires deterministic artifact facts, never gate execution or model inference")?;
        }
    }
    require(contract.stages.iter().any(|s| s.kind == StageKind::Implementation), "contract requires an explicit implementation boundary")?;
    let expected_boundary: BTreeSet<_> = contract.stages.iter().filter(|s| s.kind == StageKind::Implementation).map(|s| s.id.clone()).collect();
    let declared_boundary: BTreeSet<_> = contract.boundary.implementation_stages.iter().cloned().collect();
    require(expected_boundary == declared_boundary && declared_boundary.len() == contract.boundary.implementation_stages.len(), "boundary must list exactly all implementation stages")?;
    require(contract.prerequisites.iter().all(|id| criteria.contains(id)), "unknown prerequisite criterion")?;
    for conflict in &contract.conflicts {
        valid_id(&conflict.id)?;
        require(!conflict.criterion_ids.is_empty() && conflict.criterion_ids.iter().all(|id| criteria.contains(id)) && sources.contains(&conflict.source_id), "conflict references unknown criterion or source")?;
        require(conflict.resolution.as_ref().is_some_and(|r| !r.trim().is_empty()), "unresolved contradictory requirements must be resolved before use")?;
    }
    let mut criterion_done = BTreeSet::new();
    loop { let before = criterion_done.len(); for c in &contract.criteria { if c.depends_on.iter().all(|id| criterion_done.contains(id)) { criterion_done.insert(c.id.clone()); } } if before == criterion_done.len() { break; } }
    require(criterion_done.len() == contract.criteria.len(), "criterion dependency cycle")?;
    if let Some(hooks) = &contract.hooks { absolute(&hooks.config_path)?; valid_hash(&hooks.config_sha256)?; require(file_hash(&hooks.config_path)? == hooks.config_sha256, "hook config hash mismatch")?; }
    Ok(())
}

pub fn import_contract(store: &Store, contract: &Contract) -> Result<Value> {
    validate_contract(contract)?; let hash = store.put("contracts", contract)?;
    crate::hooks::run(store, contract, "contract.collected", json!({"contract":contract}))?;
    Ok(json!({"schema_version":1,"contract_digest":hash,"status":"draft"}))
}
pub fn freeze(store: &Store, contract: &Contract, reviewer: String, rationale: String) -> Result<Value> {
    validate_contract(contract)?; require(!reviewer.trim().is_empty() && !rationale.trim().is_empty(), "review needs reviewer and rationale")?;
    let hash = digest(contract)?; require(store.exists("contracts", &hash)?, "import contract before review")?;
    let roles: BTreeSet<_> = contract.sources.iter().map(|s| s.role.clone()).collect();
    require([SourceRole::Assessment,SourceRole::Analysis,SourceRole::Specification,SourceRole::Plan].iter().all(|r|roles.contains(r)), "review requires assessment, analysis, specification and plan sources")?;
    crate::hooks::run(store, contract, "contract.frozen", json!({"contract":contract}))?;
    let review = Review { schema_version:1, contract_digest:hash.clone(), reviewer, rationale }; let review_digest = store.put("reviews", &review)?;
    Ok(json!({"schema_version":1,"contract_digest":hash,"review_digest":review_digest,"status":"reviewed"}))
}
pub fn active_adoption(store: &Store) -> Result<Option<Adoption>> {
    let mut head: Option<Adoption> = None;
    for path in store.list("adoptions")? {
        let item: Adoption = read_json(path)?; version(item.schema_version)?;
        require(item.previous_contract_digest == head.as_ref().map(|a| a.contract_digest.clone()), "adoption chain is broken")?;
        let contract: Contract = store.get("contracts", &item.contract_digest)?;
        require(digest(&contract)? == item.contract_digest, "adopted contract snapshot changed")?;
        let review: Review = store.get("reviews", &item.review_digest)?;
        require(digest(&review)? == item.review_digest && review.contract_digest == item.contract_digest, "adoption review snapshot changed")?;
        head = Some(item);
    }
    Ok(head)
}
pub fn require_active(store: &Store, contract: &Contract) -> Result<()> {
    let hash = digest(contract)?;
    require(active_adoption(store)?.is_some_and(|a| a.contract_digest == hash), "contract is not the active adopted revision")
}
/// Render a readable summary from the exact structured contract, without inference.
pub fn contract_summary(contract: &Contract) -> String {
    let mut lines = vec![
        format!("Contract {} revision {} — project {}, phase {}",contract.id,contract.revision,contract.project,contract.phase),
        format!("Inventory: {} stages, {} criteria, {} actions, {} sources, {} recorded conflicts",contract.stages.len(),contract.criteria.len(),contract.actions.len(),contract.sources.len(),contract.conflicts.len()),
        format!("Implementation boundary: {}",contract.boundary.implementation_stages.join(", ")),
        format!("Prerequisites: {}",if contract.prerequisites.is_empty() { "none".into() } else { contract.prerequisites.join(", ") }),
        format!("Exclusions: {}",if contract.exclusions.is_empty() { "none".into() } else { contract.exclusions.join("; ") }),
        format!("JEV: {}; rubric {}; support >= {}; contradiction <= {}",contract.jev.model,contract.jev.rubric_version,contract.jev.support_threshold,contract.jev.contradiction_threshold),
        format!("Retry limits: {} attempts, {} elapsed seconds",contract.retry_limits.max_attempts,contract.retry_limits.max_elapsed_seconds),
        match &contract.hooks { Some(hooks) => format!("Hooks: {} (SHA-256 {})",hooks.config_path,hooks.config_sha256),None => "Hooks: none".into() },
    ];
    for stage in &contract.stages {
        let kind = match stage.kind { StageKind::Implementation => "implementation",StageKind::Gate => "gate",StageKind::Publication => "publication" };
        lines.push(format!("Stage {} [{}], depends on: {}",stage.id,kind,if stage.depends_on.is_empty() { "none".into() } else { stage.depends_on.join(", ") }));
        for criterion in contract.criteria.iter().filter(|c|c.stage == stage.id) {
            lines.push(format!("  Criterion {}: {}",criterion.id,criterion.description));
            lines.push(format!("    Expected outcome: {}; source: {}; depends on: {}",criterion.expected_outcome,criterion.source_id,if criterion.depends_on.is_empty() { "none".into() } else { criterion.depends_on.join(", ") }));
        }
    }
    lines.join("\n")
}

/// Describe direct structured changes alongside their transitive invalidation set.
pub fn compare(old: &Contract, new: &Contract) -> Result<Value> {
    let mut changes = Vec::new();
    let mut summary = vec![format!("Contract {} revision {} -> {} revision {}; criteria {} -> {}",old.id,old.revision,new.id,new.revision,old.criteria.len(),new.criteria.len())];
    let ids: BTreeSet<_> = old.criteria.iter().chain(new.criteria.iter()).map(|c|c.id.as_str()).collect();
    for id in ids {
        let before = old.criteria.iter().find(|c|c.id == id);
        let after = new.criteria.iter().find(|c|c.id == id);
        if before != after {
            let change = match (before,after) { (None,Some(_)) => "added",(Some(_),None) => "removed",_ => "changed" };
            changes.push(json!({"kind":"criterion","id":id,"change":change,"old":before,"new":after}));
            summary.push(format!("Criterion {id} ({change})\n- {}\n+ {}",serde_json::to_string(&before)?,serde_json::to_string(&after)?));
        }
    }
    let before = serde_json::to_value(old)?;
    let after = serde_json::to_value(new)?;
    if let Some(fields) = before.as_object() {
        for (field,value) in fields {
            if field != "criteria" && after.get(field) != Some(value) {
                let replacement = after.get(field).cloned().unwrap_or(Value::Null);
                changes.push(json!({"kind":"contract_field","field":field,"old":value,"new":replacement}));
                summary.push(format!("Contract field {field}\n- {}\n+ {}",serde_json::to_string(value)?,serde_json::to_string(&replacement)?));
            }
        }
    }
    let invalidated_criteria = invalidated(old,new);
    if changes.is_empty() { summary.push("No structured changes.".into()); }
    summary.push(format!("Invalidated criteria: {}",if invalidated_criteria.is_empty() { "none".into() } else { invalidated_criteria.join(", ") }));
    Ok(json!({"schema_version":1,"previous_contract_digest":digest(old)?,"contract_digest":digest(new)?,"invalidated_criteria":invalidated_criteria,"changes":changes,"summary":summary.join("\n")}))
}
pub fn invalidated(old: &Contract, new: &Contract) -> Vec<String> {
    let mut changed = BTreeSet::new(); let mut stages = BTreeSet::new();
    for c in old.criteria.iter().chain(new.criteria.iter()) {
        let a = old.criteria.iter().find(|x| x.id == c.id); let b = new.criteria.iter().find(|x| x.id == c.id);
        if a != b || old.identity != new.identity || old.sources != new.sources || old.hooks != new.hooks || old.actions != new.actions || old.boundary != new.boundary || old.prerequisites != new.prerequisites || old.jev != new.jev || old.retry_limits != new.retry_limits || old.exclusions != new.exclusions || old.conflicts != new.conflicts {
            changed.insert(c.id.clone()); stages.insert(c.stage.clone());
        }
    }
    for s in old.stages.iter().chain(new.stages.iter()) { if old.stages.iter().find(|x| x.id == s.id) != new.stages.iter().find(|x| x.id == s.id) { stages.insert(s.id.clone()); } }
    loop { let before = stages.len(); for s in old.stages.iter().chain(new.stages.iter()) { if s.depends_on.iter().any(|d| stages.contains(d)) { stages.insert(s.id.clone()); } } if before == stages.len() { break; } }
    loop {
        let before = changed.len();
        for c in old.criteria.iter().chain(new.criteria.iter()) { if stages.contains(&c.stage) || c.depends_on.iter().any(|id| changed.contains(id)) { changed.insert(c.id.clone()); stages.insert(c.stage.clone()); } }
        for s in old.stages.iter().chain(new.stages.iter()) { if s.depends_on.iter().any(|d| stages.contains(d)) { stages.insert(s.id.clone()); } }
        if before == changed.len() { break; }
    }
    changed.into_iter().collect()
}
pub fn adopt(store: &Store, contract: &Contract, adoption: &Adoption) -> Result<Value> {
    let _lock = store.lock()?; validate_contract(contract)?; version(adoption.schema_version)?;
    let hash = digest(contract)?; require(hash == adoption.contract_digest, "adoption digest mismatch")?;
    require(!adoption.operator.trim().is_empty() && !adoption.rationale.trim().is_empty(), "adoption requires explicit operator rationale")?;
    let review: Review = store.get("reviews", &adoption.review_digest)?;
    require(digest(&review)? == adoption.review_digest && review.contract_digest == hash, "review does not bind this contract")?;
    let head = active_adoption(store)?;
    if let Some(head) = head {
        require(adoption.previous_contract_digest.as_ref() == Some(&head.contract_digest) && contract.parent_digest.as_ref() == Some(&head.contract_digest), "revision parent is not active head")?;
        let old: Contract = store.get("contracts", &head.contract_digest)?;
        require(old.id == contract.id && old.project == contract.project && old.phase == contract.phase && contract.revision == old.revision + 1, "revision identity/sequence mismatch")?;
        let required = invalidated(&old, contract);
        require(required.iter().all(|id| adoption.invalidated_criteria.contains(id)), "invalidation map omits affected criteria or dependent stages")?;
    } else { require(contract.revision == 1 && contract.parent_digest.is_none() && adoption.previous_contract_digest.is_none(), "initial adoption must be revision 1 without parent")?; }
    store.put("contracts", contract)?;
    let number = store.list("adoptions")?.len(); store.put_named("adoptions", &format!("{number:020}"), adoption)?;
    Ok(json!({"schema_version":1,"contract_digest":hash,"adoption_digest":digest(adoption)?,"status":"adopted"}))
}
pub fn propose(store: &Store, old: &Contract, new: &Contract) -> Result<Value> {
    validate_contract(old)?; validate_contract(new)?; require_active(store, old)?;
    require(new.parent_digest.as_ref() == Some(&digest(old)?) && new.id == old.id && new.revision == old.revision + 1, "proposal lineage mismatch")?;
    let mut proposal = compare(old,new)?;
    proposal["status"] = Value::String("proposed".into());
    store.put("contracts",new)?; store.put("amendments",&proposal)?;
    crate::hooks::run(store,new,"amendment.proposed",json!({"contract":new,"proposal":proposal}))?; Ok(proposal)
}
pub fn import_evidence(store: &Store, contract: &Contract, evidence: &Evidence) -> Result<()> {
    version(evidence.schema_version)?; let hash = digest(contract)?; require(evidence.contract_digest == hash, "evidence bundle contract mismatch")?;
    let mut ids = BTreeSet::new();
    for r in &evidence.records {
        valid_id(&r.id)?; valid_id(&r.criterion_id)?; absolute(&r.artifact_path)?; valid_hash(&r.artifact_sha256)?;
        require(ids.insert(r.id.clone()) && contract.criteria.iter().any(|c| c.id == r.criterion_id), "duplicate receipt ID or unknown criterion")?;
        require(r.contract_digest == hash && r.identity == contract.identity, "receipt contract/identity mismatch")?;
        valid_hash(&r.origin.config_sha256)?;
        require(!r.origin.runner.trim().is_empty() && !r.origin.platform.trim().is_empty() && r.origin.artifact_identity == contract.identity, "receipt runner/platform/artifact binding invalid")?;
        if let Some(op) = &r.operation { valid_id(&op.id)?; require(op.started_at <= r.captured_at && op.expires_at > op.started_at && contract.actions.iter().any(|a| a.id == op.action_id), "operation timing/action invalid")?; }
        require(r.captured_at <= now()? && r.expires_at.is_none_or(|e| e >= r.captured_at), "receipt time invalid")?;
        if let Some(prior) = &r.supersedes { require(prior != &r.id,"self supersession")?; let old: Receipt = store.get("evidence",prior)?; require(old.criterion_id == r.criterion_id && old.captured_at <= r.captured_at, "supersession must reference an older same-criterion receipt")?; }
        store.put_named("evidence",&r.id,r)?;
        if std::path::Path::new(&r.artifact_path).is_file() && file_hash(&r.artifact_path)? == r.artifact_sha256 {
            let bytes = crate::store::bounded_read(std::path::Path::new(&r.artifact_path),crate::store::MAX_JSON)?;
            crate::store::immutable(&store.root.join("evidence-artifacts").join(&r.artifact_sha256),&bytes)?;
        }
    }
    crate::hooks::run(store,contract,"evidence.imported",json!({"contract":contract,"evidence":evidence}))?; Ok(())
}
pub fn record_learning(store: &Store, learning: &Learning) -> Result<Value> {
    version(learning.schema_version)?; valid_id(&learning.id)?; valid_hash(&learning.contract_digest)?;
    require(!learning.summary.trim().is_empty(),"learning summary is empty")?;
    require(!learning.disposition.trim().is_empty(),"learning disposition required")?;
    let contract: Contract = store.get("contracts",&learning.contract_digest)?;
    require(digest(&contract)? == learning.contract_digest,"learning contract snapshot changed")?;
    require(learning.affected_criteria.iter().all(|id| contract.criteria.iter().any(|c| &c.id == id)),"learning references unknown affected criterion")?;
    for id in &learning.evidence_refs { let _: Receipt = store.get("evidence",id)?; }
    if let Some(id) = &learning.supersedes { let _: Learning = store.get("learning",id)?; require(id != &learning.id,"self supersession")?; }
    store.put_named("learning",&learning.id,learning)?;
    Ok(json!({"schema_version":1,"learning_digest":digest(learning)?,"scope_changed":false}))
}
