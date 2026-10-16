# Phase Exit for Claude Code 2.1.301

Add the repository root as a local Claude marketplace, then
install `phase-exit@know-me-tools-phase-exit`. For packaged archives, use the
`artifacts/` marketplace directory. Both contain `.claude-plugin/marketplace.json`
with source `./plugins/claude`. The native manifest inside that package is
`.claude-plugin/plugin.json`; hooks live in `hooks/hooks.json` and skills in
`skills/`. The builder populates compiled runtime and canonical skills.

Set PHASE_EXIT_CONFIG to an absolute adapter JSON path, or set the individual
PHASE_EXIT_BINARY, CONTRACT, EVIDENCE, STAGE and STATE_DIR variables. See the
repository's docs/typescript-interface.md for exact fields and action bindings.
The Rust executable is installed separately. Node 24.22.0 must be on PATH.

Stop requests one continuation only when an authorized next action exists and
the fingerprint is new. WAIT and blocked/review/invalid outcomes stop truthfully.
PreToolUse denies command surfaces without an exact reviewed action binding.
Claude's exec-form `command` plus `args` avoids shell parsing. `onFailure:block`
applies to tools; stop crashes must not bounce a blocked phase indefinitely.

Package metadata targets 2.1.301. Native host qualification is reported separately;
successful copying or schema loading is not a complete host integration test.
Source: https://code.claude.com/docs/en/hooks and
https://code.claude.com/docs/en/plugin-marketplaces (retrieved 2026-10-16).
