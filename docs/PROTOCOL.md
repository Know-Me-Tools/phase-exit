# Shared implementation protocol v1

These are implementation interfaces. Actual qualification is recorded separately
in the phase ledger and acceptance receipts. Exact JSON contracts and examples
live in rust-interface.md and typescript-interface.md.

## Process interface

Binary `phase-exit`. JSON stdout, diagnostics stderr. `evaluate --contract FILE
--evidence FILE --stage ID --state-dir DIR` reads immutable input artifacts and
writes append-only decision/JEV receipts in state-dir. Exit codes: 0 COMPLETE,
10 CONTINUE, 11 WAIT, 12 BLOCKED, 13 REVIEW_REQUIRED, 14 INVALID. CLI configuration
errors are INVALID. Non-evaluation successful commands return 0.

All decisions contain schema_version=1, decision_id, contract_digest,
evaluated_stage, verdict, stage_complete, phase_complete, unmet_criteria,
evidence_refs, reasons (structured code/criterion_id/message), and
next_authorized_action (null or structured id/kind). Never interpret exit 0 alone
as phase completion. Stage COMPLETE can have phase_complete=false.

The Rust owner owns `contract` import/inspect/freeze/compare/propose-revision/adopt,
`evidence import`, `evaluate`, `action authorize`, `learn record`, `status`, and
`explain`, with documented concrete argv. Preserve hashes and adoption references.
No arbitrary command execution or model-generated criteria. Explicit state-dir
and artifact paths make test and actual work separable. Contract adoption is an
operator audit record, not authentication of a human or an attacker-proof store.

## Hook adapter bridge

Node hook adapters invoke Rust with executable+argv arrays and receive this
decision shape. Use `PHASE_EXIT_BINARY`, `PHASE_EXIT_CONTRACT`,
`PHASE_EXIT_EVIDENCE`, `PHASE_EXIT_STAGE`, `PHASE_EXIT_STATE_DIR`; optional local
config files may provide these paths. No credential to hook modules. Gate-sensitive
tool authorization uses `action authorize` with a JSON request file; the exact
request shape is documented in rust-interface.md. No hook pipeline executes
acceptance commands.

STOP behavior: phase_complete=true allows successful stop. WAIT, BLOCKED,
REVIEW_REQUIRED, INVALID allow yielding/stopping with truthful state. CONTINUE or
stage_complete with next transition may request at most one host-supported
continuation per changed actionable fingerprint; respect stop_hook_active.
Do not use Stop veto to bounce indefinitely on external prerequisites.

## Extension hooks

Versioned Node ESM hook config has ordered entries with id, event, module,
sha256, timeout_ms, required, env_allowlist, input_schema and output_schema.
Events: contract.collected,
contract.frozen, evidence.imported, evaluation.before, judgement.received,
decision.finalized, amendment.proposed. Each receives bounded JSON and returns
typed JSON. Core outcomes combine monotonically: veto can block; no allow can
erase a failure. Additional evidence or amendments are proposals requiring normal
import/adoption. Required hook failure blocks certification; optional notification
failure only logs. Snapshot config, reject recursion, never pass JEV_API_KEY.

Rust evaluation integrates this hook runtime through the bridge.
Use `PHASE_EXIT_HOOK_RUNNER` (compiled Node entrypoint) and contract hook config
path/digest. Rust spawns `node <runner> <event> <context-file>` with the credential
removed. The exact context and result schemas are in typescript-interface.md.

## Verification boundary

Authors may read source, dependency metadata and docs, and write code/fixtures.
No compiler/test/install script/packaging validator runs before lead inventory.
Lockfile generation and dependency installation, with lifecycle scripts disabled,
are deferred to the serialized final build/acceptance program. New observations
are collected as a complete repair cohort before any rerun.

The uncomfortable limit: the trusted host must enforce authorization and adoption.
The protocol cannot prevent a privileged caller from bypassing its decision.
