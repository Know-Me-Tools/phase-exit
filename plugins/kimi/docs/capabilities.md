# Capability and qualification matrix

Status: **bounded first-pass Mac acceptance passed**. The original program's27
passing cases carry for unchanged components; the adopted live calibration and
affected real-UAR-import gate now pass. Original failures remain preserved.
Real UAR active-operation evaluation also returned WAIT with exact observed argv.
A shipped manifest is not proof that a host loaded or enforced it.

| Surface | Pinned target | Package | Fixture validation | Actual host execution |
| --- | --- | --- | --- | --- |
| Rust CLI / engine | local Mac | Built | Bounded CLI/evidence/hook cases passed | Real subprocess/filesystem program; scoped first-pass acceptance passed |
| Claude Code | 2.1.301 | Native plugin + repository marketplace | Package/skills installed in fixture | Native plugin loaded; Stop hook returned BLOCKED; tool interception unverified |
| Codex | 0.163.0 | Native plugin + repository marketplace | Package and direct stop adapter passed | Pinned CLI installed/version observed; native hook loading unverified |
| OpenCode | 2.0.31 | Native V2 plugin + local install | Package installation passed | Unverified |
| Kimi Code | 2.2.0 | Current plugin + custom marketplace | Package installation passed | Unverified |
| DeepSeek Harness | 0.2.0-rc.2 | Cordis bundle, skills/tools/guards | Package installation passed | Unverified |
| TypeSafe | jev-1.14.0 preview | Direct Rust System One transport | Controlled error handling passed | Adopted v2 live calibration passed; model/thresholds unchanged; original failed judgment retained |
| UAR | v1.1.1 phase | Read-only evidence adapter | Real import, mapping/adoption and active argv binding passed | WAIT for original running operation; release BLOCKED; UAR phase incomplete |

See [acceptance results](acceptance-results.md) and the sanitized receipt under
`.phase-exit/acceptance/`. The native Claude observation used an unavailable
collaborator fixture. Its host result was a successful assistant turn, while the
hook correctly reported an incomplete blocked phase. These are distinct outcomes.

## Enforcement limits

Claude Stop blocking requests continuation; use it only for an exact authorized
remaining action and respect stop-hook recursion controls. Blocked, uncertain and
invalid phase decisions must terminate with their status, not continue forever.

Codex lifecycle hooks require trust in their exact definitions. Repository
marketplaces support them; the public plugin directory excludes lifecycle-hook
packages. Plugin enablement alone is not hook trust. PreToolUse coverage is not
universal, and some host failures can fail open.

OpenCode's idle event is observational. Its documented tool guard can deny a
specific dispatch; idle notification alone cannot certify a phase or force every
host continuation path to stop.

Kimi hooks use a fixed Node command string. Hook errors can fail open. The Rust
engine's final decision remains independent of a host UI's apparent completion.

DeepSeek Cordis registration and supported guards operate inside trusted host
code. They are not a sandbox for arbitrary plugins.

No Windows, legacy-host, public-directory or MCP execution claim is made. The
uncomfortable limit is incomplete host interception: a disabled hook cannot
enforce anything. Consult the linked official sources in research.md.
