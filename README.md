# Phase Exit

Phase Exit makes a bounded completion decision against an explicitly adopted
contract. A Rust engine checks artifact identity and evidence predicates; optional
TypeSafe **`jev-1.14.0` preview** judgments answer narrowly defined semantic
questions. Node hooks and Agent Skills expose the decision to coding hosts.

**Preview implementation; acceptance is not complete.** The frozen JEV calibration
returned support 0.80 for its positive example against the required 0.95. UAR
adoption is withheld. See [observed results](docs/acceptance-results.md).
The authoritative status is [.phase-exit/project-phase.json](.phase-exit/project-phase.json).

## What the decision means

| Verdict | Response |
| --- | --- |
| `COMPLETE` | Report stage completion; report phase completion only when `phase_complete` is true. |
| `CONTINUE` | Perform only the returned approved action ID. |
| `WAIT` | Yield to the matching operation already running. |
| `BLOCKED` | Stop automation and hand off the unavailable external prerequisite. |
| `REVIEW_REQUIRED` | Stop for ambiguity, unknown impact or exhausted attempts. |
| `INVALID` | Stop on malformed or inconsistent contract/evidence identity. |

The engine reads receipts. It never runs an acceptance command embedded in a
contract, invents a test, adds a release requirement, or accepts a model narrative
as a replacement for runtime observations.

## Components

- `crates/`: reusable Rust engine and JSON CLI.
- `schemas/`: versioned contract, evidence and lifecycle formats.
- `skills/phase-contract` and `skills/phase-exit`: canonical Agent Skills.
- `packages/hooks`: trusted Node extension modules and immutable hook receipts.
- `packages/harnesses`, `plugins`: native host integrations.
- `packages/uar`, `examples/uar`: read-only import of the first real KBD example.
- `tests`, `fixtures`: bounded acceptance program and controlled error cases.
- `docs/issues`: deferred MCP server and app proposals.

## Use and installation

Read [the CLI interface](docs/rust-interface.md) for exact commands and JSON shapes,
[Node packaging](docs/typescript-interface.md) for local installation, and
[the capability matrix](docs/capabilities.md) before enabling hooks. Node **24.22.0**
and TypeScript **7.0.2** are pinned. Installed packages run compiled JavaScript.

Contract lifecycle is `import`, `freeze` after review, then explicit `adopt`.
`evaluate` requires the adopted contract, evidence file, stage ID and state
directory. Structured results go to stdout, diagnostics to stderr. Exit codes
are 0 (complete), 10 (continue), 11 (wait), 12 (blocked), 13 (review required),
and 14 (invalid). An action is authorized by exact executable, argument array,
working directory and action identity; the calling host remains responsible for
enforcing that result before execution.

Use `JEV_API_KEY` in the process environment. The optional Node launcher reads only
a designated literal assignment from a profile; it does not execute that profile.
Never put a credential in a contract, hook configuration, example or receipt.
See [security and authority](SECURITY.md).

### Reproduce the local build

With the pinned Node installed and Rust available, use these separate commands:

```text
cargo build --locked --workspace
npm ci --ignore-scripts --no-audit --no-fund
npm run build:no-tests
npm run package:no-tests
```

The CLI is `target/debug/phase-exit`; installed hooks use an explicit absolute
`PHASE_EXIT_BINARY` path. Native packages are generated under `artifacts/plugins/`.
`node dist/scripts/install.js HOST DESTINATION` installs one package into a new
directory. `node dist/scripts/install-skills.js SKILL_ROOT` installs the two
canonical local skills, preserves identical installs and refuses differing ones.
Enable and trust native hooks through the selected host's documented interface.

The literal-profile launcher is `node dist/scripts/with-jev-key.js -- EXECUTABLE
ARGUMENTS`. It defaults to the designated assignment in `~/.bash_profile`, prefers
an existing process key, and accepts `--profile FILE` before `--`. A profile is
read as data. Shell substitutions and profile execution are unsupported.

## First delivery boundary

Acceptance targets this Mac and the UAR v1.1.1 phase. Windows qualification,
legacy host versions, MCP implementation and public-directory approval are
excluded. Native package contents, fixture validation and execution inside an
actual host are separate claims. No automatic update mechanism is installed.

UAR's missing genuine qualified-supervisor setup is a required external blocker.
A truthful blocked case demonstrates stopping behavior; it is not a completed
UAR release. Existing UAR acceptance programs and original receipts are preserved.

## The uncomfortable limit

Neither probability, schemas, hashes nor a skill prove the absence of every bug.
A privileged process can bypass local checks. Installed hooks are trusted code,
not a Node sandbox. See [research](docs/research.md), [the approved plan](docs/implementation-plan.md)
and [contributing](CONTRIBUTING.md). Licensed under [Apache-2.0](LICENSE).
