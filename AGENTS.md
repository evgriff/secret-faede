# AGENTS.md

Read these first:

1. `AGENTS.md`
2. `codex.md`
3. `docs/architecture.md`
4. `README.md`

Repo intent:

- keep Milestone 1 as a small, mock-first PWA foundation for a garden plot tracker
- optimize for future feature work without adding speculative UI or infrastructure now

Guardrails:

- do not add features outside sign-in, routing, garden selection, shell layout, Firebase scaffolding, tests, CI, and docs
- do not add dependencies unless they clearly reduce code and are needed in the current milestone
- keep repository interfaces and adapter seams explicit: `AuthService` and `GardenRepository`
- prefer small files, named exports, plain TypeScript, and readable route guards

Before finishing:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run build`

Do not:

- add fake dashboards, fake charts, fake reminders, or fake weather
- introduce state libraries, server code, analytics, AI integrations, or ornamental abstractions

Primary docs:

- `docs/architecture.md`
- `docs/firebase.md`
- `docs/testing-ci.md`
