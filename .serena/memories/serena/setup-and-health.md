# Serena Setup And Health

Purpose: keep Codex connected to one project-scoped Serena MCP for Secret Faeries.

Tracked wiring:

- `.agents/plugins/marketplace.json` installs the repo-local `plugins/serena` plugin by default.
- `.codex/config.toml` and `plugins/serena/.mcp.json` launch `plugins/serena/scripts/start-project-mcp-stdio.sh` as the Serena stdio MCP.
- `plugins/serena/codex-context.yml` exposes symbol tools, read-only discovery helpers, memory tools, dashboard access, and language-server restart while excluding Serena shell and file-write helpers.
- `.serena/project.yml` registers project name `secret-faeries`, TypeScript LSP, and `query-projects` mode.

Startup behavior:

- `start-project-mcp-stdio.sh` derives the repo root from its own path.
- It starts Serena with `--transport stdio`, `--project <repo-root>`, and the repo-local Codex context.
- It enables the Serena dashboard but does not open it automatically.
- It avoids local MCP URLs so Codex does not need to allowlist `127.0.0.1` or `localhost`.

Maintenance commands:

- `bash -n plugins/serena/scripts/start-project-mcp-stdio.sh`
- `serena project health-check <repo-path>`
- `serena project index <repo-path> --log-level INFO --timeout 20`
- `serena print-system-prompt <repo-path> --context=plugins/serena/codex-context.yml --only-instructions`

Official Serena references:

- Project workflow: https://oraios.github.io/serena/02-usage/040_workflow.html
- Running Streamable HTTP MCP: https://oraios.github.io/serena/02-usage/020_running.html
