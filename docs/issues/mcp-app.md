# Follow-up: MCP criteria, evidence and amendment review app

Status: issue draft, excluded from the first delivery. Depends on the MCP server
follow-up; no app implementation is promised by the first delivery.

## Outcome

Provide an MCP app that shows adopted criteria, original evidence references,
source/artifact identity, stage and phase status, permitted next action, failed
receipts and contract history. Use the server's authoritative engine results.

## Required scope

- Make BLOCKED, WAIT, REVIEW_REQUIRED and INVALID visibly distinct from success.
- Show immutable original receipts, repaired evidence and explicit invalidation.
- Compare amendment revisions and the affected criteria before operator adoption.
- Record the adoption action and preserve prior versions; a model proposal cannot
  become authority through a UI default or hidden action.
- Display qualification coverage and JEV preview/model/threshold provenance.
- Keep private evidence and credentials out of app resources and telemetry.

## Acceptance proposal

Adopt a bounded UI phase with explicit accessibility and authorization outcomes.
Exercise an actual supported MCP app host against real server state after full
implementation. Verify stage completion is never rendered as phase completion,
an uncertain result cannot be approved as evidence, and unadopted scope never
appears as a required release gate. The viewer must not invent tests.

The uncomfortable limit: a polished status page can overstate confidence. Every
success display must link to the exact adopted contract and terminal receipts.
