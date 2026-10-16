use phase_exit_core::{*,lifecycle, schema};
use serde_json::{json, Value};
use std::{collections::BTreeMap, path::PathBuf};
struct Args { command: String, subcommand: Option<String>, flags: BTreeMap<String,String> }
impl Args {
    fn parse() -> Result<Self> {
        let args:Vec<_> = std::env::args().skip(1).collect();
        let command = args.first().cloned().ok_or_else(||Error::Invalid("usage: phase-exit COMMAND [SUBCOMMAND] --option VALUE".into()))?;
        let subcommand = args.get(1).filter(|s|!s.starts_with("--")).cloned();
        let mut flags = BTreeMap::new(); let start = if subcommand.is_some() {2} else {1};
        let rest = &args[start..]; require(rest.len() % 2 == 0,"every option requires a value")?;
        for pair in rest.chunks_exact(2) { require(pair[0].starts_with("--") && flags.insert(pair[0].clone(),pair[1].clone()).is_none(),"invalid or duplicate option")?; }
        Ok(Self {command,subcommand,flags})
    }
    fn required(&self,name:&str)->Result<&str> { self.flags.get(name).map(String::as_str).ok_or_else(||Error::Invalid(format!("missing {name}"))) }
    fn allow(&self,names:&[&str])->Result<()> { require(self.flags.keys().all(|k|names.contains(&k.as_str())),"unknown option") }
    fn store(&self)->Result<Store> { Store::open(self.required("--state-dir")?) }
    fn load(&self,flag:&str,kind:&str)->Result<Value> { let value:Value=read_json(self.required(flag)?)?; schema::validate(kind,&value)?; Ok(value) }
    fn contract(&self)->Result<Contract> { Ok(serde_json::from_value(self.load("--contract","contract")?)?) }
    fn evidence(&self)->Result<Evidence> { Ok(serde_json::from_value(self.load("--evidence","evidence")?)?) }
    fn options(&self)->EvaluationOptions { EvaluationOptions {jev_fixture:self.flags.get("--jev-fixture").map(PathBuf::from)} }
}
fn run()->Result<(Value,i32)> {
    let args=Args::parse()?;
    let result=match (args.command.as_str(),args.subcommand.as_deref()) {
        ("--version",None)=>{args.allow(&[])?;json!({"name":"phase-exit","version":env!("CARGO_PKG_VERSION")})},
        ("digest",None)=>{args.allow(&["--file"])?;let value:Value=read_json(args.required("--file")?)?;json!({"schema_version":1,"sha256":digest(&value)?})},
        ("contract",Some("inspect"))=>{args.allow(&["--contract"])?;let contract=args.contract()?;json!({"schema_version":1,"contract_digest":digest(&contract)?,"summary":lifecycle::contract_summary(&contract),"contract":contract})},
        ("contract",Some("import"))=>{args.allow(&["--contract","--state-dir"])?;lifecycle::import_contract(&args.store()?,&args.contract()?)?},
        ("contract",Some("freeze"))=>{args.allow(&["--contract","--state-dir","--reviewer","--rationale"])?;lifecycle::freeze(&args.store()?,&args.contract()?,args.required("--reviewer")?.into(),args.required("--rationale")?.into())?},
        ("contract",Some("adopt"))=>{args.allow(&["--contract","--adoption","--state-dir"])?;let adoption:Adoption=serde_json::from_value(args.load("--adoption","adoption")?)?;lifecycle::adopt(&args.store()?,&args.contract()?,&adoption)?},
        ("contract",Some("compare"))=>{args.allow(&["--contract","--other"])?;let old=args.contract()?;let new:Contract=serde_json::from_value(args.load("--other","contract")?)?;lifecycle::compare(&old,&new)?},
        ("contract",Some("propose-revision"))=>{args.allow(&["--contract","--other","--state-dir"])?;let new:Contract=serde_json::from_value(args.load("--other","contract")?)?;lifecycle::propose(&args.store()?,&args.contract()?,&new)?},
        ("evidence",Some("import"))=>{args.allow(&["--contract","--evidence","--state-dir"])?;let contract=args.contract()?;let evidence=args.evidence()?;lifecycle::import_evidence(&args.store()?,&contract,&evidence)?;json!({"schema_version":1,"contract_digest":digest(&contract)?,"evidence_digest":digest(&evidence)?,"imported_records":evidence.records.len()})},
        ("evaluate",None)=>{args.allow(&["--contract","--evidence","--stage","--state-dir","--jev-fixture"])?;let decision=evaluate(&args.store()?,&args.contract()?,&args.evidence()?,args.required("--stage")?,&args.options())?;let code=decision.verdict.exit_code();return Ok((serde_json::to_value(decision)?,code));},
        ("action",Some("authorize"))=>{args.allow(&["--contract","--evidence","--request","--state-dir","--jev-fixture"])?;let request:ActionRequest=serde_json::from_value(args.load("--request","action")?)?;let authorization=authorize(&args.store()?,&args.contract()?,&args.evidence()?,&request,&args.options())?;let code=if authorization.authorized {0}else{12};return Ok((serde_json::to_value(authorization)?,code));},
        ("learn",Some("record"))=>{args.allow(&["--learning","--state-dir"])?;let learning:Learning=serde_json::from_value(args.load("--learning","learning")?)?;lifecycle::record_learning(&args.store()?,&learning)?},
        ("status",None)=>{args.allow(&["--state-dir"])?;let store=args.store()?;let head=lifecycle::active_adoption(&store)?;let decisions=store.list("decisions")?.iter().map(read_json::<Decision>).collect::<Result<Vec<_>>>()?;json!({"schema_version":1,"active_adoption":head,"decisions":decisions})},
        ("explain",None)=>{args.allow(&["--decision"])?;args.load("--decision","decision")?},
        ("schema",Some("export"))=>{args.allow(&["--kind"])?;schema::export(args.required("--kind")?)?},
        ("schema",Some("validate"))=>{args.allow(&["--kind","--file"])?;let kind=args.required("--kind")?;let value:Value=read_json(args.required("--file")?)?;schema::validate(kind,&value)?;json!({"schema_version":1,"valid":true,"kind":kind})},
        _=>return Err(Error::Invalid("unknown command; see docs/rust-interface.md".into())),
    };Ok((result,0))
}
fn main() {
    let (mut output,code)=match run() {Ok(result)=>result,Err(error)=>{
        let reason=Reason {code:match &error {Error::Hook(_)=>"HOOK_BLOCKED",_=>"INVALID_INPUT"}.into(),criterion_id:None,message:error.to_string()};
        let context=Args::parse().ok();
        let readable=context.as_ref().and_then(|a|a.flags.get("--contract")).and_then(|p|read_json::<Contract>(p).ok());
        let contract_digest=readable.as_ref().and_then(|c|digest(c).ok()).unwrap_or_else(||"0".repeat(64));
        let evaluated_stage=context.as_ref().and_then(|a|a.flags.get("--stage")).cloned().or_else(||{
            let request=context.as_ref().and_then(|a|a.flags.get("--request")).and_then(|p|read_json::<ActionRequest>(p).ok())?;
            readable.as_ref()?.actions.iter().find(|a|a.id==request.action_id).map(|a|a.stage.clone())
        }).unwrap_or_else(||"unknown".into());
        let mut decision=Decision {schema_version:1,decision_id:String::new(),contract_digest,evaluated_stage,verdict:Verdict::Invalid,stage_complete:false,phase_complete:false,unmet_criteria:vec![],evidence_refs:vec![],reasons:vec![reason],next_authorized_action:None};
        decision.decision_id=digest(&decision).unwrap_or_else(|_|"0".repeat(64));
        if let Some(store)=context.as_ref().and_then(|a|a.store().ok()) { let _=store.put_named("decisions",&decision.decision_id,&decision); }
        (json!(decision),14)
    }};
    phase_exit_core::hooks::redact(&mut output);
    match serde_json::to_string(&output) {Ok(line)=>println!("{line}"),Err(_)=>{eprintln!("JSON output serialization failed");std::process::exit(14)}};
    std::process::exit(code);
}
