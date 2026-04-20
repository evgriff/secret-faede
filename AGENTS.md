# AGENTS.md

Read these first:

1. `AGENTS.md`
2. `codex.md`
3. `docs/architecture.md`
4. `README.md`

Repo intent:

- keep Secret Faede as a small, functionality-first garden plot planner
- preserve email-link auth and one saved garden per user
- avoid product scope beyond a real plot editor

Current MVP scope:

- sign-in
- auth routing
- access-denied handling
- authenticated garden editor
- one Firestore garden document per user
- plot dimensions in feet
- plant center positions in plot coordinates
- tests
- CI
- docs

Guardrails:

- do not add dashboards, charts, weather, reminders, maps, collaboration, lore, AI, or onboarding flows
- do not add dependencies unless they clearly reduce code for the current MVP
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
