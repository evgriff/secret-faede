# Source Control And Verification

Start every agentic workflow with:

- `git status --short --branch`
- confirm the current branch before editing

Branch rules:

- Keep agent work on `main` unless the user explicitly asks for another branch strategy.
- If the active branch is not `main`, stop and confirm whether to switch before substantial edits.
- Treat pre-existing dirty files as user-owned.
- Do not revert, reset, checkout, overwrite, or reformat unrelated changes.

Scope rules:

- Name the intended write set before editing.
- Keep changes prompt-scoped.
- Stage explicit files only when asked; never use broad `git add .`.
- Commit only when the user asks.
- When using parallel agents, assign disjoint write scopes and tell workers the repo is shared.

Default verification gate from `AGENTS.md`:

- `npm run lint`
- `npm run typecheck`
- `npm run quality:serena`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run build`
- `npm run ci`

Add targeted checks when relevant:

- `npm run test:integration`
- `npm run test:rules`
- `npm run test:visual`
- `npm run functions:build`
- `npm run functions:test`
- `bash -n plugins/serena/scripts/ensure-project-mcp.sh` for Serena shell changes
- `npm run quality:serena` for app, workflow, architecture, or Serena catalog changes

Primary local sources:

- `AGENTS.md`
- `docs/source-control-protocol.md`
- `docs/testing-ci.md`
