# Serena Setup And Health

Purpose: keep Codex connected to one project-scoped Serena MCP for Secret Faeries.

Tracked wiring:

- `.agents/plugins/marketplace.json` installs the repo-local `plugins/serena` plugin by default.
- `.codex/hooks.json` runs `plugins/serena/scripts/ensure-project-mcp.sh` on Codex session startup, resume, and clear.
- `.codex/config.toml` and `plugins/serena/.mcp.json` connect Codex to `http://127.0.0.1:9127/mcp`.
- `plugins/serena/codex-context.yml` exposes symbol tools, read-only discovery helpers, memory tools, dashboard access, and language-server restart while excluding Serena shell and file-write helpers.
- `.serena/project.yml` registers project name `secret-faeries`, TypeScript LSP, and `query-projects` mode.

Startup behavior:

- `ensure-project-mcp.sh` derives the repo root from its own path.
- It may reuse a process only when the command line matches this repo, port `9127`, Streamable HTTP, and the current repo path.
- It must initialize the MCP and confirm the instructions say the `secret-faeries` project at the current repo path is active.
- It treats a matching process as stale when it predates `.serena/project.yml`, `plugins/serena/codex-context.yml`, or the bootstrap script.
- It may restart only a matching repo-owned stale Serena process.
- It must not take over the port from an unrelated process.

Maintenance commands:

- `bash -n plugins/serena/scripts/ensure-project-mcp.sh`
- `serena project health-check <repo-path>`
- `serena project index <repo-path> --log-level INFO --timeout 20`
- `serena print-system-prompt <repo-path> --context=plugins/serena/codex-context.yml --only-instructions`

Official Serena references:

- Project workflow: https://oraios.github.io/serena/02-usage/040_workflow.html
- Running Streamable HTTP MCP: https://oraios.github.io/serena/02-usage/020_running.html
