# Research and decisions

Retrieved during planning and implementation on 2026-10-16 using Firecrawl,
Context7 and official package metadata. These sources justify the selected
contracts; they do not constitute runtime acceptance.

| Topic | Primary source | Decision |
| --- | --- | --- |
| JEV model | https://docs.typesafe.ai/models | Pin jev-1.14.0 and label preview; reject alias or response mismatch. |
| System One | https://docs.typesafe.ai/api | Direct Rust HTTPS request; strict typed noul answers and exact question keys. |
| Confidence | https://docs.typesafe.ai/confidence | Separate supported, contradicted and uncertain outcomes; frozen examples precede threshold adoption. |
| Coding agents | https://docs.typesafe.ai/introduction/coding-agents | Semantic judgments supplement deterministic runtime evidence. |
| Skills | https://agentskills.io/specification | Two canonical skills with progressive references and standard frontmatter. |
| Node | https://nodejs.org/en/blog/release/v24.22.0 | Pin Node24.22.0; use filesystem and spawn APIs. |
| TypeScript | https://registry.npmjs.org/typescript/7.0.2 | Pin7.0.2; distribute compiled JavaScript. |
| Claude hooks | https://code.claude.com/docs/en/hooks | Exec-form hooks, bounded continuation and stop-hook recursion handling. |
| Claude manifest | https://code.claude.com/docs/en/plugins/manifest-reference | Native manifest with repository marketplace. |
| Claude marketplace | https://code.claude.com/docs/en/plugin-marketplaces | Repository sources without a shell installer. |
| Codex plugins | https://learn.chatgpt.com/plugins/build/plugins | Native repository marketplace; no public-directory approval claim. |
| Codex hooks | https://learn.chatgpt.com/docs/hooks | Trusted lifecycle hooks; respect documented enforcement coverage. |
| OpenCode V2 | https://opencode.ai/v2/docs/build/plugins | V2 plugin registration; do not silently use V1 contracts. |
| Kimi plugins | https://www.kimi.com/code/docs/en/kimi-code-cli/customization/plugins.html | Current plugin manifest and custom marketplace. |
| Kimi hooks | https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html | Fixed Node launcher where the host requires a command string. |
| DeepSeek Harness | https://github.com/deepseek-ai/deepseek-harness | Cordis bundle and supported skills/tools/guards at0.2.0-rc.2. |

## API evidence

The planning read-only GET of https://api.typesafe.ai/v1/models returned HTTP200.
It established credential access to the model listing only. No semantic judgment
or product acceptance is inferred from that result. The credential was read from
the designated literal assignment without executing or printing the profile.

System One uses POST /v1/systemone. A request includes state, the exact model and
questions with type noul, instructions and true/false criteria. Question keys
alone do not supply criterion semantics: instructions contain the criterion and
explicit evidence references. Validate answer types, finite values in[0,1], keys
and returned model. Do not invent a confidence field for noul responses.

## Plan review

A fresh-context artifact review of the plan reported zero critical findings and
three warnings: conflated semantic failure/uncertainty, ambiguous stage/phase
completion, and incomplete missing/stale-evidence outcomes. The approved plan
addresses all three explicitly. Cross-model independence was unverified. The
anti-sycophancy screen returned0.0 with no classifications. This is plan review,
not implementation review or UAR's third review.

## Scope decision

The operator excluded Windows qualification after the initial cross-platform
request. Source remains portable; this delivery exercises this Mac and this UAR
phase. MCP server and app are issue drafts. Legacy host compatibility and public
directory approval are excluded. Optional ideas never become implicit release gates.

The uncomfortable limit: a primary-source API description can still differ from
an installed host. Actual runtime claims require observed receipts.
