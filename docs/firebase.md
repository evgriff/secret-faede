# Firebase

## What this milestone uses

- Firebase Authentication
- Firestore
- Firebase Hosting
- Firebase Storage for journal photos
- Firebase Cloud Messaging for web push registration and delivery
- Firebase Cloud Functions for notification dispatch
- Cloud Scheduler through scheduled Firebase Functions
- Firebase Local Emulator Suite

Not included now:

- blocking triggers
- email delivery
- carrier messaging

## Required web-app setup

1. Create or choose a Firebase project.
2. Register a web app in that project.
3. Copy the Firebase web config values into `.env.local` or GitHub repository variables.
4. Enable Authentication.
5. Enable `Email/Password`.
6. Leave public sign-up UI out of the app; create only the two intended users
   through `npm run auth:seed-users`.
7. Add authorized domains for every environment that will host the app.

Important:

- the app signs in with Firebase Email/Password only
- `/auth/complete` is a legacy redirect back to `/sign-in`
- do not add client account creation paths
- in Firebase projects created after April 28, 2025, `localhost` is not added automatically; add it yourself

## Authorized domains checklist

Add these as needed:

- `localhost`
- `127.0.0.1`
- your Firebase Hosting domain: `your-project.firebaseapp.com`
- your Firebase Hosting site domain: `your-project.web.app`
- any custom production domain

Preview caution:

- Firebase Hosting preview channels use separate preview URLs
- those preview deployments still talk to real backend resources if you point them at a live Firebase project
- this repo keeps preview builds mock-first by default, so preview auth should not be assumed to work unless you intentionally reconfigure it

## Environment variables

Required runtime variables:

```bash
VITE_ALLOWED_EMAILS=primary.gardener@example.com,partner.gardener@example.com
VITE_APP_RUNTIME=mock|firebase
VITE_ENABLE_PWA=true|false
VITE_USE_FIREBASE_EMULATORS=true|false
```

Firebase web config values for `firebase` runtime:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MESSAGING_VAPID_KEY=...
VITE_FIREBASE_EMULATOR_HOST=127.0.0.1
VITE_FIREBASE_AUTH_EMULATOR_PORT=9099
VITE_FIREBASE_FIRESTORE_EMULATOR_PORT=8080
VITE_FIREBASE_STORAGE_EMULATOR_PORT=9199
VITE_GOOGLE_MAPS_API_KEY=...
VITE_ENABLE_TOMORROW_WEATHER=false
VITE_TOMORROW_API_KEY=...
```

Server-side function variables and secrets:

```bash
TOMORROW_API_KEY=...
```

Auth seed variables:

```bash
APP_LOGIN_PRIMARY_EMAIL=...
APP_LOGIN_PARTNER_EMAIL=...
APP_LOGIN_PRIMARY_TEMP_PASSWORD=...
APP_LOGIN_PARTNER_TEMP_PASSWORD=...
FIREBASE_PROJECT_ID=...
```

Carrier messaging is no longer product scope. Do not configure phone-number
seed values, carrier provider secrets, dry-run flags, or carrier webhooks for
new work.

`VITE_ALLOWED_EMAILS` rules:

- exactly two entries
- normalized to lowercase and trimmed before comparison
- duplicates after normalization are invalid
- invalid allowlist config fails closed with a visible UI error

## Runtime switching

Mock mode:

- `npm run dev`
- no Firebase config required

Firebase emulator mode:

- copy `.env.local.example` to `.env.local`
- keep `VITE_APP_RUNTIME=firebase`
- keep `VITE_USE_FIREBASE_EMULATORS=true`
- run `npm run emulators`
- run `npm run dev:firebase:emulators`

Firebase live mode:

- set `VITE_APP_RUNTIME=firebase`
- set `VITE_USE_FIREBASE_EMULATORS=false`
- provide all `VITE_FIREBASE_*` values
- run `npm run dev`

If Firebase mode is requested without complete web config, the app falls back to mock mode and tells the user why.

## Firestore garden document

Firebase mode stores one shared published garden with per-user drafts:

```text
users/{uid}
users/{uid}/pushTokens/{tokenId}
gardenWorkspaces/main
gardenWorkspaces/main/drafts/{uid}
gardenWorkspaces/main/revisions/{revisionId}
gardenWorkspaces/main/journal/{entryId}
gardenWorkspaces/main/harvests/{harvestId}
gardenWorkspaces/main/tasks/{taskId}
gardenWorkspaces/main/wateringSchedule/{entryId}
gardenWorkspaces/main/weatherSnapshots/{snapshotId}
gardenWorkspaces/main/notifications/{notificationId}
gardens/{uid}
gardens/{uid}/structures/{structureId}
gardens/{uid}/plantings/{plantingId}
gardens/{uid}/tasks/{taskId}
gardens/{uid}/journal/{entryId}
gardens/{uid}/harvests/{harvestId}
gardens/{uid}/notifications/{notificationId}
catalog/{cropId}
```

`gardenWorkspaces/main` is the current published revision.
`gardenWorkspaces/main/drafts/{uid}` is the user's private draft with
`baseRevisionId`. `gardenWorkspaces/main/revisions/{revisionId}` stores
published history for revert. Feed and Today operations live in the shared
workspace subcollections so both provisioned users see activity immediately
without publishing private Plan drafts. `gardens/{uid}` remains a migration
source for older saved gardens and seed data.

Garden document shape:

```ts
{
  id: string,
  userId: string,
  updatedAt: serverTimestamp(),
  updatedAtIso: string,
  name: string,
  climateProfile: {
    hardinessZone: string,
    averageLastFrost: "MM-DD",
    averageFirstFrost: "MM-DD",
    editableByUser: boolean
  },
  plot: {
    widthFt: number,
    depthFt: number,
    orientationDegrees: number,
    location: {
      locationName: string,
      locationQuery: string,
      latitude: number | null,
      longitude: number | null,
      timezone: string
    }
  }
}
```

Sun/shade layers are stored on the garden document under `sunShadeLayers`.
Generated and manually overridden cells use feet-based `xFt`, `yFt`, `widthFt`,
and `depthFt` values; raw pixels are never persisted.

Weather snapshots and watering schedule entries are stored on the garden
document under `weatherSnapshots` and `wateringSchedule`. Schedule entries
store target entity, current root-zone depletion, actionable watering amount,
urgency, rationale, suppress-until time, status, and optional `waterBalance`
metadata. Legacy `waterRecommendations` records still parse into
`wateringSchedule` for compatibility. Snapshot forecast days may also include
optional direct NWS rain metadata (`rainLikely`, `rainSignalSource`,
`rainSummary`, `rainWindowStartIso`, `rainWindowEndIso`, and
`rainAmountSource`). `expectedRainIn` remains quantitative QPF only; probability
and text signals are qualitative context, not stored rain credit.

Tasks are stored in `gardens/{uid}/tasks/{taskId}`. Generated task ids are
stable and source-linked, so completed/skipped work is not duplicated on the next
schedule sync. Task records include bed label, due date, type, source, source
id, priority, snoozed/deferred dates, completion timestamp, and related planting
or structure ids.

Journal entries are stored in `gardenWorkspaces/main/journal/{entryId}`.
Entries can target the whole garden, one structure/bed, or one planting. Issue
entries add category, severity, status, and poster metadata. Photo attachments
store metadata on the journal entry while the image binary is stored in Firebase
Storage under `gardenWorkspaces/main/journal/...`.

Harvest events are stored in `gardens/{uid}/harvests/{harvestId}`. Harvests can
attach to plantings and support count, pounds, ounces, bunches, or freeform
amount text.

Notification preferences are stored on `users/{uid}`. In-app history is always
available. The production UI exposes push delivery, alert-type toggles for
watering, frost, heat stress, severe weather, and task due; quiet hours; daily
check time; thresholds; timezone; push consent; and push permission metadata.
Legacy carrier-message, email delivery, and phone fields are ignored during
parsing and are not exposed.

Push tokens are stored in `users/{uid}/pushTokens/{tokenId}`. The browser writes
these through Firebase Messaging registration after the user grants permission.

Notification decisions are logged in
`gardens/{uid}/notifications/{notificationId}` with the channel, type, body,
provider, redacted recipient, status, dry-run flag, and optional error message.

Plantings are stored in `gardens/{uid}/plantings/{plantingId}`. Parent planting
positions and child plant-instance positions are always `xFt` from the left
plot edge and `yFt` from the top plot edge. Planting modes are `single`, `row`,
`block`, `cluster`, and `trellisLine`.

Offline behavior:

- `getFirestoreClient()` initializes Firestore with `persistentLocalCache()` and
  a multi-tab manager.
- Firestore handles cached reads and its native offline write queue when
  available in the browser.
- `FirebaseGardenRepository` also stores the latest pending garden aggregate
  save in localStorage while `navigator.onLine` reports offline, then flushes it
  on the next online event or the next online load/save.
- Online aggregate saves replace known nested garden subcollections and delete
  stale nested documents that are no longer present in the saved garden. This
  keeps demo reset, delete flows, and one-garden persistence consistent.
- The backup queue is scoped to the garden aggregate and nested garden
  collections. Firebase Storage photo uploads still require network access.

Rules require the signed-in user to carry Firebase Auth custom claims
`gardenAccess: true` and `secretFaeriesMember: true`. Members can read and write
the shared published workspace and revision history. Users can only read and
write their own draft document, their own `users/{uid}` profile paths, and
legacy `gardens/{uid}` paths. Authenticated garden members can read
`catalog/{cropId}`; client writes to the catalog are blocked.

## Storage

Journal photos use Firebase Storage path:

```text
gardenWorkspaces/main/journal/{entryId}/{photoId}-{fileName}
```

`storage.rules` allows any authenticated member with `gardenAccess: true` and
`secretFaeriesMember: true` to read or write shared journal images under
`gardenWorkspaces/main/journal/...`. Writes are limited to image content types
under 10 MB. The legacy `users/{uid}/journal/...` prefix remains readable and
writable only by the owning user for old attachments.

In mock mode, `MockMediaStorageService` stores photo attachments as data URLs in
the saved journal entry metadata. In Firebase emulator mode, Storage connects to
`VITE_FIREBASE_STORAGE_EMULATOR_PORT`, default `9199`.

## Notifications

Client web push:

- `VITE_FIREBASE_MESSAGING_VAPID_KEY` must be set for real FCM token
  registration.
- The client registers `public/firebase-messaging-sw.js` and stores web tokens
  under `users/{uid}/pushTokens/{tokenId}`.
- Foreground messages are bridged into browser notifications when permission is
  granted.
- Denied or unsupported push permission is handled without blocking the app.

Firebase Functions:

- `dailyWateringCheck` runs hourly in UTC, then checks each user's saved
  timezone and `defaultWateringCheckTime` before generating work. The Detroit
  demo default is 7:15 AM `America/Detroit`.
- `onGardenWeatherSnapshotUpdated` dispatches frost, heat-stress, and
  severe-weather alerts when a new weather snapshot changes risk state.

Carrier messaging:

- Removed from product scope for the current product overhaul.
- Do not add setup steps, demo paths, phone-number seed values, dry-run flags,
  provider secrets, webhooks, or new tests for carrier delivery behavior.

## Dev seed

`npm run auth:seed-users`

The auth seed script creates or updates the two intended production users from
environment variables:

- `APP_LOGIN_PRIMARY_EMAIL`
- `APP_LOGIN_PARTNER_EMAIL`
- `APP_LOGIN_PRIMARY_TEMP_PASSWORD`
- `APP_LOGIN_PARTNER_TEMP_PASSWORD`

It assigns display names `Primary Gardener` and `Partner Gardener`, verifies email, enables the
accounts, and sets `gardenAccess: true` plus `secretFaeriesMember: true`. Existing
user passwords are not overwritten unless `-- --reset-passwords` is passed. Use
`npm run auth:seed-users -- --dry-run` before writing to a live project.

`npm run seed:dev`

The seed script creates an Detroit demo profile and garden for an existing
Firebase Auth user. It does not create Auth users.

User selection:

- `SEED_USER_UID` and `SEED_USER_EMAIL` use an explicit user id and email.
- otherwise `SEED_USER_EMAIL` or the first `VITE_ALLOWED_EMAILS` entry is looked
  up in Firebase Auth.

Seeded data:

- `users/{uid}` with an Detroit climate profile and notification preferences
- `gardens/{uid}` with an Detroit plot location and orientation
- one raised bed, one trellis, and one pathway under `structures`
- sample tomato, radish, and pole bean plantings under `plantings`
- sample weather, watering, tasks, journal, harvest, and notification records
  for demo-ready Plan, Today, Feed, and Settings surfaces
- tomato, radish, and pole bean crop catalog records under `catalog`,
  derived from the same curated crop catalog used by the editor

Use `node scripts/seed-dev.mjs --dry-run` to validate the seed payload without
writing to Firestore. Do not seed phone-number delivery data.

Weather provider notes:

- National Weather Service is the default provider and does not require a key.
- `VITE_TOMORROW_API_KEY` is a browser-exposed optional key. Use only a
  restricted key if enabling Tomorrow.io in the client; server-side Tomorrow
  access should use `TOMORROW_API_KEY` from Cloud Functions later.

## Crop catalog ingestion

`npm run catalog:ingest:trefle`

Use `npm run catalog:build` to rebuild the checked-in offline library at
`src/domain/crops/homeGardenCropCatalog.generated.json`. The Trefle ingestion
script reads that local catalog, queries Trefle search with `TREFLE_API_TOKEN`,
normalizes refreshed records into the app `CropProfile` shape, and can write the
local generated JSON catalog with `--write`. The runtime editor uses checked-in
local catalog data and does not depend on Trefle availability during normal user
interaction.

## Live setup helper

`npm run setup:firebase:live`

This script does one thing only:

- enables Email/Password sign-in
- patches authorized domains for the supplied `FIREBASE_PROJECT_ID`

Optional:

- set `FIREBASE_AUTH_DOMAINS=example.com,preview.example.com` to append additional domains

## Allowlist limitation

The two-email allowlist is enough for the current fallback, but it is not a hard
pre-auth restriction. The app has no public sign-up UI and the data layer
requires membership claims, but Firebase Email/Password projects without
Identity Platform do not provide app-level blocking triggers.

Future hard enforcement option:

- Firebase Auth blocking triggers with Identity Platform

That option is intentionally not implemented in this milestone.
