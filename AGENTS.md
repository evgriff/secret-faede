# AGENTS.md

Read these first:

1. `AGENTS.md`
2. `codex.md`
3. `docs/architecture.md`
4. `README.md`

Serena:

- keep the repo-local Codex Serena plugin wiring in `plugins/serena` and
  `.agents/plugins/marketplace.json` aligned with this document so the Codex
  app can auto-load Serena for this repo
- activate the current project with Serena before code navigation when Serena
  tools are available
- use Serena for symbol overviews, symbol lookup, reference searches, and
  symbol-safe refactors via the repo-local Serena Codex plugin before falling
  back to broad file reads or text-only search
- keep `.serena/project.yml` and tracked `.serena/memories/` files free of
  secrets and aligned with this document
- refresh the Serena index after large TypeScript refactors with
  `serena project index <repo-path> --log-level INFO --timeout 20`

Repo intent:

- keep Secret Faede as a small, functionality-first garden plot planner and
  garden operations app
- preserve password auth for the two provisioned accounts and one shared
  published garden workspace with private drafts
- avoid product scope beyond a real plot editor and practical garden operations

Current foundation scope:

- sign-in
- auth routing
- access-denied handling
- authenticated app shell
- authenticated garden editor
- Plan, Today, Feed, and Settings workspace routes with legacy redirects
- one shared published garden workspace plus per-user drafts in Firestore
- user profile notification preferences and consent state
- in-app, web push, and native/local alert pipeline for garden operations
- generated task timeline and succession suggestions from the saved garden plan
- journal notes, issue tracking, photo attachments, harvest logs, and in-season
  summaries
- plot dimensions in feet
- plant and planting-instance center positions in plot coordinates
- tests
- CI
- docs

Guardrails:

- do not add dashboards, charts, maps, collaboration, lore, AI, carrier
  messaging, or onboarding flows
- add weather, tasks, journal, notifications, and operations features only when
  they directly support the real plot editor workflow
- do not add dependencies unless they clearly reduce code for the current
  foundation scope
- keep seams explicit: `AuthService` owns auth and `GardenRepository` owns garden persistence
- use `xFt` from the left edge and `yFt` from the top edge as canonical plant coordinates
- store garden positions in feet, never raw pixels
- prefer small files, named exports, plain TypeScript, and readable route guards
- treat carrier messaging as removed scope; do not expand, depend on, or
  reintroduce it in new prompt-chain work

Source control protocol:

- start every agentic workflow with `git status --short --branch` and confirm
  the current branch before editing
- use a `codex/` branch for agent work unless the user explicitly asks for a
  different branch strategy
- never continue substantial edits directly on `main`
- treat all pre-existing dirty files as user-owned; do not revert, reset,
  checkout, overwrite, or reformat unrelated changes
- before editing, identify the intended file set and keep the change scoped to
  that set unless the code forces a documented expansion
- when using parallel agents, assign disjoint write scopes and state that other
  agents may be editing the repo
- stage only explicit files you changed; never use broad `git add .` or
  destructive cleanup commands
- commit only when the user asks; keep commits prompt-sized, name the
  verification commands run, and leave unrelated dirty files unstaged

Before finishing:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run build`
- `npm run ci`

Primary docs:

- `docs/architecture.md`
- `docs/firebase.md`
- `docs/testing-ci.md`
- `docs/deployment.md`
