# Rust interface v1

Phase: Execute. Production source is authored; compilation, checks and live
qualification remain deferred to the lead's whole-phase inventory boundary.
The exact exported field contracts are in `schemas/*.schema.json`. Unknown fields,
missing required fields, duplicate JSON object keys and invalid primitive types
are rejected at the CLI. All paths below are absolute. JSON digests use SHA-256
of compact sorted-key JSON; artifact digests use exact bytes.

## Contract

```json
{
  "schema_version": 1,
  "id": "example",
  "project": "example-project",
  "phase": "delivery",
  "revision": 1,
  "parent_digest": null,
  "identity": {"commit": "abc123"},
  "exclusions": ["Windows qualification"],
  "prerequisites": [],
  "boundary": {"implementation_stages": ["implement"]},
  "retry_limits": {"max_attempts": 3, "max_elapsed_seconds": 60},
  "jev": {"model": "jev-1.14.0", "rubric_version": "phase-exit-v1", "support_threshold": 0.95, "contradiction_threshold": 0.05},
  "sources": [
    {"id": "assessment", "role": "assessment", "path": "/absolute/assessment.md", "sha256": "REPLACE_WITH_SHA256"},
    {"id": "analysis", "role": "analysis", "path": "/absolute/analysis.md", "sha256": "REPLACE_WITH_SHA256"},
    {"id": "spec", "role": "specification", "path": "/absolute/spec.md", "sha256": "REPLACE_WITH_SHA256"},
    {"id": "plan", "role": "plan", "path": "/absolute/plan.md", "sha256": "REPLACE_WITH_SHA256"}
  ],
  "conflicts": [],
  "stages": [
    {"id": "implement", "kind": "implementation", "depends_on": []},
    {"id": "accept", "kind": "gate", "depends_on": ["implement"]}
  ],
  "criteria": [
    {"id": "code", "stage": "implement", "description": "Approved implementation exists", "source_id": "plan", "depends_on": [], "expected_outcome": "Exact approved source bytes", "predicate": {"kind": "file_sha256", "sha256": "REPLACE_WITH_SHA256"}},
    {"id": "gate", "stage": "accept", "description": "Production acceptance passed", "source_id": "spec", "depends_on": ["code"], "expected_outcome": "Approved command exit zero", "predicate": {"kind": "command_success", "action_id": "accept-command"}}
  ],
  "actions": [{"id": "accept-command", "kind": "gate", "stage": "accept", "executable": "/absolute/program", "argv": ["accept"], "cwd": "/absolute/project", "repairs_criteria": [], "covers_criteria": []}],
  "hooks": null
}
```

Replace the explicitly marked hashes and paths with real source artifacts.
Sources are checked at import, freeze, adoption and evaluation. Review requires
assessment, analysis, specification and plan sources. Additional source roles
`evidence` and `configuration` are supported. Source role labels and operator
review remain audit assertions about provenance; the engine cannot infer a
source's truth from its label.

Stages and criterion dependencies must form DAGs. Every stage has criteria.
The boundary lists exactly every implementation stage. Implementation predicates
must be deterministic and cannot depend on executing a gate or model judgment.
Global prerequisites are criterion IDs that must pass before gate/publication
execution. A stage-specific external collaborator belongs in that stage's
criteria/dependencies, rather than the global prerequisites list.

Conflicts are explicit records `{id,criterion_ids,resolution,source_id}`.
A null/empty resolution is rejected. This requires reviewed resolution records;
it does not claim to automatically discover arbitrary contradictions in prose.
Every source or criterion ID is stable and unique within its collection.

Actions have kind `implementation`, `gate`, `publication` or `repair`. A repair
must explicitly name its affected `repairs_criteria`; other actions use an empty
list. Every action also has `covers_criteria`. A command_success criterion is
automatically covered only by its predicate.action_id; command-only actions can
leave covers_criteria empty. Other predicates require explicit same-stage
criterion IDs in covers_criteria. Explicit coverage cannot claim a command
criterion belonging to another action. Repair actions use covers_criteria empty.
An action is eligible only when its own coverage has missing/stale evidence and
the covered criteria's dependencies pass. A passing command A cannot be selected
to collect missing proof for command B in the same stage.
Gate/publication requires the complete implementation boundary, global
prerequisites and its stage dependencies. A failed runtime criterion can request
an exact approved repair; an uncatalogued repair requires review. The adopted
max_attempts (1..3) also bounds distinct failed command receipts per criterion.
max_elapsed_seconds (1..90) bounds a JEV transport attempt series.

## Predicates and immutable evidence

Other predicate forms:

```json
{"kind":"json_equals","pointer":"/passed","expected":true}
{"kind":"external_ready","pointer":"/available"}
{"kind":"semantic","pointer":"/statement","question":"Does the evidence establish the required outcome?"}
```

Every predicate needs a readable artifact with matching bytes, contract digest
and full identity. `json_equals` uses exact JSON equality. External readiness
requires literal boolean true. `semantic` selects one JSON value for the minimal
JEV packet; deterministic facts and dependencies must pass before inference.

```json
{
  "schema_version": 1,
  "contract_digest": "REPLACE_WITH_CONTRACT_DIGEST",
  "records": [{
    "id": "code-proof",
    "criterion_id": "code",
    "contract_digest": "REPLACE_WITH_CONTRACT_DIGEST",
    "identity": {"commit":"abc123"},
    "artifact_path": "/absolute/code.rs",
    "artifact_sha256": "REPLACE_WITH_SHA256",
    "captured_at": 1792100000,
    "expires_at": null,
    "supersedes": null,
    "origin": {"runner":"named-importer","config_sha256":"REPLACE_WITH_SHA256","platform":"darwin-arm64","artifact_identity":{"commit":"abc123"}},
    "operation": null
  }]
}
```

Times are Unix seconds. Receipt identity and origin.artifact_identity must exactly
match the adopted contract identity. Origin runner/config/platform is provenance
metadata, not authentication. Future receipt timestamps are invalid; expired
receipts are stale. Each receipt is immutable by ID; changed content under the
same ID is invalid. Supersession explicitly names an older receipt of the same
criterion. All previously imported unsuperseded receipts participate, so removing
a failure from an input bundle does not erase it. Multiple current receipts for
one criterion require explicit supersession. The state retains hashed artifact
snapshots and failed receipts for attempt accounting.

A completed command artifact has this exact shape:

```json
{"action_id":"accept-command","executable":"/absolute/program","argv":["accept"],"cwd":"/absolute/project","exit_code":0,"stdout_sha256":"REPLACE_WITH_SHA256","stderr_sha256":"REPLACE_WITH_SHA256","stdout_path":"/absolute/stdout","stderr_path":"/absolute/stderr"}
```

The action ID, executable, argv and cwd must match the adopted action exactly;
stdout/stderr files must match their hashes. Exit zero is required. Imported
historical receipts are audited observations from their named runner. They do not
prove this tool authorized an older process before it ran. Future launches use
host action authorization; stronger execution attestation is a deferred concern.

A live observation can set operation to
`{id,action_id,state:"running",started_at,expires_at}`. It yields WAIT only for
an unexpired operation matching a command_success criterion's adopted action.
The artifact hash/identity still must match; completed command fields are not
required while the operation is running. `state:"completed"` requires the actual
completed predicate evidence. Expired/mismatched running observations do not WAIT.

## Lifecycle and exact argv

| Invocation | Result |
| --- | --- |
| `digest --file FILE` | `{schema_version:1,sha256}` for canonical JSON |
| `contract import --contract FILE --state-dir DIR` | Immutable draft; returns contract_digest |
| `contract inspect --contract FILE` | Validated contract, contract_digest and generated readable summary |
| `contract freeze --contract FILE --reviewer NAME --rationale TEXT --state-dir DIR` | Immutable review; returns contract_digest, review_digest, status:reviewed |
| `contract adopt --contract FILE --adoption FILE --state-dir DIR` | Explicit operator adoption; returns adoption_digest |
| `contract compare --contract FILE --other FILE` | invalidated_criteria, structured changes and readable summary between old/new |
| `contract propose-revision --contract FILE --other FILE --state-dir DIR` | Immutable proposal including changes and readable summary; no adoption |
| `evidence import --contract FILE --evidence FILE --state-dir DIR` | Immutable receipts and artifact snapshots |
| `evaluate --contract FILE --evidence FILE --stage ID --state-dir DIR` | Decision, importing supplied receipts first |
| `action authorize --contract FILE --evidence FILE --request FILE --state-dir DIR` | Exact action eligibility; no process execution |
| `learn record --learning FILE --state-dir DIR` | Immutable classified observation; no scope change |
| `status --state-dir DIR` | Active adoption and persisted decisions |
| `explain --decision FILE` | Strictly parsed decision |
| `schema export --kind KIND` | JSON Schema |
| `schema validate --kind KIND --file FILE` | Strict protocol validation; contract includes source/DAG checks |

KIND is contract, evidence, decision, adoption, learning or action. Non-evaluation
success returns zero. Invalid options/configuration return14. Stdout is JSON;
no command executes arbitrary shell text or acceptance commands.

Inspect returns `{schema_version,contract_digest,contract,summary}`. The generated
summary string names project/phase/revision; stage, criterion, action, source and
conflict counts; implementation boundary; exclusions; prerequisites; model,
rubric and thresholds; retry limits; hook configuration/hash; and each stage's
criterion IDs, descriptions, expected outcomes, source references and dependencies.
It is rendered directly from the structured contract without model inference.

Compare returns `{schema_version,previous_contract_digest,contract_digest,
invalidated_criteria,changes,summary}`. Propose-revision returns the same fields
plus `status:"proposed"`, and persists that exact proposal. `changes` contains
direct edits, while invalidated_criteria includes their affected dependents:

- Criterion edit: `{kind:"criterion",id,change:"added"|"removed"|"changed",old,new}`.
  old/new contain complete criterion values; the absent side is null.
- Policy or other contract field edit: `{kind:"contract_field",field,old,new}`.
  This includes changed identity, sources, stages, actions/coverage, exclusions,
  prerequisites, boundary, retry limits, JEV policy, hooks and lineage fields.

The readable summary lists each direct edit with `-` old and `+` new JSON values,
then the invalidation set. Existing digest, status and invalidation fields retain
their meanings; generated summaries do not create approval authority.

Adoption file:
```json
{"schema_version":1,"contract_digest":"REPLACE_WITH_CONTRACT_DIGEST","review_digest":"REPLACE_WITH_REVIEW_DIGEST","previous_contract_digest":null,"operator":"operator-name","rationale":"Approve reviewed scope","invalidated_criteria":[]}
```
Initial adoption is revision1 with no parent. A revision names the current adopted
head as both contract.parent_digest and adoption.previous_contract_digest, keeps
project/phase identity and increments revision by one. invalidated_criteria must
include changed/added/removed criteria and transitive criterion/stage dependents.
Review and contract snapshots are hash bound. Old contracts cease to be active;
new revisions require newly bound evidence, with no implicit carry-forward.
This is operator audit, not human authentication or protection from a privileged
local attacker. The adoption writer lock serializes head updates; a stale lock
requires operator investigation rather than automatic deletion.

Learning file:
```json
{"schema_version":1,"id":"finding-1","contract_digest":"REPLACE_WITH_CONTRACT_DIGEST","kind":"discovery","summary":"Observed gap","evidence_refs":["receipt-id"],"proposed_criteria":[],"supersedes":null,"classification":"in_scope_defect","disposition":"Propose exact approved repair","affected_criteria":["gate"]}
```
Kinds: discovery/failure/learning/amendment. Classifications: clarification,
in_scope_defect, new_scope, external_dependency, deferred_improvement. Superseded
learning remains stored. Proposals never mutate criteria. Scope changes require
new reviewed contracts and explicit operator adoption.

Action request:
```json
{"schema_version":1,"action_id":"accept-command","kind":"gate","executable":"/absolute/program","argv":["accept"],"cwd":"/absolute/project"}
```
Response: `{schema_version:1,authorized,action_id,reason,decision}`. Authorized
returns0; denied returns12; invalid input returns14. Every request field must
match the approved action. No executable basename/substring or shell matching.
A truthful false authorization never grants the underlying process permission.

## Decisions

Every decision has schema_version, decision_id, contract_digest, evaluated_stage,
verdict, stage_complete, phase_complete, unmet_criteria, evidence_refs,
reasons (`{code,criterion_id:null|string,message}`), and next_authorized_action
(null or `{id,kind}`). The requested stage is retained on input errors whenever
readable. The decision ID hashes its canonical JSON with decision_id empty.

| Verdict | Exit | Meaning |
| --- | --- | --- |
| COMPLETE | 0 | Requested stage and its dependencies pass; phase_complete can remain false |
| CONTINUE | 10 | An exact approved missing-proof action or in-scope repair is eligible |
| WAIT | 11 | Matching live operation has not expired |
| BLOCKED | 12 | Required external collaborator or mandatory hook is unavailable |
| REVIEW_REQUIRED | 13 | Failed/uncertain/contradictory evidence lacks an approved executable resolution, or attempts exhausted |
| INVALID | 14 | Malformed, inconsistent, tampered or unadopted input; no action |

Global integrity failures take precedence. External blockers precede waiting.
Stage success never implies phase success; all stages must pass for phase_complete.
Missing proof cannot open an unapproved gate. No JEV answer can waive a missing
runtime fact, external collaborator, identity binding or full implementation.

## JEV and controlled failure transport

The endpoint is fixed `https://api.typesafe.ai/v1/systemone`; model is exactly
jev-1.14.0 (preview release). The only credential source is process JEV_API_KEY.
No alias, endpoint override, long-context header or credential artifact is used.
The minimal request contains selected evidence, criterion/outcome, contract and
artifact identity plus rubric version. Sensitive field names and the process
credential value are redacted before transmission/hooks; raw user prose can
still contain information the engine cannot identify as confidential.

Two noul questions have exact IDs support/contradiction. Response model and IDs
must match; noul must be finite numeric [0,1], with exact typed usage fields.
Support>=.95 and contradiction<=.05 are minimum certification thresholds; the
contract can tighten them. Confident contradiction (>=.95) and uncertainty both
require review and retain distinct reason codes. Fixture results never certify.

Whole serialized request size is capped at32000bytes, a deliberately narrower
conservative limit than the provider's advertised context limits. No truncation.
Responses are bounded at32MiB. HTTPS redirects are disabled. Network connection/
timeout and HTTP429/529 failures use at most the adopted1..3 attempts and elapsed
deadline. Delta-second Retry-After is honored; unsupported date-form Retry-After
stops for review rather than retrying earlier than the server requested.
Permanent HTTP/protocol failures are not retried. Successes, uncertainties,
contradictions and terminal failures are memoized by canonical request, material
artifact/contract identity, adopted policy, retry limits and fixture fingerprint.
Receipt IDs, timestamps, paths, supersession and origin metadata do not create a
new semantic sample around unchanged evidence. Every invocation separately stores
an immutable `jev-evaluations/<evaluation_fingerprint>.json` provenance record:
`{schema_version:1,request_digest,contract_digest,criterion_id,receipt_id,receipt_digest,
live,terminal_kind:"judgement"|"failure",terminal_digest}`. Its receipt_digest binds
the entire receipt, including origin/configuration/time/operation metadata, and
request_digest references the reused semantic sample. The filename is the
canonical digest of that provenance record. A refreshed receipt creates a new
provenance reference to the same terminal judgment or failure, without another
endpoint call. Changed material evidence or an explicitly adopted policy revision
can change the sampling fingerprint. Attempts remain append-only sanitized
records; terminal failures are not silently cleared.

`evaluate` and `action authorize` accept `--jev-fixture FILE` only for explicit
controlled failure qualification. No fixture can supply live completion authority.

```json
{"schema_version":1,"status":200,"body":{"model":"jev-1.14.0","answers":{"support":{"type":"noul","noul":0.99},"contradiction":{"type":"noul","noul":0.01}},"usage":{"input_tokens":1,"output_tokens":1}}}
```

A sequence exercises the shared bounded retry loop:
```json
{"schema_version":1,"attempts":[{"status":429,"body":{},"retry_after_seconds":0},{"status":200,"body":{"model":"jev-1.14.0","answers":{"support":{"type":"noul","noul":0.99},"contradiction":{"type":"noul","noul":0.01}},"usage":{"input_tokens":1,"output_tokens":1}},"retry_after_seconds":0}]}
```
The last fixture attempt repeats if retries remain. Status0 models transient
transport failure. Fixture success yields REVIEW_REQUIRED/FIXTURE_NOT_AUTHORITY;
uncertainty yields SEMANTIC_UNCERTAIN and contradiction SEMANTIC_CONTRADICTION.
Malformed/model-mismatched answers yield JEV_UNAVAILABLE, never certification.

Official API/model references: https://docs.typesafe.ai/api and
https://docs.typesafe.ai/models. Rust dependencies are exactly pinned in Cargo.toml
and were confirmed against docs.rs version pages: serde1.0.228, serde_json1.0.145,
sha2 0.10.9, thiserror2.0.17, reqwest0.12.24. Transport uses reqwest blocking, so
there is no asynchronous application runtime or Tokio task/cancellation code.

## Node extension bridge

Contract hooks are null or `{config_path,config_sha256}`. Config entries and module
protocols are specified in `docs/typescript-interface.md`. Rust snapshots the
hash-verified config and invokes `node PHASE_EXIT_HOOK_RUNNER EVENT CONTEXT_FILE`
without a shell. PHASE_EXIT_HOOK_RUNNER must be absolute. Only basic platform
PATH/HOME/temp/SystemRoot variables reach the runner; JEV_API_KEY never does.
Recursive PHASE_EXIT_HOOK_ACTIVE requests are rejected even with hooks:null.

Context:
`{schema_version:1,config_path,config_base_dir,config_sha256,state_dir,invocation_id,payload}`.
config_path is immutable snapshot; config_base_dir is the original adopted
configuration directory, preserving relative modules. payload.contract is the
complete contract. Result:
`{schema_version:1,event,blocked,results:[{id,status:"ok"|"veto"|"failed",required,message}],evidence_proposals:[],amendment_proposals:[]}`.

Events: contract.collected, contract.frozen, evidence.imported, evaluation.before,
judgement.received, decision.finalized, amendment.proposed. Evaluation traverses
the actual runner; cached JEV judgment also invokes judgement.received. Veto or
required failure can only restrict outcome. Proposals never auto-import/adopt.
Rust bounds runner execution at60seconds and output at1MiB; Node enforces ordered
per-module limits totaling at most45seconds per event and snapshots modules before
running them. Hook receipts preserve bounded sanitized outcomes. Finalization
veto clears all completion and action fields before persisting the decision.

## Source handoff and limits

Owned source: Cargo.toml; crates/phase-exit-core/{Cargo.toml,src/types.rs,lib.rs,
store.rs,lifecycle.rs,engine.rs,jev.rs,hooks.rs,schema.rs};
crates/phase-exit-cli/{Cargo.toml,src/main.rs}; schemas/{contract,evidence,decision,
adoption,learning,action}.schema.json; this document. Rust workspace/best-practices
skills were read; rust-router was absent. No Cargo, tests, lint, format, compiler,
install or product API probe was run by the Rust author before the boundary.

The uncomfortable limit: immutable local records and model confidence do not
prove absence of defects, establish operator identity, or stop privileged local
bypass. Extensions are trusted executable modules, not an OS sandbox. Runtime
receipts are only as trustworthy as the named runner and adopted provenance.
Host enforcement and live service/native harness qualification remain empirical
acceptance work for the lead. No unrequested retrospective execution-proof layer
or arbitrary command execution was added.
