# Architecture

## Summary

Secret Faede ships a small authenticated garden workspace. It proves routing,
runtime selection, Firebase email/password auth, app-level access gating,
Firestore garden persistence, emulator support, and Hosting deployment while
keeping the plot editor as the product center.

Route map:

- `/`: redirect based on auth and authorization state
- `/sign-in`: email/password sign-in for provisioned accounts
- `/auth/complete`: legacy redirect back to `/sign-in`
- `/access-denied`: show access-denied handling after allowlist rejection
- `/app`: authenticated shell index; redirects to `/app/plan`
- `/app/plan`: Plan workspace for saved garden editing
- `/app/today`: generated task timeline, calendar, and succession workspace
- `/app/feed`: journal, issue tracking, photos, harvests, and analytics
- `/app/settings`: editable alert defaults and notification preferences
- `/app/garden`, `/app/tasks`, `/app/log`, `/app/journal`: legacy redirects to
  Plan, Today, and Feed
- `*`: not-found fallback

## Runtime and seams

`resolveAppEnvironment()`

- parses `VITE_APP_RUNTIME`
- parses `VITE_USE_FIREBASE_EMULATORS`
- parses `VITE_ENABLE_PWA`
- parses `VITE_ALLOWED_EMAILS`
- parses Firebase web config
- falls back from requested Firebase mode to mock mode when web config is incomplete

`AuthService`

- seam for email/password auth
- implemented by `MockAuthService` and `FirebaseAuthService`
- owns password sign-in, password reset, persistence preference, current user
  lookup, subscription, and sign-out

`GardenRepository`

- seam for the shared published garden plus one draft per user
- implemented by `MockGardenRepository` and `FirebaseGardenRepository`
- exposes compatibility `getGarden(userId)` and `saveGarden(garden)` as draft
  operations plus explicit workspace, publish, discard, and revert operations
- uses localStorage in mock mode and Firestore path `gardenWorkspaces/main` in
  Firebase mode
- Firebase mode enables Firestore persistent local cache and queues a pending
  garden aggregate save in localStorage when the browser is offline
- queued Firebase saves carry draft base revision metadata; reconnect checks
  that base before cloud sync and marks a visible conflict instead of allowing
  a stale offline draft to overwrite a newer published revision
- Firebase saves replace known nested garden subcollections and delete stale
  nested documents that are no longer present in the aggregate

`UserProfileRepository`

- seam for alert defaults and notification preferences at `users/{uid}`
- implemented by mock localStorage and Firebase Firestore adapters

`WeatherProvider`

- seam for current conditions, forecast, alerts, recent precipitation, and
  optional agriculture metrics
- defaults to the National Weather Service for U.S. gardens
- can switch to Tomorrow.io when `VITE_ENABLE_TOMORROW_WEATHER=true` and
  `VITE_TOMORROW_API_KEY` is present
- wrapped in a local read-through cache so repeated weather calls do not hammer
  provider APIs

`NotificationService`

- seam for client notification registration and foreground web/native push
  handling
- implemented by `MockNotificationService` and `FirebaseNotificationService`
- registers FCM web and Capacitor native push tokens under
  `users/{uid}/pushTokens/{tokenId}`
- keeps scheduled delivery out of the browser; server-side dispatch lives in
  Firebase Functions
- does not include carrier messaging as product scope; any legacy carrier messaging code is pending removal
  in the explicit carrier messaging cleanup prompt

`MediaStorageService`

- seam for journal photo uploads
- implemented by `MockMediaStorageService` and `FirebaseMediaStorageService`
- mock mode stores data URLs in the journal photo metadata
- Firebase mode uploads image binaries to Storage under
  `users/{uid}/journal/{entryId}/...`

`MobileDeviceService`

- seam for Capacitor-only device behavior while keeping the PWA intact
- composed through a lazy web-safe adapter so Capacitor plugins are split out of
  the initial PWA bundle; the native implementation is loaded only for native
  device operations
- implemented by `CapacitorMobileDeviceService` with a mock test adapter
- exposes native network status, camera capture, local notification permission
  and scheduling, and non-secret session convenience hints
- stores no passwords, Firebase refresh tokens, or long-lived credentials

## Auth and editor flow

1. The sign-in page collects email, password, an optional show-password toggle,
   and a default-on remember-device choice.
2. The service signs in through Firebase Email/Password auth or mock password
   auth.
3. Auth persistence defaults to local device persistence and falls back to
   session persistence only when the user disables remember-device.
4. The auth provider normalizes the signed-in email and compares it against the
   two-email allowlist from config.
5. Allowed users enter `/app/plan` inside the authenticated app shell.
6. Non-allowlisted users are immediately signed out and redirected to `/access-denied`.
7. `/auth/complete` is a dead legacy URL and redirects to `/sign-in`.
8. The garden editor loads the shared workspace draft/published state from
   `gardenWorkspaces/main`, using `gardens/{uid}` only as a legacy migration
   source when needed.
9. If the user has no saved garden or only an empty demo-default profile, Plan
   shows first-run setup for garden name, location, timezone, plot type, plot
   size, editable climate defaults, and starter template selection.
10. Add Plant searches the local crop catalog, captures planting mode details,
    and creates a planting with crop spacing, sun, and water defaults.
11. User edits mark the garden dirty; Save writes plot dimensions and plant
    positions. Offline saves are accepted locally and surfaced as queued/saved
    locally in the shell.
12. Update Weather fetches provider data, builds a weather snapshot, generates
    watering recommendations, and persists the updated garden.
13. Active watering and weather alerts create in-app notification logs that are
    visible in the garden operations panel.
14. Settings lets the user manage alert types, channels, quiet hours, daily
    check time, location/timezone, web push registration, and the founder demo
    load/reset controls.
15. `/app/today` syncs generated work from the saved garden plan, watering
    recommendations, editable frost dates, and crop catalog defaults.
16. `/app/feed` records notes, structured issues, photo attachments,
    harvests, and management analytics from the same garden aggregate.
17. The authenticated shell shows online/offline state and uses mobile bottom
    navigation for field use.
18. In the Capacitor shell, native network state feeds the same sync indicator,
    native camera capture can attach field photos, and Settings can register
    native push or local alerts when platform entitlements are present.

Important note:

- the app shell still uses the configured email allowlist as a user-facing gate
- Firestore and Storage rules enforce the production authorization boundary with
  Firebase Auth `gardenAccess: true` and `secretFaedeMember: true` custom claims
- the browser app exposes no account creation route; production accounts are
  seeded through the admin script
- Identity Platform blocking triggers are the next step if pre-auth membership
  enforcement becomes available for the Firebase project

## Garden model

Core Firestore shape:

- `users/{uid}`
- `users/{uid}/pushTokens/{tokenId}`
- Firebase Storage path `users/{uid}/journal/{entryId}/{photoId}-{fileName}`
- `gardenWorkspaces/main`
- `gardenWorkspaces/main/drafts/{uid}`
- `gardenWorkspaces/main/revisions/{revisionId}`
- `gardens/{uid}`
- `gardens/{uid}/structures/{structureId}`
- `gardens/{uid}/plantings/{plantingId}`
- `gardens/{uid}/tasks/{taskId}`
- `gardens/{uid}/journal/{entryId}`
- `gardens/{uid}/harvests/{harvestId}`
- `gardens/{uid}/notifications/{notificationId}`
- `catalog/{cropId}`

Published and draft workspace documents store the full garden aggregate plus
revision metadata. `gardens/{uid}` remains a legacy migration source.

Canonical garden document:

```ts
{
  id: string,
  userId: string,
  schemaVersion: 2,
  name: string,
  climateProfile: ClimateProfile,
  plot: {
    widthFt: number,
    depthFt: number,
    orientationDegrees: number,
    location: GardenLocation,
    gridUnitFt: 1,
    snapUnitFt: 0.125
  }
}
```

Plantings are canonical garden items in `gardens/{uid}/plantings/{plantingId}`.
Supported planting modes are `single`, `row`, `block`, `cluster`, and
`trellisLine`. `plannedFor` stores an optional future date for approved
succession plantings; older saved plantings default to `null`. Structures such
as beds and trellises are separate documents in
`gardens/{uid}/structures/{structureId}`.

Structure planning supports raised beds, in-ground beds, containers, pathways,
trellises, fence/wall segments, tree/obstacle footprints, compost markers, and
water-source markers. Structure positions and sizes use feet as canonical units.

Crop profiles are normalized from the checked-in generated catalog in
`src/domain/crops/homeGardenCropCatalog.generated.json`. The app can rebuild the
offline library with `npm run catalog:build` and refresh Trefle enrichment with
`npm run catalog:ingest:trefle`, but the editor does not call Trefle at runtime.
Runtime crop profiles include aliases, roles, source tags, completeness score,
and provenance quality so the Add Plant picker can show data gaps without
presenting fit confidence as a score.

Starter garden templates live in `src/domain/gardens/gardenTemplates.ts`.
Templates create normal garden aggregates with structures and crop-backed
plantings; they do not create a second persistence model.

The sample garden builder lives in
`src/domain/gardens/sampleGarden.ts`. It creates a normal Detroit garden
aggregate and user profile for release demos; it does not add a parallel demo
schema or payment/entitlement model.

Sun/shade layers are stored on the garden document as generated or manually
overridden 1-foot cells. The model uses SunCalc with the garden latitude,
longitude, plot orientation, and shade-casting structure fields such as
`heightFt` and `canopyRadiusFt`, plus saved tall or trellised crop height when
those plantings still reserve space. Representative seasonal dates are spring
shoulder, summer peak, and fall shoulder. Manual observed cells remain
first-class overrides during recalculation, including the layer calibration date
shown in Plan.

Plan warnings are runtime guidance derived from saved feet-based data. Review
mode groups out-of-bounds, spacing, pathway, bed/container fit, sun mismatch,
trellis, and saved-history rotation warnings by severity and can jump to the
affected item. Informational cautions can be acknowledged in-session; critical
geometry warnings are not persisted as dismissed state.

Weather snapshots and water recommendations are currently embedded on
`gardens/{uid}`. The watering engine combines crop weekly water targets, bed or
container multipliers, mulch flags, recent rain, near-term forecast rain, heat
stress, optional evapotranspiration, and journal water logs when present.

Notification preferences are stored on `users/{uid}`. They include per-channel
toggles, per-alert-type toggles, quiet hours, daily watering check time,
timezone, thresholds, consent status, and push permission metadata.
Notification logs are stored at `gardens/{uid}/notifications/{notificationId}`
for in-app and push decisions. The model still accepts older email-channel state
for compatibility, but the production UI does not expose email delivery.

Tasks are stored at `gardens/{uid}/tasks/{taskId}`. Generated tasks keep stable
ids so completed/skipped work does not reappear. Task records include due date,
type, source, source id, bed label, priority, snooze/defer state, and completion
time. The task engine generates work from crop defaults, planting date or
editable frost dates, sow method, trellis needs, thinning, pruning,
fertilizing, mulching, water recommendations, and harvest windows. Completing a
sow/plant/transplant task updates the planting to growing and refreshes
downstream generated tasks from the completion date; completing a water task
marks its recommendation completed.

Journal entries are stored at `gardens/{uid}/journal/{entryId}`. Entries can
target the whole garden, a structure/bed, or an individual planting. Issue
entries add category, severity, and status fields. Photo attachments store
metadata on the journal entry while image binaries live in Firebase Storage.

Harvest events are stored at `gardens/{uid}/harvests/{harvestId}`. Harvests can
attach to a planting, store count/weight/bunch units, or use a freeform amount.
Journal analytics derive harvest totals, yield by crop, active beds,
unresolved issues, and watering alert acknowledgement from saved records.

- `xFt` is distance from the left plot edge.
- `yFt` is distance from the top plot edge.
- planting position is the planting center; row, block, cluster, and
  trellis-line modes derive mature footprints from mode-specific fields.
- structure position is the top-left footprint corner.
- sun/shade cells are generated in feet and can be manually overridden by the
  user.
- pixels are rendering-only and are never saved as source-of-truth position.

## Directory shape

```text
src/
  app/
  features/
    auth/
    garden/
    journal/
    settings/
    tasks/
  infrastructure/
    firebase/
      media/
      notifications/
    mock/
      media/
      notifications/
    runtime/
    weather/
  domain/
    notifications/
    media/
  shared/
    auth/
    config/
    lib/
    ui/
  styles/
  test/
functions/
  index.js
  notificationLogic.js
  test/
```

## Task timeline

The task page is an operational view over the saved garden. It auto-syncs
generated tasks on load, then persists user actions through `GardenRepository`.

- The calendar strip shows task counts across the next 14 days.
- The timeline groups open work into today, this week, and later.
- The side rail groups open work by bed or plot area.
- Succession recommendations use estimated harvest dates, remaining days before
  first frost, saved sun/shade exposure, and dated bed occupancy to suggest a
  follow-on crop. Approving a suggestion creates a normal future planting with
  `plannedFor`, then generated tasks sync from that planting.
- Snooze moves a task to tomorrow; defer moves it one week later.

## Journal

The journal page is the active-season memory layer. It persists through
`GardenRepository` and uses `MediaStorageService` only for attached photo
binaries.

- Notes can attach to the whole garden, a bed/structure, or a planting.
- Issues are structured as pest, disease, nutrient, weather damage, irrigation,
  or general observations with severity and status.
- Photos upload through Firebase Storage in Firebase mode and through data URLs
  in mock mode.
- Harvests can be logged by count, pounds, ounces, bunches, or freeform amount.
- The analytics side rail shows harvest totals, yield by crop, most active
  beds, unresolved issues, and water alerts sent versus acknowledged.

## Notification delivery

The browser handles web push registration and foreground display. The Capacitor
shell can additionally register native iOS/Android push tokens under the same
`users/{uid}/pushTokens/{tokenId}` path after platform entitlements and Firebase
native config files are present. Firebase Functions owns scheduled and
event-driven dispatch:

- `dailyWateringCheck` runs hourly in UTC, then checks each user's saved
  timezone and watering check time before sending active watering
  recommendations.
- `onGardenWeatherSnapshotUpdated` reacts when a new garden weather snapshot is
  saved and dispatches frost, heat-stress, or severe-weather alerts.

Push is the out-of-app notification path. carrier messaging/notification provider is de-scoped from the
product and should only appear as legacy code slated for cleanup, not as a
documented setup or demo capability.

## Styling posture

- CSS Modules for component styles
- CSS custom properties for shared app tokens
- light theme only
- stable pixels-per-foot plot scale with a scrollable viewport
