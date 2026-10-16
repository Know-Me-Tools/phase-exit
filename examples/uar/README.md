# UAR example

`observed-state.json` is a sanitized transcription of actual UAR planning state
on 2026-10-16. It is not executable evidence and does not contain a fictitious
passing receipt. UAR's private logs and paths remain outside this repository.

The complete 76 image identities and 4 native supplements are exported by
`packages/uar/scenarios.ts`. The importer derives counts from these identities,
not the historical inventory's stale numeric count.

The earlier observation is retained as history. Terminal local-02 later failed
all six groups and R9 reopened the repair boundary. The importer derives the
current implementation set from the ledger, including pending repair items.
Historical inventory03 cannot prove that newer set complete.

After the Phase Exit implementation boundary has opened and its runtime has
been built, collect a new private snapshot with the supplied UAR checkout root:

```text
node dist/packages/uar/cli.js --root /path/to/uar --output /path/to/private/new-import
node dist/packages/uar/cli.js --root /path/to/uar --output /path/to/private/another-import --inventory EXPLICIT_PHASE_INVENTORY_PATH --inventory-sha256 EXACT_BYTE_SHA256_HEX
```

The parent output directory must already exist. The final directory must be new
and outside UAR. This creates a draft contract, evidence, explicit adoption map,
source snapshots and freshness hook. It never runs UAR's Python acceptance
program, Docker, Cargo, GitHub, or production operations. The only subprocesses
are read-only Git identity queries.

The snapshot is private even when the input receipts have already been redacted.
Do not add generated snapshots to a public repository. Supply a real operator
reference using `--adoption-reference` only after the mapping has been approved;
that reference does not replace Rust's separate exact-digest adoption record.
Omitting the inventory selection retains historical03 for reconciliation. Supply
the new inventory and exact digest explicitly after whole-cohort implementation.
No automatic latest selection, revision adoption or reevaluation takes place.

See `docs/uar-adapter.md` for exports, provenance, stage semantics and limitations.
