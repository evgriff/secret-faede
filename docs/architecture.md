# Architecture

## Summary

Secret Faede ships a small authenticated garden workspace. It proves routing,
runtime selection, Firebase email-link auth, allowlist gating, Firestore garden
persistence, emulator support, and Hosting deployment while keeping the plot
editor as the product center.

Route map:

- `/`: redirect based on auth and authorization state
- `/sign-in`: request an email sign-in link
- `/auth/complete`: finish same-device or different-device email-link sign-in
- `/access-denied`: show access-denied handling after allowlist rejection
- `/app`: authenticated shell index; redirects to `/app/garden`
- `/app/garden`: saved garden editor
- `/app/tasks`: generated task timeline, calendar, and succession workspace
- `/app/journal`: journal, issue tracking, photos, harvests, and analytics
- `/app/settings`: editable alert defaults and notification preferences
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

- seam for email-link auth
- implemented by `MockAuthService` and `FirebaseAuthService`
- owns send-link, same-device stored email, completion, current user lookup, subscription, and sign-out

`GardenRepository`

- seam for one garden per user
- implemented by `MockGardenRepository` and `FirebaseGardenRepository`
- exposes `getGarden(userId)` and `saveGarden(garden)`
- uses localStorage in mock mode and Firestore path `gardens/{uid}` in Firebase mode
- Firebase mode enables Firestore persistent local cache and queues a pending
  garden aggregate save in localStorage when the browser is offline

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

- seam for client notification registration and foreground web push handling
- implemented by `MockNotificationService` and `FirebaseNotificationService`
- registers FCM web push tokens under `users/{uid}/pushTokens/{tokenId}`
- keeps Twilio and scheduled delivery out of the browser; server-side dispatch
  lives in Firebase Functions

`MediaStorageService`

- seam for journal photo uploads
- implemented by `MockMediaStorageService` and `FirebaseMediaStorageService`
- mock mode stores data URLs in the journal photo metadata
- Firebase mode uploads image binaries to Storage under
  `users/{uid}/journal/{entryId}/...`

## Auth and editor flow

1. The sign-in page collects one email address.
2. The service sends a Firebase email-link request or returns a mock completion link.
3. Same-device completion stores the normalized email locally.
4. `/auth/complete` completes sign-in immediately when stored email is available, or prompts for email re-entry on a different device.
5. The auth provider normalizes the signed-in email and compares it against the two-email allowlist from config.
6. Allowed users enter `/app/garden` inside the authenticated app shell.
7. Non-allowlisted users are immediately signed out and redirected to `/access-denied`.
8. The garden editor loads `gardens/{uid}` or creates an unsaved default garden in memory.
9. Add Plant searches the local crop catalog, captures planting mode details,
   and creates a planting with crop spacing, sun, and water defaults.
10. User edits mark the garden dirty; Save writes plot dimensions and plant
    positions. Offline saves are accepted locally and surfaced as queued/saved
    locally in the shell.
11. Update Weather fetches provider data, builds a weather snapshot, generates
    watering recommendations, and persists the updated garden.
12. Active watering and weather alerts create in-app notification logs that are
    visible in the garden operations panel.
13. Settings lets the user manage alert types, channels, quiet hours, daily
    check time, location/timezone, carrier messaging consent, and web push registration.
14. `/app/tasks` syncs generated work from the saved garden plan, watering
    recommendations, editable frost dates, and crop catalog defaults.
15. `/app/journal` records notes, structured issues, photo attachments,
    harvests, and management analytics from the same garden aggregate.
16. The authenticated shell shows online/offline state and uses mobile bottom
    navigation for field use.

Important note:

- the allowlist is an application-level gate
- it is not a true pre-auth hard block
- a future hard-enforcement option is Firebase Auth blocking triggers with Identity Platform

## Garden model

Core Firestore shape:

- `users/{uid}`
- `users/{uid}/pushTokens/{tokenId}`
- Firebase Storage path `users/{uid}/journal/{entryId}/{photoId}-{fileName}`
- `gardens/{uid}`
- `gardens/{uid}/structures/{structureId}`
- `gardens/{uid}/plantings/{plantingId}`
- `gardens/{uid}/tasks/{taskId}`
- `gardens/{uid}/journal/{entryId}`
- `gardens/{uid}/harvests/{harvestId}`
- `gardens/{uid}/notifications/{notificationId}`
- `catalog/crops/{cropId}`

Canonical garden document:

```ts
{
  id: string,
  userId: string,
  name: string,
  climateProfile: ClimateProfile,
  plot: {
    widthFt: number,
    depthFt: number,
    orientationDegrees: number,
    location: GardenLocation,
    gridUnitFt: 1,
    snapUnitFt: 0.5
  }
}
```

Plantings are canonical garden items in `gardens/{uid}/plantings/{plantingId}`.
Supported planting modes are `single`, `row`, `block`, `cluster`, and
`trellisLine`. Structures such as beds and trellises are separate documents in
`gardens/{uid}/structures/{structureId}`.

Structure planning supports raised beds, in-ground beds, containers, pathways,
trellises, fence/wall segments, tree/obstacle footprints, compost markers, and
water-source markers. Structure positions and sizes use feet as canonical units.

Crop profiles are normalized from the checked-in curated catalog in
`src/domain/crops/curatedCropOverrides.json`. The app can ingest Trefle data
with `npm run catalog:ingest:trefle`, but the editor does not call Trefle at
runtime.

Sun/shade layers are stored on the garden document as generated or manually
overridden 1-foot cells. The model uses SunCalc with the garden latitude,
longitude, plot orientation, and shade-casting structure fields such as
`heightFt` and `canopyRadiusFt`. Representative seasonal dates are spring
shoulder, summer peak, and fall shoulder.

Weather snapshots and water recommendations are currently embedded on
`gardens/{uid}`. The watering engine combines crop weekly water targets, bed or
container multipliers, mulch flags, recent rain, near-term forecast rain, heat
stress, optional evapotranspiration, and journal water logs when present.

Notification preferences are stored on `users/{uid}`. They include per-channel
toggles, per-alert-type toggles, quiet hours, daily watering check time,
timezone, thresholds, carrier messaging phone, consent status, and push permission metadata.
Notification logs are stored at `gardens/{uid}/notifications/{notificationId}`
for in-app, push, carrier messaging, and email-placeholder decisions.

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
  first frost, and saved sun/shade exposure to suggest a follow-on crop.
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

The browser handles only web push registration and foreground display. Firebase
Functions owns scheduled and event-driven dispatch:

- `dailyWateringCheck` runs at 7:00 AM `America/Detroit` for the Detroit demo
  profile and sends active watering recommendations.
- `onGardenWeatherSnapshotUpdated` reacts when a new garden weather snapshot is
  saved and dispatches frost, heat-stress, or severe-weather alerts.
- `sendTestSmsAlert` is a callable dry-run/test path for backend carrier messaging delivery.

carrier messaging uses Twilio Programmable Messaging from Functions only. `NOTIFICATION_DRY_RUN`
defaults to dry-run behavior unless it is explicitly set to `false` and Twilio
credentials are present. Every attempted carrier messaging creates a notification log with a
redacted recipient and delivery status.

## Styling posture

- CSS Modules for component styles
- CSS custom properties for shared app tokens
- light theme only
- stable pixels-per-foot plot scale with a scrollable viewport
