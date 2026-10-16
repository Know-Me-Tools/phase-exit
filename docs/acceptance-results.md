# Observed acceptance results — 2026-10-16

The implementation is not certified. The frozen positive semantic example failed
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
