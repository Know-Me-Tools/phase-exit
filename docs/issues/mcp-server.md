# Follow-up: expose the Phase Exit engine through MCP

Status: issue draft, excluded from the first delivery. No server is implemented
or implied by this document.

## Outcome

Expose the existing engine over stdio and Axum Streamable HTTP using the verified
stable rmcp release available when this follow-up begins. Resolve current official
versions and transport contracts then; do not carry a guessed version forward.

## Required scope

- Typed tools for inspect/evaluate/explain, evidence import, learning, amendment
  proposals and explicit host-authorized adoption.
- Resources for immutable contracts, receipts, schemas and human-readable summaries.
- Preserve exact contract/artifact identities, stage versus phase fields, retry
  bounds, hook vetoes and all six decision states.
- Authenticated HTTP sessions with an operator-owned authorization boundary.
  Model/tool arguments cannot self-grant adoption or execution rights.
- No command execution from criterion content and no credential in responses,
  logs, resources or hook payloads.
- Streaming reports progress without representing an unfinished evaluation as
  successful; cancellation leaves a truthful incomplete receipt.

## Acceptance proposal

After the complete server phase implementation, exercise real stdio and HTTP
clients against the same adopted fixture set used by the CLI. Verify equivalent
decisions, authentication denial, immutable evidence, required-hook failure,
bounded cancellation and no duplicated running operation. Adopt the precise
criteria before implementing; do not add this proposal to the first-pass gate.

The uncomfortable limit: remote exposure increases the trust boundary. Reusing
the engine does not establish network authorization by itself.
