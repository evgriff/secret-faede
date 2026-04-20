# codex.md

## Project philosophy

This repo is intentionally small. Secret Faede should keep email-link auth and a
saved real-world garden plot editor as the product center while growing only the
operations features that help gardeners manage that plot.

Core principles:

- mock-first by default
- explicit seams for auth and garden persistence
- small modules over helper sprawl
- docs that prevent repo drift
- Firebase-native infrastructure when the feature is ready for it

## Current foundation target

- route map: `/`, `/sign-in`, `/auth/complete`, `/access-denied`, `/app`, `/app/garden`, `/app/tasks`, `/app/journal`, `/app/settings`, `*`
- Firebase email-link auth behind `AuthService`
- application-level two-email allowlist enforced after sign-in
- mock and Firebase runtimes selected from centralized config
- `GardenRepository` active for one garden per user
- `UserProfileRepository` active for alert defaults at `users/{uid}`
- `WeatherProvider` active for provider-cached weather reads
- `NotificationService` active for FCM web push registration and foreground
  message handling
- `MediaStorageService` active for journal photo uploads
- Firestore path `gardens/{uid}` in Firebase mode
- plot dimensions stored in feet
- plant centers stored as `xFt` and `yFt`, never pixels
- authenticated shell with durable garden, tasks, journal, and settings routes

## Boundaries

Active now:

- auth/session state
- runtime config parsing
- route guards
- Firebase Auth, Firestore, Hosting, and emulator support
- saved garden editor
- editable settings for Detroit alert defaults
- weather/watering operations panel
- in-app notification logs for watering and weather alerts
- task engine and `/app/tasks` timeline for generated garden work
- journal, issue tracking, photo attachments, harvest logging, and in-season
  analytics
- Cloud Functions source for scheduled watering checks and weather-driven alert
  dispatch
- Twilio Programmable Messaging integration behind server env and dry-run
  guardrails
- authenticated app shell
- tests and CI

Deferred until the local product model needs them:

- multiple gardens
- runtime external plant metadata and species libraries
- maps, collaboration, and onboarding
- production email notification delivery

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
- sun/shade and watering engines

`src/features/tasks`

- task timeline page
- generated task engine
- succession recommendations

`src/features/journal`

- journal and issue workspace
- harvest logging
- in-season analytics

`src/features/settings`

- alert default and notification preference editing

`src/infrastructure`

- Firebase and mock adapters
- runtime service selection
- weather provider adapters and cache
- notification adapters
- media storage adapters

`functions`

- scheduled and event-driven notification dispatch
- Twilio carrier messaging delivery and audit logging

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
4. Keep `GardenRepository` as the only garden persistence boundary and
   `UserProfileRepository` as the user-profile persistence boundary.
5. Store plot and plant data in feet, not pixels.
6. Update docs when runtime, scripts, persistence, or deployment requirements change.
7. Re-run `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, `npm run build`, and `npm run ci`.
