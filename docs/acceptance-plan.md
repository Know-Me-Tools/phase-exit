# Bounded acceptance program

This is the approved program to run **after** the complete implementation inventory.
Authoring this file is not permission to execute any gate. No Windows matrix,
benchmark, legacy-host check or unrelated UAR test belongs to this delivery.

## Serialized gates

1. Build the local Rust binary and compiled Node24.22.0/TypeScript7.0.2 JavaScript,
   generating the Cargo and npm lockfiles without package lifecycle scripts.
2. Package the five native host distributions and canonical skills. Exercise the
   local installer into isolated directories. Inspect package contracts and
   archive content; do not claim a real host ran merely because its manifest exists.
3. Run tests/acceptance.ts through the compiled JavaScript against the real binary,
   temporary filesystem, Node hook children and real TypeSafe API. Controlled
   transport fixtures cover semantic/error responses impractical to induce live.
4. Import the actual UAR records read-only. Evaluate an explicitly adopted local
   snapshot and retain the decision without overwriting original records. Observe
   running work as WAIT and genuine unavailable qualification as BLOCKED.
5. Exercise the installed local host interface that is actually available. Record
   its name/version and exact event route; leave other hosts unverified.

## Cases fixed before execution

| Area | Required observation |
| --- | --- |
| Evidence | Complete command, failed command, missing, stale, tampered, exact running operation |
| Stages | Implementation and gate success cannot imply unfinished publication success |
| Authority | Exact authorized action; expanded arguments denied; proposal does not adopt; explicit valid revision does |
| Amendments | Changed criterion and dependent evidence invalidated; prior failure retained |
| Attempts | Distinct failed attempts exhaust adopted allowance; no unlimited repair loop |
| Hooks | Required error, explicit veto, optional failure, recursion, credential removal |
| JEV | Supported, contradicted, uncertain; malformed answer/model mismatch rejected; no semantic resampling |
| Packages | Canonical skills, compiled JS, host-native manifests, isolated install and bounded stop behavior |
| UAR | Six groups/76 image IDs/four source supplements;19-vs17 mapping; original hashes; truthful blocker |

Each gate records exact executable/argv, terminal exit and stdout/stderr hashes.
Each case records expected and observed status. Continue collecting independent
failures within the one program; do not repair and retest individual cases while
the cohort is still being collected. Preserve the whole receipt on failure.

The semantic examples are frozen in fixtures/semantic-examples.json before the
first call. Thresholds are support>=.95 and contradiction<=.05. A failed calibration
requires review, not tuning against the UAR result. At most two transient retries;
no retry for an inconclusive semantic answer.

## Review bounds

An independent reviewer receives completed artifacts, the approved criteria and
the diff without producer history. One initial review and at most one corrective
review. Unresolved critical findings stop delivery at the cap. No new UAR review
round is authorized by this separate tool review.

The uncomfortable limit: controlled transport failures prove error handling, not
live service reliability. Actual live judgments and CLI/filesystem receipts must
remain distinguishable from controlled cases.

## Affected calibration continuation

PHASE_EXIT_ACCEPTANCE_CASES selects only named affected cases. For an interrupted
calibration cohort, PHASE_EXIT_CALIBRATION_RESUME_ROOT reuses existing contracts,
evidence and semantic cache from the original run. It collects every remaining
frozen example even if an earlier example fails. It never creates a fresh sample
for an unchanged earlier example, lowers thresholds or overwrites the original
program receipt. A continuation receipt is partial coverage and must be read
alongside the original receipt; it does not recertify passing gates.
