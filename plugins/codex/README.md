# Phase Exit for Codex 0.163.0

The repository marketplace is `.agents/plugins/marketplace.json`; its
native package is `plugins/codex/.codex-plugin/plugin.json`. Packaged artifacts
preserve the same marketplace-relative tree. Install through the Codex plugin
manager and explicitly trust/enable its hooks. Trust state is managed by Codex
in `hooks.state`; this installer never manufactures trusted hashes or approval.

Set PHASE_EXIT_CONFIG to an absolute adapter config path. Required fields and
operator-reviewed exact command bindings are in docs/typescript-interface.md.
Node 24.22.0 and a separately installed Rust executable are required.

Codex 0.163's hook command schema exposes a command string, without exec-form
args. Launch strings are fixed Node bootstrap expressions; paths are read from
the documented PLUGIN_ROOT environment inside Node. No shell utility, pipeline
or interpolated tool input appears. The host may itself use a shell to launch
that fixed string. All subsequent calls use executable/argv and shell:false.

Stop is bounded by durable actionable fingerprints and stop_hook_active. WAIT
yields; blocked/review/invalid outcomes stop truthfully. Command hooks deny an
unbound command surface. Coverage depends on trusted enabled hooks and cannot
prevent same-user modification of configuration or execution outside the host.

This repository marketplace is not an approved listing in the public Codex
plugin directory. Native host qualification is a separate evidence claim.
Sources (2026-10-16): https://github.com/openai/codex/blob/main/codex-rs/core-plugins/src/manifest.rs,
https://github.com/openai/codex/blob/main/codex-rs/core-plugins/src/marketplace.rs,
https://github.com/openai/codex/blob/main/codex-rs/config/src/hook_config.rs,
https://github.com/openai/codex/blob/main/codex-rs/hooks/src/engine/discovery.rs.
