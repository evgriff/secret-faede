# Serena Memory Catalog

Purpose: make repo knowledge discoverable by topic instead of relying on flat onboarding summaries.

Serena memory rules for this repo:

- Memories are tracked Markdown files under `.serena/memories/`.
- Topic names use `/`, matching Serena's documented memory organization model.
- `list_memories` should show active topic memories such as `stories/plan-real-plot-editor`.
- `_archive/.*` is ignored by `.serena/project.yml`; archived memories are historical and should not guide new work.
- Update a memory only when a stable repo fact, user story, architectural boundary, or workflow rule changes.
- `npm run quality:serena` enforces the active catalog and fails when mapped app work does not update the relevant topic memory.
- Do not store secrets, private account values, Firebase credentials, tokens, personal phone data, or environment-specific auth details.

Active catalog:

- `serena/setup-and-health`: repo-local plugin, MCP startup, and maintenance commands.
- `serena/memory-catalog`: memory organization and update rules.
- `workflow/source-control-and-verification`: branch, dirty worktree, staging, and verification expectations.
- `scope/product-guardrails`: product boundaries, non-goals, seams, and coordinate rules.
- `stories/plan-real-plot-editor`: Plan route user story and acceptance signals.
- `stories/today-field-work`: Today route user story and acceptance signals.
- `stories/feed-operational-memory`: Feed route user story and acceptance signals.
- `stories/settings-alert-trust`: Settings route user story and acceptance signals.
- `architecture/garden-workspace-persistence`: garden workspace, drafts, operations, media, and offline persistence.
- `architecture/auth-profile-notifications`: auth, profiles, notification delivery, and authorization boundaries.

Primary local sources:

- `AGENTS.md`
- `codex.md`
- `docs/architecture.md`
- `docs/architecture.md`
- `docs/demo-script.md`
- `docs/manual-qa-checklist.md`
- `README.md`

Official Serena references:

- Memories and onboarding: https://oraios.github.io/serena/02-usage/045_memories.html
- Project workflow: https://oraios.github.io/serena/02-usage/040_workflow.html
