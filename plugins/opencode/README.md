# Phase Exit for OpenCode V2 2.0.31

This native ESM package exports Plugin.define from @opencode/plugin 2.0.31.
Its package main points at compiled runtime; enable this package using OpenCode's
plugin configuration. The host must provide the pinned peer dependency. Runtime
does not invoke a TypeScript compiler. PHASE_EXIT_CONFIG points to the adapter
configuration documented in docs/typescript-interface.md.

The execute.before domain hook authorizes exact reviewed command bindings; a
denial throws before execution. A session context hook stops model work on WAIT,
BLOCKED, REVIEW_REQUIRED or INVALID. Session idle events record the evaluation
and print truthful completion state. Public idle events do not reliably separate
user interruption from ordinary completion, so this package never automatically
prompts from idle. This explicitly limited continuation capability preserves
the user's stop. The CLI and skills can show the next approved action.

Tool hooks are ordered/mutable host extensions; this package does not assert a
monotonic policy boundary against other privileged plugins. Independently enforce
Rust action authorization in trusted launchers. Native qualification is separate.
Bundled skill copies are available under skills/ for host skill configuration.

Sources (2026-10-16): @opencode/plugin 2.0.31 published declaration files and
https://github.com/anomalyco/opencode/blob/dev/services/www/src/docs/content/build/plugins/index.mdx.
