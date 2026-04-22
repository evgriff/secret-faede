# codex.md

## Project philosophy

This repo is intentionally small. Secret Faede should keep simple password auth
for exactly two provisioned accounts and a saved real-world garden plot editor
as the product center while growing only the operations features that help
gardeners manage that plot.

Core principles:

- mock-first by default
- PWA-first, with native support only as an additive shell
- explicit seams for auth and garden persistence
- small modules over helper sprawl
- docs that prevent repo drift
- Firebase-native infrastructure when the feature is ready for it

## Current foundation target

- route map: `/`, `/sign-in`, `/access-denied`, `/app`, `/app/plan`,
  `/app/today`, `/app/feed`, `/app/settings`, legacy redirects from
  `/auth/complete`, `/app/garden`, `/app/tasks`, `/app/log`, `/app/journal`,
  `*`
- Firebase email/password auth behind `AuthService`; no public sign-up route
- application-level two-email allowlist enforced after sign-in
- mock and Firebase runtimes selected from centralized config
- `GardenRepository` active for one shared published garden plus one draft per
  user
- `UserProfileRepository` active for alert defaults at `users/{uid}`
- `WeatherProvider` active for provider-cached weather reads
- `NotificationService` active for FCM web push registration and foreground
  message handling
- `MediaStorageService` active for journal photo uploads
- Firestore path `gardens/{uid}` in Firebase mode
- plot dimensions stored in feet
- plant centers stored as `xFt` and `yFt`, never pixels
- authenticated shell with durable Plan, Today, Feed, and Settings routes

## Boundaries

Active now:

- auth/session state
- runtime config parsing
- route guards
- Firebase Auth, Firestore, Hosting, and emulator support
- Plan workspace for saved garden editing
- editable settings for Detroit alert defaults
- weather/watering operations panel
- in-app notification logs for watering and weather alerts
- task engine and `/app/today` timeline for generated garden work
- journal, issue tracking, photo attachments, harvest logging, and in-season
  analytics
- Cloud Functions source for scheduled watering checks and weather-driven alert
  dispatch
- authenticated app shell
- tests and CI

Deferred until the local product model needs them:

- multiple gardens
- runtime external plant metadata and species libraries
- maps, collaboration, carrier messaging, dashboards, AI, and onboarding
- production email notification delivery

## Repo navigation

`src/app`

- composition root
- router
- route guards

`src/features/auth`

- sign-in
- access denied
- auth context

`src/features/plan`

- Plan page, toolbar, canvas, inspector, and operations panel
- pointer interaction hook for plot drag/resize

`src/features/garden`

- compatibility exports, plot settings and add-plant modals, garden state hook,
  coordinate math, sun/shade, and watering engines

`src/features/today`

- Today page, task groups, calendar strip, and succession sidebar

`src/features/tasks`

- compatibility export and generated task engine

`src/features/log`

- Feed route implementation, entry and harvest forms, cards, and analytics
  panel

`src/features/journal`

- compatibility export plus journal analytics
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
- legacy notification code that should be kept behind explicit seams until the
  carrier messaging cleanup prompt removes de-scoped paths

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
5. Will the reason be documented in `docs/adr/` before the package lands?

## Future-agent checklist

1. Re-read `AGENTS.md`, `codex.md`, `docs/architecture.md`, and
   `docs/source-control-protocol.md`.
2. Start with `git status --short --branch` and move agent work to a `codex/`
   branch before substantial edits.
3. Keep mock mode working.
4. Keep `AuthService` explicit and avoid bypassing it from UI code.
5. Keep `GardenRepository` as the only garden persistence boundary and
   `UserProfileRepository` as the user-profile persistence boundary.
6. Store plot and plant data in feet, not pixels.
7. Update docs when runtime, scripts, persistence, or deployment requirements change.
8. Re-run `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run test:e2e`, `npm run build`, and `npm run ci`.
9. Do not reintroduce carrier messaging/notification provider as product scope; remove old references during
   the carrier messaging cleanup prompt instead of expanding them.
