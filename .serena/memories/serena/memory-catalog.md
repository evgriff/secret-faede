# Serena Memory Catalog

Purpose: make stable v2 repository knowledge discoverable by topic rather than
preserving stale implementation-era summaries.

Rules:

- tracked memories are Markdown files under `.serena/memories/`
- active topic names contain `/` and mirror Serena's memory organization model
- `_archive/.*` is ignored by `.serena/project.yml` and never guides new work
- update a topic only for a stable product fact, story, architectural boundary,
  or workflow rule
- when mapped code/docs change, `npm run quality:serena` requires the matching
  memory update
- memories contain no credentials, tokens, private account/address data,
  production project identifiers, or secret environment values
- active memories describe the `src/v2` client and canonical workspace;
  historical client assumptions belong only in migration code or archives

Active catalog:

- `serena/setup-and-health`: repo-local plugin, MCP startup, and maintenance commands.
- `serena/memory-catalog`: memory organization, catalog, and update rules.
- `workflow/source-control-and-verification`: branch, dirty worktree, migration, staging, and verification expectations.
- `scope/product-guardrails`: product boundaries, non-goals, seams, coordinates, and watering safety.
- `stories/plan-real-plot-editor`: measured Plan route, crop-group water inputs, and publish safety.
- `stories/today-field-work`: separate crop-group watering, provenance, task work, and actor-attributed field actions.
- `stories/feed-operational-memory`: private operational history, issues, media, harvests, and revision-safe watering correction.
- `stories/settings-alert-trust`: exact shared location/climate, private alert consent, capabilities, and honest receipts.
- `architecture/garden-workspace-persistence`: schema 2/9 workspace, server publication, drafts, operations, migration, and media.
- `architecture/auth-profile-notifications`: two-account auth, profile schema 2, authorization, and alert delivery.

Primary local sources:

- `AGENTS.md`
- `codex.md`
- `docs/architecture.md`
- `docs/firebase.md`
- `docs/demo-script.md`
- `docs/testing-plan.md`
- `README.md`

Official Serena references:

- Memories and onboarding: https://oraios.github.io/serena/02-usage/045_memories.html
- Project workflow: https://oraios.github.io/serena/02-usage/040_workflow.html
