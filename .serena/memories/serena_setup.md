# Serena Setup

Repo-local Serena wiring:

- plugin metadata lives in `plugins/serena/.codex-plugin/plugin.json`
- MCP connection config lives in `plugins/serena/.mcp.json`
- the repo uses `plugins/serena/codex-context.yml` instead of Serena's built-in Codex context so read-only discovery helpers and `restart_language_server` are exposed without re-enabling Serena shell or write tools
- `.agents/plugins/marketplace.json` installs this plugin by default for the repo
- `.codex/config.toml` and `.codex/hooks.json` start one project-scoped Serena MCP singleton for Secret Faeries chats and connect Codex to `http://127.0.0.1:9127/mcp`

Project-level Serena policy:

- `.serena/project.yml` pins the language backend to `LSP`
- ignored paths explicitly skip generated output plus Serena cache and log directories
- `query-projects` mode is enabled so `list_queryable_projects` and `query_project` are available when another registered Serena project is relevant
- the web dashboard is enabled but must not auto-open on startup; use the Serena `open_dashboard` tool when the dashboard is explicitly needed
- the repo-local Codex context is single-project so chats sharing the same Serena MCP cannot switch the singleton away from Secret Faeries

Usage guidance:

- prefer `get_symbols_overview`, `find_symbol`, `find_referencing_symbols`, and symbol-safe edits first
- use `search_for_pattern` when the symbol name is unknown or the target is non-code
- in this repo-local context, `find_file`, `list_dir`, `read_file`, `open_dashboard`, and `restart_language_server` are available in addition to the symbolic tools
- keep shell commands and file writes in Codex-native tools unless the user explicitly wants Serena-specific recovery behavior

Audit commands:

- `serena project health-check <repo-path>`
- `serena project index <repo-path> --log-level INFO --timeout 20`
- `serena print-system-prompt <repo-path> --context=plugins/serena/codex-context.yml --only-instructions`
