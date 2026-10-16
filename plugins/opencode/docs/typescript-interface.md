# TypeScript and native package interface

Phase: `first-uar-example`, Execute. This is the implementation contract; host
compatibility requires separate execution receipts. Node is pinned to 24.22.0 and
TypeScript to 7.0.2. Scripts are TypeScript sources compiled to `dist/`; installed
plugins contain JavaScript and never compile on launch.

## Rust extension bridge v1

Rust invokes `[node, PHASE_EXIT_HOOK_RUNNER, EVENT, CONTEXT_FILE]` with shell
disabled. `PHASE_EXIT_HOOK_RUNNER` points to `dist/packages/hooks/runner.js` (or its
packaged copy). Context is JSON:

```json
{
  "schema_version": 1,
  "config_path": "/absolute/hooks.json",
  "config_base_dir": "/absolute/original-config-directory",
  "config_sha256": "64 lowercase hexadecimal characters",
  "state_dir": "/absolute/state",
  "invocation_id": "unique-id",
  "payload": {"contract_digest": "digest", "stage": "implementation"}
}
```

The config digest is SHA-256 of exact file bytes, supplied by the frozen contract.
Rust supplies `config_path` as its immutable config snapshot and `config_base_dir`
as the original adopted config's absolute parent directory. Paths to modules
resolve relative to that explicit base. The optional base field defaults to the
config file's parent for direct callers; when present it must be absolute.
Config has `schema_version:1`
and ordered `hooks`. Each hook contains `id`, `event`, `module`, `sha256`,
`input_schema:"phase-exit/hook-input/v1"`,
`output_schema:"phase-exit/hook-output/v1"`, `timeout_ms` (1..60000), `required`, and `env_allowlist` (array of environment
variable names). Valid events: `contract.collected`, `contract.frozen`,
`evidence.imported`, `evaluation.before`, `judgement.received`,
`decision.finalized`, `amendment.proposed`.
The total declared timeout for one event cannot exceed 45000ms, fitting inside
Rust's 60000ms outer runner deadline. Unknown schema IDs fail before execution.
Published schemas live in `schemas/hooks-{config,input,output}.schema.json`;
runtime validators enforce their keys and additional constraints.

Each module is a self-contained Node ESM JavaScript file exporting
`async function run(input)`. It receives `{schema_version:1,event,invocation_id,
payload}`. The return shape is `{schema_version:1,veto?:boolean,reason?:string,
evidence_proposals?:object[],amendment_proposals?:object[]}`. Proposals never
import evidence, adopt contracts, alter predicates or grant action authority.

Runner stdout is exactly one JSON document:
`{schema_version:1,event,blocked:boolean,results:HookReceipt[],
evidence_proposals:object[],amendment_proposals:object[]}`.
Receipts contain `id`, `status` (`ok`, `veto`, `failed`), `required`, and `message`.
Exit 0 means runner executed, **including veto outcomes**; Rust MUST inspect
`blocked`. Exit 14 denotes invalid bridge/config/integrity/recursion input and
must block, never silently continue. Required timeout/error/malformed result and
any explicit veto set blocked monotonically. Optional failure only logs a
receipt. Hook stdout/stderr is suppressed; payload and env values are not logged.
The runner appends JSON receipts to `state_dir/hook-receipts/` with exclusive
creation. State directory must already be the trusted host's chosen directory.

Config bytes and every module digest are captured before executing any hook.
Modules run from those captured bytes, not a second path lookup. Child processes
receive only explicitly allowed environment variables, excluding credential-like
names and `NODE_OPTIONS`, and `PHASE_EXIT_HOOK_ACTIVE=1`. Recursive runner or
engine calls must reject this marker. Module integrity proves identity, not
isolation against hostile code running as the same OS user. Modules must be
self-contained; relative imports from an embedded data URL are unsupported.
The timeout kills the direct child, without Unix process-group assumptions.

## Harness bridge

`dist/packages/harnesses/cli.js HOST EVENT` reads one bounded host JSON document
from stdin. HOST is `claude`, `codex`, or `kimi`; EVENT is `stop` or `tool`.
Config comes from PHASE_EXIT_BINARY, PHASE_EXIT_CONTRACT, PHASE_EXIT_EVIDENCE,
PHASE_EXIT_STAGE and PHASE_EXIT_STATE_DIR. Optional PHASE_EXIT_CONFIG identifies
a JSON file with `schema_version:1` and fields `binary`, `contract`, `evidence`,
`stage`, `state_dir`, and optional `bindings`. Environment overrides fields. Rust receives exact argv
from PROTOCOL.md. Tool authorization uses the Rust owner's documented request.

Only `phase_complete:true` establishes phase success. WAIT yields. BLOCKED,
REVIEW_REQUIRED and INVALID stop and display truthfully. CONTINUE and completed
stages with a next authorized action request at most one continuation per
actionable fingerprint per session and respect `stop_hook_active`. No adapter
executes the proposed next action itself.

## Build and install

`npm run build:no-tests` invokes the TypeScript compiler only.
`npm run package:no-tests` runs compiled `dist/scripts/package.js`, copying
compiled runtime, canonical skills (including references), Apache LICENSE,
interface documents and native package sources into `artifacts/plugins/HOST/`.
Root marketplace manifests are copied to artifacts/.claude-plugin/marketplace.json,
artifacts/.agents/plugins/marketplace.json and artifacts/kimi-marketplace.json,
with sources under ./plugins/. Package manifest versions are preserved exactly.
`node dist/scripts/install.js HOST DESTINATION` copies that native artifact tree
to a new destination. No symlinks, shell pipelines, Unix utilities, dependency
installation or test execution occurs in packaging/install. Lead runs all of
these only after the implementation inventory is complete. CLI binary is
configured separately with PHASE_EXIT_BINARY; credentials never enter package
configuration.

`node dist/scripts/install-skills.js DESTINATION_SKILL_ROOT` installs exactly the
canonical `phase-contract` and `phase-exit` directories into a supplied discovery
root such as `/Users/your-name/.codex/skills`. `npm run install:skills --
DESTINATION_SKILL_ROOT` invokes the same compiled script. It copies all references
using Node filesystem APIs, creates no symlinks, and never overwrites an existing
file. Identical directory trees return `already_installed`; differing trees
return `refused` and exit1 without installing either pending skill. Success
returns `installed` or `already_installed` for each skill and exit0. The script
emits one JSON receipt with schema_version and per-skill path/status/reason.
Unsupported symlinks or file types are refused. An interrupted new copy can
leave a partial newly created directory, which a subsequent invocation refuses;
the operator must explicitly remove it before retrying. Native package copying
and canonical local skill installation are separate operations.

`node dist/scripts/with-jev-key.js [--profile FILE] -- EXECUTABLE ARGS...` prefers
an existing process JEV_API_KEY, otherwise reads a single literal assignment from
the designated profile (default homedir/.bash_profile). It never executes the
profile, evaluates substitutions, prints the key or writes it to disk. NODE_OPTIONS
is removed from the child environment. It passes
the value only through the launched process environment. Its child uses shell:false.

## Exact native tool bindings

The optional `bindings` list contains `{tool_name,input_sha256,request}`. The input
digest is SHA-256 over canonical sorted-key JSON of the host's complete tool input.
`request` is `{schema_version:1,action_id,kind,executable,argv,cwd}` using Rust's
exact action shape; kind is implementation, gate, publication or repair. Tool cwd
must equal the adopted action cwd. `action authorize --contract FILE --evidence
FILE --request FILE --state-dir DIR` must return the matching action ID,
`authorized:true`, a valid decision, and exit0. The adapter never launches that
action. Only the host continues its already proposed tool call.

An operator must review the binding's exact tool input against the action. This
is an explicit local policy mapping, not a shell parser: no substring matches,
invented argv decoding or approval inferred from model prose. Unbound command,
shell, exec, terminal and run_code surfaces are denied, as are inputs carrying
command/cmd/executable fields. Other tools are outside this command enforcement
coverage. Paths and hashes are audit identity, not privileged-user protection.
Changing bindings is a trusted host configuration operation. Never accept binding
definitions from a model tool input.

## Native compatibility and sources

Claude 2.1.301: native `.claude-plugin/plugin.json`, repository marketplace,
exec-form command/args hooks with PreToolUse failure blocking.
Codex 0.163.0: native `.codex-plugin/plugin.json` and
`.agents/plugins/marketplace.json`; trusted enabled hooks required. Its fixed
Node bootstrap uses documented PLUGIN_ROOT; command strings are a host limitation.
Kimi Code 2.2.0: `kimi.plugin.json`, version 2 custom catalog, fixed Node command
strings executing with the plugin root cwd. Kimi's crash/timeout behavior is
fail-open and cannot be the sole execution boundary.
OpenCode 2.0.31: Plugin.define and ctx.tool.hook("execute.before"), session context
gate and idle observation. Idle events do not carry a reliable operator stop flag,
so automatic prompting from idle is deliberately unavailable. DeepSeek
0.2.0-rc.2: Cordis4.0.4 bundle using pre-execute plus monotonic tools.guard,
pre-step admission and abort-aware turn-stopping steering.

The source reads and registry retrieval on 2026-10-16 confirmed Node24.22.0,
TypeScript7.0.2, @types/node24.10.1, all five host pins, @opencode/plugin2.0.31,
@deepseek-ai/cordis4.0.4 and the agent/tools/llm0.2.0-rc.2 packages. This is API
and version research; it is not execution evidence. Context7 supplied official
documentation, and published package declaration files resolved stale examples.

- https://nodejs.org/docs/latest-v24.x/api/child_process.html
- https://nodejs.org/dist/index.json
- https://registry.npmjs.org/typescript/7.0.2
- https://code.claude.com/docs/en/hooks
- https://code.claude.com/docs/en/plugin-marketplaces
- https://github.com/openai/codex/blob/main/codex-rs/config/src/hook_config.rs
- https://github.com/openai/codex/blob/main/codex-rs/core-plugins/src/manifest.rs
- https://github.com/openai/codex/blob/main/codex-rs/core-plugins/src/marketplace.rs
- https://github.com/openai/codex/blob/main/codex-rs/hooks/src/engine/discovery.rs
- https://github.com/anomalyco/opencode/blob/dev/services/www/src/docs/content/build/plugins/index.mdx
- https://github.com/moonshotai/kimi-code/blob/main/docs/en/customization/plugins.md
- https://github.com/moonshotai/kimi-code/blob/main/docs/en/customization/hooks.md
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/tools.md
- https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/agent/src/runtime-types.ts
- https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md

## Implementation handoff

Source ownership: packages/hooks, packages/harnesses, packages/distribution,
scripts/package.ts, scripts/install.ts, scripts/install-skills.ts,
scripts/with-jev-key.ts, plugins native
manifests/readmes/catalogs, package.json, tsconfig.json and schemas/hooks*.json.
Compiled plugin runtime and skill copies are produced only by the lead's final
serialized packaging gate. Required checks remain unexecuted while the full
implementation boundary is closed. No dependency install, compiler, lint, tests,
format check, schema validation, build or native host probe was run by this author.

The uncomfortable limit: host enforcement depends on enabled and trusted hooks.
Package shape alone cannot certify a host installation or universal interception.
Codex hook packages make no public plugin-directory approval claim.
