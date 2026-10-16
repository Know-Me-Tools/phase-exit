# Phase Exit for Kimi Code 2.2.0

This package uses the current `kimi.plugin.json` format, not the older Kimi CLI
`plugin.json` tool-wrapper format. The custom catalog is the repository's
root `kimi-marketplace.json`, with `version:"2"`. Add that catalog through
Kimi's `/plugins marketplace` interface, install Phase Exit and enable it.

Hooks run from the plugin root. Fixed commands invoke Node with relative compiled
script paths, no variable command interpolation and no Bash/Python wrapper.
Kimi accepts shell command strings only; the host launch still uses its shell.
Node calls Rust with executable/argv arrays. Node 24.22.0 must be available.
PHASE_EXIT_CONFIG points at the adapter config documented in
docs/typescript-interface.md. Canonical skills are copied during packaging.

Intentional PreToolUse denials and actionable Stop continuations use exit 2.
WAIT and blocked/review/invalid Stop states print the truthful status and exit 0
to yield without bouncing. stop_hook_active and durable fingerprints bound
continuation. Kimi documents timeout/crash errors as fail-open: these hooks are
not a sole security boundary. Rust's exact action authorization must remain in
the trusted production launcher. Native qualification requires host receipts.

Sources (2026-10-16): https://github.com/moonshotai/kimi-code/blob/main/docs/en/customization/plugins.md
and https://github.com/moonshotai/kimi-code/blob/main/docs/en/customization/hooks.md.
