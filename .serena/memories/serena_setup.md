# Serena Setup

Repo-local Serena wiring:

- plugin metadata lives in `plugins/serena/.codex-plugin/plugin.json`
- MCP launch config lives in `plugins/serena/.mcp.json`
- the repo uses `plugins/serena/codex-context.yml` instead of Serena's built-in Codex context so read-only discovery helpers and `restart_language_server` are exposed without re-enabling Serena shell or write tools
- `.agents/plugins/marketplace.json` installs this plugin by default for the repo

Project-level Serena policy:

- `.serena/project.yml` pins the language backend to `LSP`
- ignored paths explicitly skip generated output plus Serena cache and log directories
- `query-projects` mode is enabled so `list_queryable_projects` and `query_project` are available when another registered Serena project is relevant
- the web dashboard is enabled but should not auto-open on startup; open it on demand instead

Usage guidance:

- prefer `get_symbols_overview`, `find_symbol`, `find_referencing_symbols`, and symbol-safe edits first
- use `search_for_pattern` when the symbol name is unknown or the target is non-code
- in this repo-local context, `find_file`, `list_dir`, `read_file`, and `restart_language_server` are available in addition to the symbolic tools
- keep shell commands and file writes in Codex-native tools unless the user explicitly wants Serena-specific recovery behavior

Audit commands:

- `serena project health-check <repo-path>`
- `serena project index <repo-path> --log-level INFO --timeout 20`
- `serena print-system-prompt <repo-path> --context=plugins/serena/codex-context.yml --only-instructions`
