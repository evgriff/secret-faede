# AGENTS.md

Read these first:

1. `AGENTS.md`
2. `codex.md`
3. `docs/architecture.md`
4. `README.md`

Repo intent:

- keep Secret Faede as a small, functionality-first garden plot planner and
  garden operations app
- preserve email-link auth and one saved garden per user
- avoid product scope beyond a real plot editor and practical garden operations

Current foundation scope:

- sign-in
- auth routing
- access-denied handling
- authenticated app shell
- authenticated garden editor
- garden, tasks, journal, and settings workspace routes
- one Firestore garden document per user
- user profile notification preferences and consent state
- in-app, web push, and backend carrier messaging alert pipeline for garden operations
- generated task timeline and succession suggestions from the saved garden plan
- journal notes, issue tracking, photo attachments, harvest logs, and in-season
  analytics
- plot dimensions in feet
- plant center positions in plot coordinates
- tests
- CI
- docs

Guardrails:

- do not add dashboards, charts, maps, collaboration, lore, AI, or onboarding
  flows
- add weather, tasks, journal, notifications, and operations features only when
  they directly support the real plot editor workflow
- do not add dependencies unless they clearly reduce code for the current
  foundation scope
- keep seams explicit: `AuthService` owns auth and `GardenRepository` owns garden persistence
- use `xFt` from the left edge and `yFt` from the top edge as canonical plant coordinates
- store garden positions in feet, never raw pixels
- prefer small files, named exports, plain TypeScript, and readable route guards

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
