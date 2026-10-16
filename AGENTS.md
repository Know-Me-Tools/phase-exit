# Phase Exit operating contract

Read `.phase-exit/project-phase.json` before work. Follow the approved plan in
`docs/implementation-plan.md`. This first phase targets the current Mac and the
UAR v1.1.1 example. Windows qualification and MCP implementations are excluded.

Finish ALL production code, contracts, fixtures, skills, adapters and required
documentation before ANY build, compiler, lint, test, schema validator, packaging
validation, independent implementation review or product API probe. Source reads
and dependency documentation/registry metadata retrieval are allowed. The lead
records a complete inventory before opening the boundary. On observed failures,
close the boundary, repair the whole observed cohort, record a renewed inventory,
then rerun only affected gates. One build writer. Never clean caches to bypass
contention. GitHub Actions may publish artifacts, never run product checks.

Use a team, exclusive file ownership, and small written handoffs. Preserve others'
changes. Rust owner: Cargo.toml, crates/, Rust schemas and docs/rust-interface.md.
TypeScript owner: packages/hooks/, packages/harnesses/, packages/distribution/,
scripts/, plugins/, package.json, tsconfig.json and hook schemas. UAR adapter
teammate: packages/uar/, examples/uar/, docs/uar-adapter.md. Lead: everything
else, including tests/, fixtures/, canonical skills and phase state.

Every script/hook is authored in TypeScript 7.0.2 and runs on Node 24.22.0. Ship
compiled JavaScript. No Bash/Python wrappers, Unix utilities, shell pipelines,
symlink installation or Unix process-group assumptions. Spawn executable/argv
arrays with shell:false. Native host launch-string limitations must be disclosed.

The only model is jev-1.14.0 preview. No alias/fallback. Credentials stay in process
environment and never enter logs, hooks, artifacts or Git. New scope requires
explicit adoption. Missing evidence never passes. A blocked phase stops automation
without claiming success. Do not modify UAR while its acceptance run is active.

Keep .prometheus history tracked and append-only. Native harness compatibility
claims require actual evidence; package contracts alone are not host validation.

Load prometheus-rust-workspace and rust-best-practices before Rust implementation;
use rust-async-patterns for asynchronous transport. Repository/user constraints
override skill suggestions for early validation. No tool or hook may manufacture
approval authority or treat same-user file hashes as protection against an attacker.
