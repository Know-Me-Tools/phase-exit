---
name: phase-exit
description: Evaluate an adopted phase contract against original evidence, authorize only bounded existing next actions, and stop on completion, active work, blockers or uncertainty. Use before ending a KBD phase, continuing an acceptance loop, or claiming release readiness.
license: Apache-2.0
compatibility: Requires the Phase Exit Rust CLI with an adopted contract, evidence records and trusted state directory. Semantic evaluation uses jev-1.14.0 preview. Native hook behavior requires the matching enabled host package.
metadata:
  version: "0.1.0"
  authority: "adopted-contract"
---

# Phase exit

Read the current waypoint and adopted contract. Identify the evaluated stage and
artifact identity before evaluating. Import observations, not producer narratives.
Use the installed CLI interface and structured decision; do not infer success
from a stopped assistant, empty log or a previously passing different artifact.

Read [decision handling](references/decisions.md) for action and evidence rules.
Always report `evaluated_stage`, `stage_complete`, `phase_complete`, unmet IDs,
evidence references and the exact `next_authorized_action`.

| Decision | Required response |
| --- | --- |
| COMPLETE | Report stage success. Report phase success only if phase_complete is true. |
| CONTINUE | Authorize and perform only the returned existing action, respecting its boundary. |
| WAIT | Yield to the matching running operation; do not start another. |
| BLOCKED | Stop automation with the concrete external prerequisite and handoff. |
| REVIEW_REQUIRED | Stop for ambiguity, unknown impact or exhausted allowance. |
| INVALID | Stop; do not authorize execution from inconsistent evidence or authority. |

Missing or stale evidence is not itself a product defect. It permits only an
already approved collection action after full-phase implementation. Finish the
entire observed repair cohort and renew the inventory before retesting affected
gates. Do not add tests or requirements to make an exit condition easier to answer.

JEV is a supplementary semantic judge. It cannot waive a deterministic failure,
missing collaborator or absent runtime receipt. Uncertainty stops; it never
authorizes repeated sampling until success.

The uncomfortable limit: a reproducible contract decision does not prove every
possible defect absent. State unverified host coverage and external blockers.
