//! Strict protocol types. Unknown fields never silently change the contract.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Contract {
    pub schema_version: u32,
    pub id: String,
    pub project: String,
    pub phase: String,
    pub exclusions: Vec<String>,
    pub prerequisites: Vec<String>,
    pub boundary: Boundary,
    pub retry_limits: RetryLimits,
    pub jev: JevPolicy,
    pub revision: u64,
    pub parent_digest: Option<String>,
    pub identity: BTreeMap<String, String>,
    pub sources: Vec<Source>,
    pub conflicts: Vec<Conflict>,
    pub stages: Vec<Stage>,
    pub criteria: Vec<Criterion>,
    pub actions: Vec<Action>,
    pub hooks: Option<Hooks>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Source { pub id: String, pub role: SourceRole, pub path: String, pub sha256: String }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "snake_case")]
pub enum SourceRole { Assessment, Analysis, Specification, Plan, Evidence, Configuration }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Conflict { pub id: String, pub criterion_ids: Vec<String>, pub resolution: Option<String>, pub source_id: String }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StageKind { Implementation, Gate, Publication }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Boundary { pub implementation_stages: Vec<String> }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct RetryLimits { pub max_attempts: u32, pub max_elapsed_seconds: u64 }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct JevPolicy { pub model: String, pub rubric_version: String, pub support_threshold: f64, pub contradiction_threshold: f64 }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ActionKind { Implementation, Gate, Publication, Repair }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Stage { pub id: String, pub kind: StageKind, pub depends_on: Vec<String> }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Criterion { pub id: String, pub stage: String, pub description: String, pub source_id: String, pub depends_on: Vec<String>, pub expected_outcome: String, pub predicate: Predicate }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Predicate {
    FileSha256 { sha256: String },
    JsonEquals { pointer: String, expected: Value },
    CommandSuccess { action_id: String },
    ExternalReady { pointer: String },
    Semantic { pointer: String, question: String },
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Action { pub id: String, pub kind: ActionKind, pub stage: String, pub executable: String, pub argv: Vec<String>, pub cwd: String, pub repairs_criteria: Vec<String>, pub covers_criteria: Vec<String> }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Hooks { pub config_path: String, pub config_sha256: String }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Evidence { pub schema_version: u32, pub contract_digest: String, pub records: Vec<Receipt> }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Receipt {
    pub id: String, pub criterion_id: String, pub contract_digest: String,
    pub identity: BTreeMap<String, String>, pub artifact_path: String, pub artifact_sha256: String,
    pub captured_at: u64, pub expires_at: Option<u64>, pub supersedes: Option<String>,
    pub origin: Origin, pub operation: Option<Operation>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Origin { pub runner: String, pub config_sha256: String, pub platform: String, pub artifact_identity: BTreeMap<String, String> }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OperationState { Running, Completed }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Operation { pub id: String, pub action_id: String, pub state: OperationState, pub started_at: u64, pub expires_at: u64 }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CommandReceipt {
    pub action_id: String, pub executable: String, pub argv: Vec<String>, pub cwd: String,
    pub exit_code: i32, pub stdout_sha256: String, pub stderr_sha256: String,
    pub stdout_path: String, pub stderr_path: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Review { pub schema_version: u32, pub contract_digest: String, pub reviewer: String, pub rationale: String }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Adoption {
    pub schema_version: u32, pub contract_digest: String, pub review_digest: String,
    pub previous_contract_digest: Option<String>, pub operator: String, pub rationale: String,
    pub invalidated_criteria: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LearningKind { Discovery, Failure, Learning, Amendment }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Classification { Clarification, InScopeDefect, NewScope, ExternalDependency, DeferredImprovement }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Learning {
    pub schema_version: u32, pub id: String, pub contract_digest: String, pub kind: LearningKind,
    pub summary: String, pub evidence_refs: Vec<String>, pub proposed_criteria: Vec<Criterion>, pub supersedes: Option<String>,
    pub classification: Classification, pub disposition: String, pub affected_criteria: Vec<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ActionRequest { pub schema_version: u32, pub action_id: String, pub kind: ActionKind, pub executable: String, pub argv: Vec<String>, pub cwd: String }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum Verdict { Complete, Continue, Wait, Blocked, ReviewRequired, Invalid }
impl Verdict {
    pub fn exit_code(&self) -> i32 { match self { Self::Complete => 0, Self::Continue => 10, Self::Wait => 11, Self::Blocked => 12, Self::ReviewRequired => 13, Self::Invalid => 14 } }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Reason { pub code: String, pub criterion_id: Option<String>, pub message: String }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct NextAction { pub id: String, pub kind: ActionKind }
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Decision {
    pub schema_version: u32, pub decision_id: String, pub contract_digest: String, pub evaluated_stage: String,
    pub verdict: Verdict, pub stage_complete: bool, pub phase_complete: bool,
    pub unmet_criteria: Vec<String>, pub evidence_refs: Vec<String>, pub reasons: Vec<Reason>,
    pub next_authorized_action: Option<NextAction>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Authorization { pub schema_version: u32, pub authorized: bool, pub action_id: String, pub reason: String, pub decision: Decision }
