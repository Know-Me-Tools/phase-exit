# Observed acceptance results — 2026-10-16

The bounded first-pass Mac program now passes through the retained original27
passing cases, the adopted v2 calibration and the repaired real UAR gate. The
actual running UAR operation also evaluated to WAIT. This scope does not certify
every native host or establish UAR release readiness. See the current receipt
`.phase-exit/acceptance/completion.json`; original observations follow.

The original frozen positive semantic example failed
at support 0.80, contradiction 0.02 against support >=0.95 and contradiction <=0.05.
The engine returned REVIEW_REQUIRED. No probability, model or example was changed
to obtain a pass. The operator authorized preparation of an amendment for review,
explicitly withholding adoption.

## Commands and observations

Commands ran locally and serially after recorded implementation inventories.
`node` below was the verified Node24.22.0 executable; the compiler package was
TypeScript7.0.2. Private receipts retain absolute executable/argument paths.

| Command or gate | Observed result |
| --- | --- |
| `cargo build --locked --workspace` | Exit0; core and CLI built,3.75s after initial repairs |
| `node node_modules/typescript/bin/tsc -p tsconfig.json` | Exit0 after the complete compiler/review repair cohort |
| `node dist/scripts/package.js` | Exit0; five native package trees generated |
| `node dist/scripts/with-jev-key.js -- NODE dist/tests/acceptance.js` | Exit1;27/29 cases passed; calibration failed; UAR adoption withheld |
| Affected calibration continuation using original cache | Exit1; contradiction and uncertainty matched; supported result remains0.80 |
| Claude2.1.301 with `--plugin-dir plugins/claude` and hook events | Exit0; native Stop invoked, hook exit0, BLOCKED/phase incomplete emitted |
| `node dist/scripts/install-skills.js /Users/gqadonis/.codex/skills` | Exit0; both canonical skills and references installed without overwrite |

The original passing cases cover evidence states, stage/phase distinction,
authorization, attempts, amendments, learning, required/optional hooks, credential
removal, controlled JEV errors, direct host adapter behavior and five package
installations. They do not establish live calibration or every host's interception.
The UAR importer read the real source records and reconciled19 items, six groups,
76 image identities and four native supplements before adoption was withheld.

## Review and limits

The initial isolated review found three critical defects. The final corrective
review found those resolved and one medium receipt-refresh defect in the acceptance
continuation. Its repair follows the unique current receipt and checks the cached
decision as well as the attempt count. No third implementation review is authorized.
Fresh-context isolation was used; cross-model independence remains unverified.
The full final report's anti-sycophancy score was0.017857, with one low verbosity
classification and no mandatory correction.

## Remaining blockers

- Frozen calibration requires an explicitly reviewed and adopted revision before
  any materially changed semantic evaluation. The original failure remains valid.
- Real UAR contract adoption and evaluated release result are withheld.
- UAR's original acceptance operation remains owned by its existing runner; no
  duplicate build or source repair was started during that operation.
- Genuine qualified-supervisor evidence is still unavailable and mandatory.
- Native lifecycle execution beyond the recorded Claude Stop observation remains
  unverified. Packaging is a narrower claim.

The uncomfortable outcome: working stop behavior does not turn this incomplete
delivery into a completed UAR release. No v1.1.1 publication is authorized.

## Subsequent operator adoption

The operator subsequently adopted the reviewed terminal-receipt amendment and
authorized committing and pushing the Phase Exit preview before using it. The
separate record is `.phase-exit/adoptions/calibration-terminal-receipts-v2.json`.
The original proposal, reviews and failed probabilities above remain historical
artifacts. Its new calibration mapping and affected gates are pending. Model and
thresholds are unchanged. UAR release publication still requires every mandatory
gate; preview source publication does not establish certification.

## Completed affected gates and real use

Inventory05 preceded the adopted mapping/actual-argv checks. Live calibration
acceptance04 observed positive support0.98/contradiction0.01, negative0.01/0.99,
and expected incomplete0.01/0.20. All three matched their adopted classes. Its
UAR check exposed a freshness bug; no new semantic samples were taken afterward.

Inventory06 preceded the full freshness/carry repair checks. TypeScript
compilation and package generation exited0. UAR-only acceptance05 exited0 using
the original hash-bound passing calibration proof. The real release evaluation
returned BLOCKED with the supervisor prerequisite and implementation-L1/R7 unmet.
The active snapshot preserved the original relative manifest argv and returned
WAIT for session83623, phase_complete=false, next_authorized_action=null.

The fixes preserve captured evidence separately from expected inventory acceptance,
expose bounded freshness causes, and allow an affected gate to reuse already
passing calibration evidence. No Rust engine or model/threshold change was needed.
No broad passing gate or source review was repeated. Both original review rounds
and subsequent in-place repair receipts remain in history.

Phase Exit's scoped first pass is complete. UAR v1.1.1 remains incomplete: the
original acceptance operation is nonterminal, its complete failure cohort is not
available, and genuine qualified-supervisor evidence is still missing. No UAR
source, candidate, production resource, tag or published release was changed.

## UAR dogfood repair — 2026-10-16

Whole authoring inventories UAR05 and Phase Exit08 preceded the first affected
compiler gate. One TS2322 cohort was corrected in full and source inventory09
recorded before rerun. The compiler and five-package generation exited0. The
sole affected real-uar-import case passed against real UAR inventory05 with the
original hash-bound v2 calibration proof; JEV was not resampled. The actual fresh
missing-receipt local decision is CONTINUE with uar-local-acceptance; release is
BLOCKED and phase_complete=false. Original failure and scoped passing receipts
are in .phase-exit/acceptance/repair6-*.json. This does not certify UAR or repeat
unchanged native host coverage. The acceptance-state adoption is not live UAR
operator adoption.
