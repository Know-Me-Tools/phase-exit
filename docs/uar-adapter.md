# Read-only UAR adapter

Phase Exit phase `first-uar-example`, Execute. UAR remains in
`uar-outstanding-issues-v1-1-1`. This adapter reads the existing checkout and
retained receipts. It does not run the Python acceptance program, stop its active
run, modify UAR, publish images, invoke a model, or operate the customer deployment.

## Exports and command

`packages/uar/index.ts` exports `importUarSnapshot`, `canonicalJson`, `PHASE`,
`PHASE_PATH`, `GROUPS`, `IMAGE_SCENARIOS`, `NATIVE_SUPPLEMENTS`, and the public input
and result types. The compiled entrypoint is `dist/packages/uar/cli.js`.

```typescript
import { importUarSnapshot } from './dist/packages/uar/index.js';
const result = await importUarSnapshot({
  root: suppliedUarRoot,
  output: newPrivateOutputDirectory,
  // Optional explicit selection. Omission retains historical inventory03.
  inventory: { path: suppliedInventoryPath, sha256: suppliedExactByteSha256Hex },
  // Optional: default reads the retained manifests under evidence/gates.
  receipts: [{ manifest: suppliedManifestPath, receipt: suppliedReceiptPath }],
  // Supply only a real operator-approved reference; omission leaves it pending.
  adoptionReference: suppliedOperatorReference,
  // Optional trusted native-host poll, with a maximum300-second validity window.
  activeOperationObservation: suppliedHostObservationPath,
});
```

```text
node dist/packages/uar/cli.js --root UAR_ROOT --output NEW_PRIVATE_DIRECTORY
node dist/packages/uar/cli.js --root UAR_ROOT --output NEW_PRIVATE_DIRECTORY --inventory INVENTORY_PATH --inventory-sha256 HEX
node dist/packages/uar/cli.js --root UAR_ROOT --output NEW_PRIVATE_DIRECTORY --receipt MANIFEST RECEIPT --adoption-reference OPERATOR_REFERENCE
node dist/packages/uar/cli.js --root UAR_ROOT --output NEW_PRIVATE_DIRECTORY --active-operation-observation HOST_OBSERVATION
```

`--inventory` and `--inventory-sha256` must occur together. The digest is64
lowercase hexadecimal characters without a prefix, computed from exact supplied
inventory bytes. Relative inventory paths resolve against UAR root; the resolved
path must stay inside the active phase directory. There is no automatic latest
inventory discovery. A missing explicit file or digest mismatch fails collection.
`InventoryInput` is exported with the other public types.

`--receipt` accepts two paths and may repeat. Output's parent must exist; output
itself must not exist and must be outside UAR. The importer resolves the parent
before checking containment, creates directories with mode 0700 and files with
mode 0600, and uses exclusive file creation. These modes are Unix confidentiality
controls, not a claim of Windows qualification. A partial output after an I/O
failure is never adopted; use a fresh directory on retry. CLI0 means collection
succeeded, **not phase completion**; invalid input or collection failure exits14.

Results are `{ok:true,value:{contract,evidence,adoptionMap,snapshot,contractDigest,
status,implementationItems,imageScenarios,nativeSupplements,warnings}}` or
`{ok:false,error:{code,message}}`. Successful status is always
`draft_requires_operator_adoption`.

## Evidence and authority

Generated `contract.draft.json` and `evidence.json` follow `rust-interface.md`,
including boundary, stage DAG, expected outcomes, pinned JEV policy, origin and
exact identity maps. The actual phase assessment, analysis, specification and
plan are retained with their lifecycle roles; supplemental raw evidence has an
evidence role. Both known count/group contradictions have explicit resolution
records. JSON contract digest uses recursively sorted keys and
SHA-256; source and artifact digests use exact bytes. Generated assertions bind
the input manifest hash, receipt hash, inventory hash, and per-file hash receipt
in `snapshot.json`. The source copies are unmodified bytes under `sources/`.
Receipt versions missing in historical formats are accepted only when the
explicit bound manifest provides version1.1.1 and the remaining artifact
identities agree. No filename-derived version or success is inferred.

A missing receipt file is an absent observation, not a fabricated runner result.
The importer still captures the real manifest and its referenced inventory. Only
an actual canonical `evidence/gates/local.json` with the exact current inventory
digest, source/fixture trees, strict local baseline commit, phase/version/platform,
six approved groups and canonical `evidence_root/receipt.json` path can expose the
existing fixed local collection action before its first run. Both implementation
boundaries and all implementation evidence must already be complete. A present
malformed, non-object, unreadable or changing receipt fails collection instead of
being treated as absent.

`snapshot.pending_manifests` records the manifest hash, intended original receipt
path and explicit `receipt_observation:"absent"`, with no image observation,
started state, receipt hash or runtime artifact identity invented. For an eligible
canonical local manifest with no current observed local receipt, local assertions
remain false and the importer emits no evidence records for that stage. The
engine therefore sees missing observations and can return `CONTINUE` for the
already approved collection action after explicit contract adoption. Existing
failed receipts retain their failed assertions; omission does not convert a
failure into permission to retry. `unobserved_stages` exposes the omitted-record
scope. Noncanonical or stale pending manifests expose no collection action.

The freshness hook checks the pending manifest hash and requires the receipt to
remain absent. If a receipt appears during collection, import fails; if it appears
afterward, evaluation vetoes until recollection and explicit revision/adoption.
This prevents the old missing snapshot from authorizing a duplicate collection.
An absent published receipt provides no publication provenance and exposes no
published action; the existing strict publication identity requirements remain.

The importer implements UAR's actual `source_identity` algorithm: read-only
`git ls-files -z --cached --others --exclude-standard -- PATHS`, byte-order sort,
per-file SHA-256, symlink-target bytes, clean submodule commit identity, deleted
markers, and final framed tree digest. It recomputes source and fixture digests
before output. Every inventory item file is independently compared with its
recorded hash. The snapshot retains the inventory's expected `sha256` and the
captured `actual` hash separately; a mismatch leaves its implementation criterion
unmet. Unknown item sets or changed reconciliation scope fail collection.

The required `evaluation.before` hook is generated from compiled, self-contained
`freshness.js`, with the private snapshot path embedded and module/config bytes
hashed. Its input/output schema IDs are `phase-exit/hook-input/v1` and
`phase-exit/hook-output/v1`; its45000ms timeout fits the runner's aggregate budget.
Set `PHASE_EXIT_HOOK_RUNNER` to the shipped Node hook runner before Rust
evaluation. The hook checks current source/fixture identity, original inventory
bytes, each item file and raw artifacts used by passing current receipts.
Item freshness requires a valid captured `actual` SHA-256 hash and compares live
bytes with that hash. An existing mismatch with the inventory's expected hash
remains an unmet implementation criterion; it does not become a freshness veto
when captured bytes are unchanged. Freshness binds the observed source/fixture
trees separately from the selected inventory's expected trees. New snapshots
also bind exact waypoint and ledger bytes, so closing a repair boundary or adding
an implementation task invalidates a prior snapshot's mutable authority view.
The hook vetoes stale or unreadable state and
reports only a predefined freshness error code, or `UNKNOWN` for other errors,
without exposing raw error messages, paths or environment values.
Only read-only Git subprocesses are used;
the environment allowlist supports Git's normal path/global-ignore resolution.
Neither collection nor the hook runs product tests or production mutations.

`hashes.json` must cover the exact receipt and every listed raw artifact must
match its retained bytes before any program receives passing credit. Raw logs
are hashed in place and never copied into public examples. The private generated
snapshot retains absolute provenance paths and must not be committed publicly.
An active receipt or a missing final raw-hash manifest cannot pass. If input
bytes change during collection, the importer reports a collection error without
stopping the original process.

`adoption-map.json` separately preserves historical inventory03's19 listed items
and stale numeric17 count. Current implementation criteria and counts derive
from the exact ledger implementation set. The selected inventory may omit a new
pending repair row: that row receives an unmet criterion with no invented files.
Duplicate IDs or inventory rows outside the ledger fail collection. A subset
inventory, either closed ledger or validation-scope boundary, incomplete inventory, changed deliverable bytes
or changed production/fixture trees leaves the implementation prerequisite false.
The snapshot remains collectable and cannot authorize a gate or claim completion.
This permits an honest CLOSED repair snapshot retaining historical03 while R9
is pending. A later inventory04 must be supplied explicitly with its digest;
collection does not adopt it or reopen the boundary.

The mapping replaces obsolete seven-group prose with the approved six
groups from the current plan/ledger. It enumerates76 exact mandatory image
scenarios and4 exact native supplements. The original inventory is never edited.
A supplied operator reference makes this mapping reviewable, but Rust's separate
freeze/adopt lifecycle is still required before evaluation. There is no automatic
operator authority or default adoption. Recollection never overwrites an existing
snapshot or the Rust adoption head; a later adopted revision must use the explicit
revision/invalidation workflow.

## Completion order

The contract project slug is `universal-agent-runtime`; the exact GitHub repository
is retained separately in `identity.repository`. Global prerequisites explicitly
require the current implementation boundary and adopted mapping. Supervisor
qualification is a release prerequisite through `release-readback.depends_on`,
so it blocks release without falsely describing the already-running local program
as stopped.

The contract stages require implementation, preserved original review disposition,
local acceptance, artifact publication, published arm64 acceptance, published
amd64 acceptance, verified release, issue readbacks, and reflection, in that order.
All implementation items and the explicit mapping are required. Each image stage
contains every individual scenario plus a whole-program criterion. The latter
requires a single exact current six-group passed receipt, clean exit, final raw
evidence, image identity and nonempty observable scenario results. One repaired
group cannot establish stage or phase completion. Local native supplements are
required in addition to image scenarios and never credited to a published image.

Evaluate stage `local` after the complete current local program passes. The engine
can return `COMPLETE` with `stage_complete:true` and `phase_complete:false` while
publication and published acceptance remain pending. This is the handoff to the
operator-authorized host P1 commit/tag/publication work. The adapter defines only
the exact three acceptance-runner actions. It defines no executable publication
action, and `next_authorized_action` may therefore be null at this handoff. A
host must not invent an action from the decision. The user's existing publication
authorization remains separate from the CLI's exact-action authorization.

Committing byte-identical frozen candidate source does not invalidate its local
receipt merely because HEAD changed; the importer does not compare local evidence
with live HEAD. Changed production, fixture, deliverable, waypoint or ledger bytes
still require recollection and explicit revision/adoption. After P1, collect both
published receipts against their actual immutable publication provenance, retaining
the original passing local receipt. Pending publication criteria do not create
another local test requirement.

Published receipts require the immutable repository child reference, matching
platform, index/source identity, both exported children, and the runner's retained
publication provenance bound to its hash-checked publication receipt. This adapter
does not contact the registry or GitHub; it imports the existing runner's recorded
observations and retained bytes. No new publication proof is fabricated.

The inventory's `source_commit` is the local candidate's baseline. Local receipts
must retain that exact value. P1 commits the already accepted candidate later;
published manifests and receipts bind that actual release commit through the
existing annotated-tag, successful workflow and immutable publication receipt
provenance. Published evidence must still reference the exact selected inventory
bytes and identical frozen source/fixture trees. It does not need to relabel the
inventory baseline as the later commit. Current published receipts must agree on
one release commit, index digest and publication-receipt digest; conflicting
publication identities fail collection. Global contract `identity.source_commit`
continues to name the candidate inventory baseline; exact published commit/index/
children remain in the captured manifest, publication and runner provenance.

Genuine supervisor availability is derived from existing current artifact-bound
evidence. A local or published receipt must pass identity and raw-artifact hashes,
have a passing recovery group, and contain the exact passing
`qualified_supervisor_reclaim_controls` scenario with the actual producer's
qualification, identity and physical-exclusion SHA-256 observations. Without
that proof its `external_ready` criterion stays false and blocks release. Local
positive qualification can establish collaborator availability; both published
whole programs remain mandatory independent release requirements. This adds no
setup action, authority or substitute acceptance. Raw artifacts used by positive
qualification are freshness-checked even when another group failed.
Release, issue readbacks, and reflection remain pending assertions; the first
adapter does not manufacture these receipts. A later evidence-backed explicit
revision is required to adopt completion evidence for them. Existing populated
canonical manifests produce exact approved runner actions from UAR's
`verification.md`: the `python3` executable resolved through filesystem-only PATH
inspection, relative `scripts/release/uar_1_1_1_acceptance.py`, `--manifest`, the
original absolute canonical manifest path, and UAR root cwd. No command is
executed. Original manifest bytes are retained in contract sources. Rust adoption
and normal action authorization remain required before any host can use an action.
Each approved runner action explicitly lists `covers_criteria`: its same-stage
whole-program criterion, all 76 image scenarios, and the four native supplements
for the local action only. Publication, release, supervisor qualification, issue
readbacks and reflection are not covered by these runner actions. When a trusted
running observation moves the local action to `local-operation`, its coverage
list is empty. The observation must contain exactly three string arguments with
the approved script and `--manifest`; its manifest path is resolved against the
validated UAR cwd and must have the same realpath as the original canonical
manifest. The action then preserves the observed argv unchanged, including a
relative manifest argument. `local-runner-operation` binds that exact action
through `command_success.action_id` instead.

## Running operation and immutable evaluator flow

`status: started` alone never produces WAIT. Optional `activeOperationObservation`
(`--active-operation-observation`) points to a trusted native-host observation
with this shape; values must come from an actual host poll:

```typescript
type ActiveOperationObservation = {
  schema_version: 1;
  runner: 'codex-native-exec';
  runner_session_id: string; // Actual native exec session ID, decimal digits.
  state: 'running';
  observation_reference: string; // Reference to the actual host tool poll.
  executable: string; // Absolute resolved python3 path.
  argv: string[]; // Exact approved script, --manifest, original manifest path.
  cwd: string; // Exact supplied and resolved UAR root.
  manifest_sha256: string; // SHA-256 hex of original manifest bytes.
  receipt_sha256: string; // SHA-256 hex of original started receipt bytes.
  observed_at: number; // Integer Unix seconds from the host observation.
  expires_at: number; // > now and <= observed_at +300.
};
```

The importer hash-binds that original observation as a source, compares its
executable and cwd exactly, validates its approved argv and canonical manifest
identity, and preserves the observed argv in the action. It checks both digests,
verifies the original receipt still says started with no final exit/time, and
requires a current matching inventory/source/image. It
does not inspect PID liveness, synthesize a poll, or renew a stale observation.
The native runner session is trusted local audit provenance, not authentication.

Such imports add `local-operation` between review and local, with only the
`local-runner-operation` command-success criterion. Its evidence artifact is the
original started receipt snapshot and its operation names the exact approved
action, original start time and bounded observed expiry. Evaluate this stage to
observe WAIT independently of the failed binding group; this never claims local
or phase completion. The required freshness hook also detects any subsequent
change to the original started receipt. Without a fresh observation this optional
stage is omitted and no WAIT claim is made. Expiry never becomes a pass.

After the full Phase Exit implementation boundary opens, the lead may collect
the snapshot and configure `PHASE_EXIT_HOOK_RUNNER`. Use the actual returned
paths and digest in the Rust lifecycle:

```text
phase-exit contract import --contract CONTRACT --state-dir STATE
phase-exit contract freeze --contract CONTRACT --reviewer REVIEWER --rationale RATIONALE --state-dir STATE
phase-exit contract adopt --contract CONTRACT --adoption ADOPTION --state-dir STATE
phase-exit evidence import --contract CONTRACT --evidence EVIDENCE --state-dir STATE
phase-exit evaluate --contract CONTRACT --evidence EVIDENCE --stage local-operation --state-dir STATE
```

The freeze evaluates the Phase Exit import/mapping, not a third UAR source review.
ADOPTION must contain the actual contract/review digests and explicit operator
authority. Use stage `local` for a snapshot without the optional running stage,
and `release` to evaluate the unmet external release prerequisite. Each collection
creates a new output directory. A later completed original run requires
recollection, an explicit contract revision with invalidations and new evidence;
the old active snapshot and its expiry remain immutable. No existing UAR receipt
or native operation is overwritten, restarted or auto-executed.

## Review provenance and limits

Both original UAR review rounds, round2 packet and receipt are preserved. Round2
reported static PASS for V1-01..04 with weaker native fallback: the canonical
producer identity and distinct-family separation were unproven. Its source and
fixture hashes precede R8. The adopted review criterion establishes preservation
and disposition of that history only; it does not relabel R8 as independently
reviewed or create a third UAR review. The original cap remains exhausted.

The uncomfortable limit: hashes establish which supplied bytes were inspected;
they do not authenticate a human, prove the observations were honestly produced,
or resist a privileged local attacker. The adapter's freshness hook is required
for mutable-root checks, and native host enforcement remains a separate claim.
Source existence is not acceptance. Missing external collaborators remain blocked.

## Source handoff

Owned files: `packages/uar/{types,scenarios,freshness,importer,index,cli}.ts`,
`examples/uar/{README.md,observed-state.json}`, and this document. No UAR file was
written. No unrelated additions or production guards were introduced. Guards
cover actual stale inventory counts, obsolete group prose, active incomplete
receipts, mutable source/fixture files, private output containment, missing
qualified supervision, and evidence identity boundaries.

Current authored state: importer and CLI are ready for the lead's full-phase
inventory. No compiler, test, lint, format, import probe, build, schema validator,
acceptance runner or model call has been run by this author. Type compatibility,
runtime behavior, hook execution, output confidentiality on Windows and the real
UAR import remain unverified until the lead opens the boundary and performs the
planned serialized integration gate.

### R9 repair continuation

The current source extension owns only `packages/uar/{types,index,cli,importer,
freshness}.ts`, this document and `examples/uar/{README.md,observed-state.json}`.
It introduces the explicit inventory reference, retains historical03 reconciliation,
derives exact current ledger criteria, represents a closed repair boundary, binds
mutable waypoint/ledger authority, and derives supervisor availability from actual
artifact-bound positive evidence. The existing adopted contract, receipts and
compiled distribution remain unchanged by this source author. A new collection
is a draft; the host must explicitly revise, invalidate superseded evidence and
adopt before evaluation. Merely collecting later evidence does not change an
adopted head or authorize a runner.

The source defects addressed are the fixed inventory03 selection and19-item
assumption after R9 registration, stale open-boundary snapshots after ledger
changes, and hardcoded unavailable supervisor status despite future genuine
qualification evidence. Added guards bind explicit digest/path identity, exact
ledger item membership and mutable authority. Missing new rows remain false
rather than fabricated. No unrelated production behavior was added.

No compiler, lint, test, schema check, package generation, source review gate,
runner, model call or acceptance invocation was run during this continuation.
The lead must finish the entire repair cohort, record its implementation inventory
and then run the affected serialized integration gate. Type compatibility,
closed-boundary evaluator result, selected inventory04 collection, supervisor
evidence behavior and regenerated distribution remain unverified until then.

Source continuation against the R9 ledger requires both `boundary` and
`validation_scope.boundary` to equal `open`. Either closed or missing authority
leaves implementation incomplete; snapshots and adoption maps retain both values.
The existing exact ledger hash binds either future boundary edit. Source inspection
only was used for this continuation; no verification gate was run.

The release handoff source correction preserves strict local-baseline matching
while allowing published receipts to bind the actual later release commit only
through the existing exact inventory/tree and immutable publication provenance.
The added conflicting-publication guard enforces the existing single release/index
identity boundary across both architecture receipts. No local rerun, executable
P1 action, authority, acceptance criterion or verification command was added.

The later source-only pending-observation correction separates actual canonical
manifests from actual receipt observations. `importer.ts` can capture an absent
receipt and expose only the fixed existing local gate; `freshness.ts` invalidates
that view when the receipt appears. Assertions stay false, and genuinely missing
local evidence records stay absent so the engine can select the existing approved
collection action. Present failed or malformed receipts retain their actual
disposition. Published missing receipts remain without a collection action until
the existing genuine publication provenance requirements can be satisfied.
Inventory07 retains the earlier source state; inventory08 records this completed
authoring plus the lead's corresponding existing real-import fixture branch.
No compiler, package generation, evaluator, runner or test was invoked.
