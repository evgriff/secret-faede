# codex.md

## Project philosophy

This repo is intentionally constrained. Milestone 1 exists to make later milestones cheaper and safer, not to impress with breadth. The right move here is usually the smaller move.

Core principles:

- mock-first by default
- no custom backend
- explicit seams before live integrations
- platform APIs and small modules over helper sprawl
- documentation that prevents repo drift

## Why this stack

- `react` + `react-dom`: simplest fit for a small interactive SPA shell
- `react-router-dom`: readable client routing and test-friendly memory router support
- `firebase`: required client SDK surface for Auth and Firestore without server code
- `vite-plugin-pwa`: conservative manifest and service-worker support with minimal custom code
- `vite`: low-friction SPA build tool
- `typescript`: strict static checks with small module boundaries
- `eslint`, `typescript-eslint`, `prettier`: baseline code-quality railings
- `vitest`, `@testing-library/*`, `@playwright/test`: enough testing surface for component, routing, and smoke coverage
- `husky`, `lint-staged`: lightweight staged-file guardrails only
- `firebase-tools`: emulator and local hosting support

If a future change wants a new dependency, make it earn admission.

## Dependency admission checklist

Do not add a dependency until all answers are "yes":

1. Is the platform or existing stack insufficient?
2. Is it needed for the current milestone, not a later one?
3. Does it reduce total code and cognitive load?
4. Does it avoid locking the repo into a larger architectural pattern?
5. Will you document the reason in this file or the architecture docs?

## What is intentionally excluded

- custom backend code
- Cloud Functions
- state management libraries
- query/cache libraries
- UI kits and design systems
- animation libraries
- plant, weather, analytics, or notification SDKs
- speculative future screens

## Repo navigation

`src/app`

- composition root
- router and route guards
- provider assembly

`src/domain`

- app-facing types and interfaces
- Firestore draft model types

`src/features`

- user-facing feature slices
- auth and garden flows

`src/infrastructure`

- mock adapters
- Firebase adapters
- runtime service selection

`src/shared`

- low-level UI shell pieces
- env parsing
- route helpers
- storage helpers
- global style tokens

`src/test`

- common render helpers
- test service factories

## Coding conventions

- prefer named exports
- prefer functions over classes unless a boundary is meaningfully stateful
- keep CSS local with CSS Modules unless it is a true global token/reset/utility
- keep route definitions centralized in `src/app/router.tsx`
- keep browser storage access behind small helper functions
- if a component needs a large explanation, split it instead

## Future milestone expectations

Likely future work:

- plot and planting CRUD
- schedule derivation
- weather ingestion
- collaboration management

That future work should extend the existing seams, not replace them:

- expand `GardenRepository` rather than bypassing it
- add domain types before UI
- keep mock implementations working alongside live ones
- update rules and emulator docs at the same time as data-model changes

## How not to bloat this codebase

- avoid utility dumping grounds
- avoid helper layers with only one caller unless they are real architecture seams
- avoid premature abstractions around form state or data fetching
- do not add "temporary" demo UI that future agents will have to delete
- keep docs synchronized with runtime behavior instead of adding more runtime indirection

## Future-agent checklist

Before adding a feature:

1. Re-read `AGENTS.md`, `codex.md`, and `docs/architecture.md`.
2. Confirm the feature is in scope for the active milestone.
3. Decide whether the change belongs in `domain`, `features`, or `infrastructure`.
4. Keep mock mode working.
5. Update docs if the runtime contract, scripts, or Firebase setup changed.
6. Re-run `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, and `npm run build`.
