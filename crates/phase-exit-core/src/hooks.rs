//! Mandatory bridge to the Node extension runtime. Hooks only veto or propose.
use crate::{*, store::{bounded_read, immutable, bytes_hash}};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs::{self, File}, process::{Command, Stdio}, time::{Duration, Instant}};
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct HookResult { schema_version: u32, event: String, blocked: bool, results: Vec<ModuleResult>, evidence_proposals: Vec<Value>, amendment_proposals: Vec<Value> }
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct ModuleResult { id: String, status: String, required: bool, message: String }
pub fn redact(value: &mut Value) {
    match value {
        Value::Object(map) => { for (key, val) in map { let key = key.to_ascii_lowercase(); if ["api_key","apikey","authorization","password","secret","token"].iter().any(|part| key.contains(part)) { *val = Value::String("[REDACTED]".into()); } else { redact(val); } } },
        Value::Array(values) => { for v in values { redact(v); } },
        Value::String(text) => { if let Ok(key) = std::env::var("JEV_API_KEY") { if !key.is_empty() { *text = text.replace(&key,"[REDACTED]"); } } },
        _ => {},
    }
}
pub fn run(store: &Store, contract: &Contract, event: &str, mut payload: Value) -> Result<()> {
    if std::env::var_os("PHASE_EXIT_HOOK_ACTIVE").is_some() { return Err(Error::Hook("recursive hook invocation rejected".into())); }
    let Some(config) = &contract.hooks else { return Ok(()); };
    let runner = std::env::var("PHASE_EXIT_HOOK_RUNNER").map_err(|_| Error::Hook("configured contract needs PHASE_EXIT_HOOK_RUNNER".into()))?;
    absolute(&runner)?;
    let config_bytes = bounded_read(std::path::Path::new(&config.config_path), 1024 * 1024)?;
    require(bytes_hash(&config_bytes) == config.config_sha256,"hook config changed")?;
    let config_path = store.root.join("hook-configs").join(format!("{}.json",config.config_sha256)); immutable(&config_path,&config_bytes)?;
    redact(&mut payload);
    let stamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|_| Error::Hook("clock invalid".into()))?.as_nanos();
    let invocation_id = format!("{}-{stamp}",std::process::id());
    let config_base_dir = std::path::Path::new(&config.config_path).parent().ok_or_else(||Error::Hook("config path has no parent".into()))?;
    let context = json!({"schema_version":1,"config_path":config_path,"config_base_dir":config_base_dir,"config_sha256":config.config_sha256,"state_dir":store.root,"invocation_id":invocation_id,"payload":payload});
    let context_path = store.root.join("hook-contexts").join(format!("{invocation_id}.json")); immutable(&context_path,&serde_json::to_vec(&context)?)?;
    let output_path = store.root.join("hook-contexts").join(format!("{invocation_id}.stdout"));
    let mut command = Command::new("node"); command.arg(&runner).arg(event).arg(&context_path).env_clear();
    for name in ["PATH","HOME","TMPDIR","TEMP","SystemRoot","USERPROFILE"] { if let Some(value) = std::env::var_os(name) { command.env(name,value); } }
    command.stdin(Stdio::null()).stdout(Stdio::from(File::create(&output_path)?)).stderr(Stdio::null());
    let mut child = command.spawn().map_err(|_| Error::Hook("Node hook runner could not start".into()))?;
    let started = Instant::now();
    let status = loop {
        if let Some(status) = child.try_wait()? { break status; }
        if started.elapsed() > Duration::from_secs(60) || fs::metadata(&output_path)?.len() > 1024 * 1024 { let _ = child.kill(); let _ = child.wait(); return Err(Error::Hook("runner timeout or output limit".into())); }
        std::thread::sleep(Duration::from_millis(20));
    };
    if !status.success() { return Err(Error::Hook("runner failed; certification blocked".into())); }
    let result: HookResult = serde_json::from_slice(&bounded_read(&output_path,1024*1024)?).map_err(|_| Error::Hook("invalid hook result protocol".into()))?;
    version(result.schema_version)?; require(result.event == event,"hook event mismatch")?;
    let mut receipt = serde_json::to_value(&result)?; redact(&mut receipt); store.put("hook-receipts",&json!({"invocation_id":invocation_id,"result":receipt}))?;
    require(result.results.iter().all(|r| ["ok","veto","failed"].contains(&r.status.as_str())),"unknown hook result status")?;
    if result.blocked || result.results.iter().any(|r| r.status == "veto" || (r.required && r.status == "failed")) { return Err(Error::Hook("extension veto or required extension failure".into())); }
    Ok(())
}
