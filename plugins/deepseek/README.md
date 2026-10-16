# Phase Exit for DeepSeek Harness 0.2.0-rc.2

The package is a Cordis bundle: package.json declares dsh.bundle.patch, and
cordis.patch.yml inserts this package. Its compiled main exports name, inject
and apply. Install/enable the bundle with the DeepSeek profile plugin manager.
The host supplies Cordis 4.0.4 and the pinned 0.2.0-rc.2 agent/tools/llm peers.

The tools/pre-execute waterfall performs asynchronous Rust authorization.
ctx.tools.guard then retains any denial monotonically; a later waterfall listener
cannot turn it into permission. A tool skipped by the pre-execute listener is
denied for missing authorization. Tool results release per-call receipts.
agent/pre-step yields on WAIT/BLOCKED/REVIEW_REQUIRED/INVALID. At turn-stopping,
only a new actionable fingerprint may steer a continuation. An aborted host
signal always wins. Phase success requires phase_complete=true.

Set PHASE_EXIT_CONFIG as described in docs/typescript-interface.md. Node 24.22.0
and the Rust executable are separate prerequisites. Skills are bundled as files;
configure the host skill discovery paths to include this package's skills/.
Native host qualification requires separate receipts. A privileged plugin or
same-user process can bypass local policy; hashes record identity, not isolation.

Sources (2026-10-16): https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/subsystems/tools.md,
https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/core/agent/src/runtime-types.ts,
https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md,
and published 0.2.0-rc.2 package declarations.
