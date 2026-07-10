# Source Control And Verification

Start every agentic workflow with:

- `git status --short --branch`
- confirm the active branch before editing

Branch and worktree rules:

- stay on `main` unless the user explicitly asks for another strategy
- if not on `main`, stop before substantial edits and confirm the switch
- pre-existing dirty files are user-owned; never revert, reset, checkout,
  overwrite, or broadly reformat them
- identify the intended write set and keep it scoped; parallel agents receive
  disjoint write scopes and are told the worktree is shared
- stage only explicit files changed and never use broad `git add .`
- commit/push/deploy only when requested and only after readiness is proven

Required release verification from `AGENTS.md`:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run quality:serena`
4. `npm run test:unit`
5. `npm run test:e2e`
6. `npm run build`
7. `npm run ci`

`npm run ci` is the aggregate authority and additionally covers formatting,
dependency/file-quality guards, high-severity production dependency audits for
the client and Functions, Firebase integration/rules, Functions tests, bundle
analysis/budget, and visual regression. Run targeted checks earlier:

- `npm run test:integration` for Firebase client adapters
- `npm run test:rules` for Firestore/Storage changes
- `npm run functions:build && npm run functions:test` for operations/watering/
  notifications
- `npm run test:visual` for route/layout changes
- `npm run quality:serena` whenever stable app, story, architecture, workflow,
  or memory facts change
- refresh the Serena index after large TypeScript refactors with
  `serena project index <repo-path> --log-level INFO --timeout 20`

Production pre-deploy rules:

- dry-run `npm run auth:sync-access -- --dry-run` before changing claims
- dry-run `npm run migrate:workspace-v2:dry-run -- --project <id>`, preserve and
  review the generated backup/report, then explicitly apply and rerun for an
  already-current result
- workspace migration is a separate reviewed pre-deploy action; a green Hosting
  workflow does not authorize skipping it
- deploy rules/indexes and Storage before the v2 client reads migrated data
- run live smoke for both accounts, real crop-group watering/weather evidence,
  and every push platform claimed by release notes
- require the production VAPID key; do not advertise Android while its Firebase
  file is absent or iOS until its FCM-token path is device-tested
- require configured production `NWS_USER_AGENT`, exact protected/public
  Firebase project-ID equality, and the workflow-generated mode-`0600`
  Functions environment file
- report any skipped gate, untested provider/device, migration warning, or
  residual risk; do not call the app ready based on build output alone

Primary local sources:

- `AGENTS.md`
- `docs/source-control-protocol.md`
- `docs/testing-ci.md`
- `docs/deployment.md`
- `docs/deploy-runbook.md`
