# codex.md

## Project philosophy

This repo is intentionally narrow. Secret Faede should do one thing well: email-link auth into a saved real-world garden plot editor.

Core principles:

- mock-first by default
- explicit seams for auth and garden persistence
- small modules over helper sprawl
- docs that prevent repo drift
- no speculative product infrastructure

## Current MVP target

- route map: `/`, `/sign-in`, `/auth/complete`, `/access-denied`, `/app`, `*`
- Firebase email-link auth behind `AuthService`
- application-level two-email allowlist enforced after sign-in
- mock and Firebase runtimes selected from centralized config
- `GardenRepository` active for one garden per user
- Firestore path `gardens/{uid}` in Firebase mode
- plot dimensions stored in feet
- plant centers stored as `xFt` and `yFt`, never pixels

## Boundaries

Active now:

- auth/session state
- runtime config parsing
- route guards
- Firebase Auth, Firestore, Hosting, and emulator support
- saved garden editor
- tests and CI

Deferred on purpose:

- multiple gardens
- plant metadata and species libraries
- reminders, weather, maps, dashboards, collaboration, and onboarding
- Cloud Functions or server code

## Repo navigation

`src/app`

- composition root
- router
- route guards

`src/features/auth`

- sign-in
- auth completion
- access denied
- auth context

`src/features/garden`

- garden editor screen
- plot settings and add-plant modals
- local garden state hook
- coordinate math

`src/infrastructure`

- Firebase and mock adapters
- runtime service selection

`src/shared`

- config parsing
- allowlist helpers
- reusable shell UI
- global styles

`src/domain/gardens`

- canonical garden model and persistence interface

## Dependency admission checklist

Do not add a dependency until all answers are yes:

1. Is the platform or current stack insufficient?
2. Is it needed for the current MVP?
3. Does it reduce total code and cognitive load?
4. Does it avoid forcing a larger architecture pattern?
5. Will the reason be documented here or in the architecture docs?

## Future-agent checklist

1. Re-read `AGENTS.md`, `codex.md`, and `docs/architecture.md`.
2. Keep mock mode working.
3. Keep `AuthService` explicit and avoid bypassing it from UI code.
4. Keep `GardenRepository` as the only garden persistence boundary.
5. Store plot and plant data in feet, not pixels.
6. Update docs when runtime, scripts, persistence, or deployment requirements change.
7. Re-run `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, `npm run build`, and `npm run ci`.
