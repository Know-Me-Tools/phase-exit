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

## Adopted terminal-receipt calibration

The operator adopted the reviewed v2 amendment after the original calibration
failed. The original `fixtures/semantic-examples.json` and responses remain
historical. `fixtures/semantic-examples-v2.json` projects the reviewed structured
terminal observations and question. The separate adoption and mapping records
under `.phase-exit/adoptions/` bind the original, proposal, review and new fixture
bytes without circular hashes. The runner checks those identities before use.

The adopted model remains jev-1.14.0 preview; support>=0.95 and contradiction<=0.05
remain unchanged. Each materially changed example permits one new sample under
the same bounded transient retries. The expected incomplete example passes its
calibration class check only when the engine returns SEMANTIC_UNCERTAIN; it never
establishes completion of that example's command criterion. Unexpected uncertainty
or a service/integrity error fails calibration. There is no tuning to the UAR result.

TypeScript compilation and the selected `jev-live-frozen-calibration` plus
`real-uar-import` cases are affected by this mapping. The accompanying real-use
adapter repair preserves the actual relative manifest argv after verifying its
canonical destination. Regenerate its packaged JavaScript and exercise the
existing real active-operation path with a fresh native-host observation. The
Rust engine, protocol, hooks, installers and native hook sources are unchanged. Their previously
passing observations carry with those exact source/artifact identities; this
mapping does not upgrade any existing UAR product receipt. No Rust build or
passing acceptance case is rerun merely because the calibration fixture changed.

The first v2 run passed calibration and exposed the UAR freshness defect. Its
calibration result carries to a UAR-only rerun through an explicit retained proof:
original terminal program receipt hash, observation-file hash, three original
live judgment hashes, exact binary and adopted fixture/adoption/mapping/amendment
identities. `PHASE_EXIT_CALIBRATION_PROOF` selects this proof for
`PHASE_EXIT_ACCEPTANCE_CASES=real-uar-import`. Verify the three adopted classes and
their live cached responses from those bytes; do not call JEV or rerun calibration.
The failed original program and superseded original0.80 calibration remain history.

Freshness compares the current UAR files to captured import-time hashes. Inventory
acceptance separately compares those captured bytes with the approved inventory
expectations. An existing mismatch stays an unmet criterion; a later mutation
vetoes evaluation with a bounded cause code. Neither condition becomes a pass.
