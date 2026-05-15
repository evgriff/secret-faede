# Architecture

## Summary

Secret Faeries ships a small authenticated garden workspace. It proves routing,
runtime selection, Firebase email/password auth, app-level access gating,
Firestore garden persistence, emulator support, and Hosting deployment while
keeping the plot editor as the product center.

Route map:

- `/`: redirect based on auth and authorization state
- `/sign-in`: email/password sign-in for provisioned accounts
- `/auth/complete`: legacy redirect back to `/sign-in`
- `/access-denied`: show access-denied handling after access rejection
- `/app`: authenticated shell index; redirects to `/app/plan`
- `/app/plan`: canvas-first Plan workspace for saved garden editing, optimizer
  walkthroughs, review, publish, and revert
- `/app/today`: field action surface for generated tasks, watering, issues,
  harvests, and succession context
- `/app/feed`: notes, issues, photos, harvests, and compact garden-memory
  summaries
- `/app/settings`: editable alert defaults and notification preferences
- `/app/garden`, `/app/tasks`, `/app/log`, `/app/journal`: legacy redirects to
  Plan, Today, and Feed
- `*`: not-found fallback

## Runtime and seams

`resolveAppEnvironment()`

- parses `VITE_APP_RUNTIME`
- parses `VITE_USE_FIREBASE_EMULATORS`
- parses `VITE_ENABLE_PWA`
- parses `VITE_ALLOWED_EMAILS` for mock/local email gating
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
- Feed and Today operations are stored in shared workspace collections under
  `gardenWorkspaces/main` and overlaid onto each user's private draft so notes,
  issues, photos, harvests, watering, tasks, weather snapshots, and in-app logs
  stay visible to both provisioned users without publishing a Plan draft
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
- does not include carrier messaging as product scope; scheduled alerts are
  supported through in-app history, web/native push, and device-local reminders

`MediaStorageService`

- seam for journal photo uploads
- implemented by `MockMediaStorageService` and `FirebaseMediaStorageService`
- mock mode stores data URLs in the journal photo metadata
- Firebase mode uploads image binaries to Storage under
  `gardenWorkspaces/main/journal/{entryId}/...`

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
4. In mock mode, the auth provider normalizes the signed-in email and compares
   it against the two-email allowlist from config.
5. In Firebase mode, the auth provider checks the signed-in user's ID token for
   `gardenAccess: true` and `secretFaeriesMember: true`.
6. Authorized users enter `/app/plan` inside the authenticated app shell.
7. Rejected users are immediately signed out and redirected to `/access-denied`.
8. `/auth/complete` is a dead legacy URL and redirects to `/sign-in`.
9. The garden editor loads the shared workspace draft/published state from
   `gardenWorkspaces/main`, using `gardens/{uid}` only as a legacy migration
   source when needed.
10. If the user has no saved garden or only an empty demo-default profile, Plan
    shows a slim first-run setup for garden name, plot type, plot size, and
    starter template selection. Location, timezone, coordinates, and climate
    defaults use editable Detroit-derived values and sit behind optional setup
    details or later Settings edits, and the route scrolls instead of clipping
    at normal desktop zoom.
11. Add Plant searches the local crop catalog, asks for quantity first, applies
    the recommended arrangement form, creates individual plant instances with
    crop spacing, sun, and water defaults, and phrases fit guidance against the
    current garden day in the saved timezone.
12. User edits mark the garden dirty; Save writes plot dimensions and plant
    positions. Offline saves are accepted locally and surfaced as queued/saved
    locally in the shell.
13. Update Weather fetches provider data, builds a weather snapshot, refreshes
    the saved watering schedule, and persists the updated garden.
14. Active watering and weather alerts create in-app notification logs that are
    visible in the garden operations panel.
15. Settings lets the user manage alert types, push delivery, quiet hours,
    daily check time, location/timezone, web/native push registration, local
    notification support, and sample-garden enter/reset/restore controls.
16. `/app/today` syncs generated work from the saved garden plan, watering
    schedule entries, editable frost dates, crop catalog defaults, and actual
    planting events recorded from Plan or Today.
17. `/app/feed` records notes, structured issues, photo attachments, harvests,
    compact season summaries, actual watering events, and planting-event
    memories from the same garden aggregate.
18. The authenticated shell shows online/offline state and uses mobile bottom
    navigation for field use.
19. In the Capacitor shell, native network state feeds the same sync indicator,
    native camera capture can attach field photos, and Settings can register
    native push or local alerts when platform entitlements are present.

Important note:

- mock/local mode still uses the configured email allowlist as a user-facing gate
- Firebase mode uses Firebase Auth `gardenAccess: true` and
  `secretFaeriesMember: true` custom claims as the app and data authorization
  boundary
- `npm run auth:sync-access` grants those claims to the two configured
  production account emails from secure environment values and revokes them from
  stale Auth users
- the browser app exposes no account creation route; production accounts are
  seeded through the admin script
- Identity Platform blocking triggers are the next step if pre-auth membership
  enforcement becomes available for the Firebase project

## Garden model

Core Firestore shape:

- `users/{uid}`
- `users/{uid}/pushTokens/{tokenId}`
- Firebase Storage path
  `gardenWorkspaces/main/journal/{entryId}/{photoId}-{fileName}`
- `gardenWorkspaces/main`
- `gardenWorkspaces/main/drafts/{uid}`
- `gardenWorkspaces/main/revisions/{revisionId}`
- `gardenWorkspaces/main/journal/{entryId}`
- `gardenWorkspaces/main/harvests/{harvestId}`
- `gardenWorkspaces/main/tasks/{taskId}`
- `gardenWorkspaces/main/wateringSchedule/{entryId}`
- `gardenWorkspaces/main/weatherSnapshots/{snapshotId}`
- `gardenWorkspaces/main/notifications/{notificationId}`
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
  schemaVersion: 8,
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
`trellisLine`. Each planting stores shared crop/care state plus `instances[]`
for the internal plant positions shown inside grouped Plan footprints. The
shared `src/domain/gardens/plantingGeometry.ts` helper converts quantity,
spacing, mature spread, and row/block/cluster mode into deterministic dots and
footprint hulls so Plan rendering, optimizer constraints, and sun/shade logic do
not drift apart. Per-plant cages, stakes, stake-and-weave, row cover, and
netting choices live on the planting support plan; trellises remain saved
structure documents. `supportStructureIds[]` records explicit trellis links for
plantings whose app-created supports should move with them; nearby unlinked
trellises can satisfy support warnings but are not grouped for movement.
`plannedFor` stores an optional future date for approved succession plantings;
older saved plantings default to `null`.

Actual planting work is stored on each planting as a small event history.
Supported event types are `startedInside`, `directSowed`, `plantedOut`, and
`thinned`, each with a real event date. Plan, Today, and Feed use those events
to keep fit guidance, follow-up tasks, and memory entries grounded in what
actually happened instead of only relying on planned dates.

Structure planning supports raised beds, in-ground beds, containers, access
paths, and trellises in the primary flow. Plant-level supports such as cages,
stakes, stake-and-weave, row cover, and netting live on the planting support
plan instead of becoming global structure documents. `trellisLine` remains an
arrangement mode, not evidence that a real trellis exists. Legacy shade, fence,
compost, and water-source objects remain migration-readable, but schema version
5 drops them from saved page structures so Plan does not behave like a general
yard-survey tool. Structure positions and sizes use feet as canonical units.

Crop profiles are normalized from the checked-in generated catalog in
`src/domain/crops/homeGardenCropCatalog.generated.json`. The app can rebuild the
offline library with `npm run catalog:build` and refresh Trefle enrichment with
`npm run catalog:ingest:trefle`, but the editor does not call Trefle at runtime.
Runtime crop profiles include aliases, roles, source tags, profile completeness,
support profiles, and provenance quality so the Add Plant picker can show data
gaps without presenting source quality as a planning score. Support profiles
split plant-level supports from grid trellises and carry source tags for the
curated extension-backed defaults used by warnings, Review, Optimize, Choose
Plants, materials, tasks, crop focus, and the plant editor.

Starter garden templates live in `src/domain/gardens/gardenTemplates.ts`.
Templates create normal garden aggregates with structures and crop-backed
plantings; they do not create a second persistence model.

The sample garden builder lives in
`src/domain/gardens/sampleGarden.ts`. It creates a normal Detroit garden
aggregate and user profile for the resettable sample garden; it does not add a
parallel demo schema or payment/entitlement model. The shell and Settings
sample-garden controls save a browser-local backup, run the command through the
existing return-to plumbing, and return to the originating workspace whenever
possible; **Back to my garden** restores the real garden draft without turning
sample mode into a public funnel.

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

Weather snapshots and the watering schedule are currently embedded on
`gardens/{uid}`. The watering engine combines crop weekly water targets, bed or
container multipliers, mulch flags, recent rain, near-term forecast rain, heat
stress, optional evapotranspiration, journal water logs when present, and
planting lifecycle or recent planting-event state when demand changes after a
direct sow or transplant.

Notification preferences are stored on `users/{uid}`. They include push
delivery, per-alert-type toggles, quiet hours, daily watering check time,
timezone, thresholds, push consent status, and push permission metadata.
Notification logs are stored at `gardens/{uid}/notifications/{notificationId}`
for durable in-app history and push decisions. Legacy carrier-message, email
delivery, and phone fields are ignored during parsing.

Tasks are stored at `gardens/{uid}/tasks/{taskId}`. Generated tasks keep stable
ids so completed/skipped work does not reappear. Task records include due date,
type, source, source id, bed label, priority, snooze/defer state, and completion
time. The task engine generates work from crop defaults, planting date or
editable frost dates, sow method, support needs, thinning, pruning,
fertilizing, mulching, watering schedule entries, harvest windows, and recorded
planting events. Completing a sow/plant/transplant task updates the planting to
growing, records the matching planting event, and refreshes downstream
generated tasks from the real completion date; completing a water task marks
its schedule entry completed.

Journal entries are stored at `gardens/{uid}/journal/{entryId}`. Entries can
target the whole garden, a structure/bed, or an individual planting. Issue
entries add category, severity, and status fields. Photo attachments store
metadata on the journal entry while image binaries live in Firebase Storage.

Harvest events are stored at `gardens/{uid}/harvests/{harvestId}`. Harvests can
attach to a planting, store count/weight/bunch units, or use a freeform amount.
Feed summaries derive harvest totals, yield by crop, active beds, unresolved
issues, and watering alert acknowledgement from saved records.

- `xFt` is distance from the left plot edge.
- `yFt` is distance from the top plot edge.
- planting parent position is the arrangement center; each saved
  `instances[]` child is an individual plant node with its own canonical
  `xFt`/`yFt`.
- row, block, cluster, and trellis-line modes remain arrangement metadata used
  to derive backward-compatible instances and mature/group footprints.
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

## Today

Today is the field operations view over the saved garden. It auto-syncs
generated tasks on load, then persists user actions through `GardenRepository`.

- The calendar strip shows task counts across the next 7 days.
- Field cards lead with the next action, while metadata stays passive.
- The task list groups open work into selected-day action clusters, with
  generated/predictive work capped to the one-week field window.
- Context panels group open work by bed or plot area only when useful.
- Succession recommendations use estimated harvest dates, remaining days before
  first frost, saved sun/shade exposure, and dated bed occupancy to suggest a
  follow-on crop. Approving a suggestion creates a normal future planting with
  `plannedFor`, then generated tasks sync from that planting.
- Snooze moves a task to tomorrow; defer moves it one week later.
- Water done and task done are direct field actions. Harvest timing is shown as
  schedule context, and harvest logging stays an intentional memory entry
  instead of a generated task or automatic photo follow-up.

## Feed

Feed is the active-season memory layer. It persists through `GardenRepository`
as shared workspace operations and uses `MediaStorageService` only for attached
photo binaries.

- Notes can attach to the whole garden, a bed/structure, or a planting.
- Issues are structured as pest, disease, nutrient, weather damage, irrigation,
  or general observations with severity and status.
- Photos upload through Firebase Storage in Firebase mode and through data URLs
  in mock mode.
- Harvests can be logged by count, pounds, ounces, bunches, or freeform amount.
- Photo-update cards use a title, large central image, and caption hierarchy.
- Compact summaries show harvest totals, yield by crop, most active beds,
  unresolved issues, and water alerts sent versus acknowledged.

## Notification delivery

The browser handles web push registration and foreground display. The Capacitor
shell can additionally register native iOS/Android push tokens under the same
`users/{uid}/pushTokens/{tokenId}` path after platform entitlements and Firebase
native config files are present. Firebase Functions owns scheduled and
event-driven dispatch:

- `dailyWateringCheck` runs hourly in UTC, then checks each user's saved
  timezone and watering check time before sending active watering schedule
  alerts.
- `onGardenWeatherSnapshotUpdated` reacts when a new garden weather snapshot is
  saved and dispatches frost, heat-stress, or severe-weather alerts.

In-app history is the durable alert record and is not user-toggleable. Push is
the out-of-app cloud notification path. Local reminders are device-local native
capability for field follow-ups. Carrier messaging is outside product scope and
has no runtime, setup, rules, seed, or demo capability in the repo.

## Styling posture

- CSS Modules for component styles
- CSS custom properties for shared app tokens
- light theme only
- stable pixels-per-foot plot scale with a scrollable viewport
