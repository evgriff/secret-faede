# Firebase

## Services in use

The production runtime uses:

- Firebase Authentication: email/password sessions for two provisioned users
- Cloud Firestore: canonical workspace, operations, profiles, tokens, receipts
- Cloud Storage: shared journal photos with uploader ownership
- Cloud Functions v2: deterministic operations and alert delivery
- Firebase Cloud Messaging: web and native push
- Firebase Hosting: the Vite SPA/PWA
- Local Emulator Suite: Auth, Firestore, Storage, Functions, and Hosting tests

There is no public account creation and no client-created membership record.

## Browser configuration

Firebase mode requires all of these public browser values:

```text
VITE_APP_RUNTIME=firebase
VITE_FIREBASE_API_KEY
VITE_FIREBASE_APP_ID
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
```

`VITE_FIREBASE_MESSAGING_VAPID_KEY` is required when web push registration is
offered. `VITE_ENABLE_PWA=false` is recommended during local debugging. The
Firebase web values are public configuration, but account emails, passwords,
service-account JSON, and server weather keys are not browser variables.

For emulators, set `VITE_USE_FIREBASE_EMULATORS=true`; host/port defaults match
`firebase.json` and can be overridden with:

```text
VITE_FIREBASE_EMULATOR_HOST
VITE_FIREBASE_AUTH_EMULATOR_PORT
VITE_FIREBASE_FIRESTORE_EMULATOR_PORT
VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT
VITE_FIREBASE_STORAGE_EMULATOR_PORT
```

The environment parser treats incomplete Firebase configuration as an explicit
mock fallback and provides a user-visible reason. Once Firebase repositories
are selected, missing or incompatible data is a recovery error, not a fallback.

## Project setup

Run `npm run setup:firebase:live` with `FIREBASE_PROJECT_ID` and suitable
administrator credentials to enable supported Auth settings and authorized
domains. Verify Email/Password sign-in in the Firebase console. Authorized
domains must include the live Hosting domains and any explicit custom domain;
do not add arbitrary origins.

Provision accounts from secret environment values:

```text
APP_LOGIN_PRIMARY_EMAIL
APP_LOGIN_PARTNER_EMAIL
APP_LOGIN_PRIMARY_TEMP_PASSWORD
APP_LOGIN_PARTNER_TEMP_PASSWORD
```

`npm run auth:seed-users` creates missing accounts and grants membership.
Existing passwords change only with its explicit reset option.
`npm run auth:sync-access` is the repeatable release command: it grants both
required claims to the two configured accounts and removes those managed claims
from any other Auth user.

Every authorized account must have both custom claims:

```json
{
  "gardenAccess": true,
  "secretFaeriesMember": true
}
```

After claims change, an existing session must refresh its ID token. The Firebase
auth adapter subscribes to ID-token changes so the route guard can re-evaluate
membership without storing account emails in the client bundle.

## Firestore contract

The live database must be migrated to workspace schema 2 and plan schema 9
before deploying the v2 client. Core paths are:

```text
gardenWorkspaces/main
gardenWorkspaces/main/plans/published
gardenWorkspaces/main/drafts/{uid}
gardenWorkspaces/main/revisions/{revisionId}
gardenWorkspaces/main/{journal|harvests|tasks|waterApplications}/{id}
gardenWorkspaces/main/{weatherSnapshots|waterBalances|wateringRecommendations|alerts}/{id}
users/{uid}
users/{uid}/pushTokens/{tokenId}
users/{uid}/notificationDeliveries/{deliveryId}
```

See `docs/data-model.md` for field contracts.

Firestore rules enforce:

- both membership claims on every app path
- private draft/profile/token/delivery ownership
- exact key sets, versions, IDs, bounds, dates/times, enums, and operation shape
- no direct client writes to workspace metadata, the published plan, or
  revisions
- no client writes to weather snapshots, balances, recommendations, alerts,
  delivery receipts, or automation leases

`publishGardenDraftV2`, `revertGardenPlanV2`, and
`publishGardenSettingsV2` are authenticated callables. Each requires both
membership claims, validates the complete schema-9 plan at the server boundary,
checks the expected revision, and owns the atomic metadata/published/revision
transaction. Shared settings publication preserves current published content
outside location/climate and rebases an existing actor draft onto the new
revision.

Rules are a data-shape and authorization boundary. They do not replace the
TypeScript validators used for safe rendering and clearer errors.

Required indexes live in `firestore.indexes.json`. Repository reads use bounded,
ordered queries; adding an unbounded collection scan is a design regression.

## Production migration

The migration is manual and backup-first. It must run before any v2 Hosting
deployment that would read a legacy workspace.

Authenticate the Firebase CLI locally, then dry-run:

```sh
node scripts/migrate-workspace-v2.mjs --project <project-id>
```

The command always reads the legacy roots/collections and writes a permission
mode `0600` JSON backup beneath ignored `output/production-backups/`. Dry run is
the default. It reports the project, backup path, revision, warnings, and exact
write count without changing Firestore.

Review the backup and every warning, especially legacy watering logs that could
not be assigned unambiguously to one crop group. Such logs are preserved as
field history where possible but are never credited to an arbitrary balance.
Then apply explicitly:

```sh
node scripts/migrate-workspace-v2.mjs --project <project-id> --apply
```

The migration creates the schema-9 published plan, matching immutable revision,
schema-2 metadata, private v2 drafts, normalized profiles, shared field records,
and only unambiguous water applications. Migrated applications receive the
explicit non-user actor `migration`; runtime readers use `legacy` only for
one-way normalization. It preserves server automation metadata and is idempotent
once metadata and published revision agree.

Do not run migration automatically on every CI deploy. It is an audited release
step because the backup/report and ambiguous historical records require human
review. Keep the backup until production smoke checks and rollback windows end.

## Storage

Journal objects use:

```text
gardenWorkspaces/main/journal/{entryId}/{uid}/{photoId}-{fileName}
```

The upload includes `entryId` and `userId` metadata. Rules require an authorized
uploader matching the UID path, an approved image content type, non-empty object,
and a maximum of 10 MiB. Members can read shared photos; only the uploader can
delete their objects; updates/overwrites are denied.

The Feed composer additionally validates count, type, and size before upload.
It creates IDs before uploading so Storage and Firestore metadata share the same
stable entry identity.

## Functions and weather

The Functions package runs on Node 22. `dailyWateringCheck` executes hourly in
UTC, then resolves each user's garden-local check/quiet hours. Running hourly
avoids encoding either user's timezone in the Cloud Scheduler definition.

`refreshGardenOperations` is an authenticated callable. It checks both custom
claims and requires the requested user ID to equal the caller. The operation
claim/commit protocol prevents overlapping scheduled/manual runs from
publishing competing balances and preserves concurrent task actions.

NWS is the default U.S. backend provider. Production requires an identifying
`NWS_USER_AGENT`; the configured live workflow writes it to a mode-`0600`
`functions/.env.<project-id>` immediately before Functions deployment.
Tomorrow.io is optional server-side enhancement only when both are present:

```text
ENABLE_TOMORROW_WEATHER=true
TOMORROW_API_KEY=<secret>
```

`TOMORROW_WEATHER_ENABLED=true` is also accepted for compatibility. Tomorrow.io
falls back to NWS on provider failure. Provider gaps are recorded as data quality
and reason codes; neither adapter fabricates rain or evapotranspiration.

Weather-derived operations require saved coordinates and an IANA timezone. With
no coordinates, Functions generates safe crop-group soil checks and other plan
tasks, but suppresses automatic weather/watering alerts.

## Push delivery

Web push requires a Firebase Web Push certificate and the public VAPID key in
the browser build. Native push additionally requires the platform Firebase files
in the native build system:

- `android/app/google-services.json`
- `ios/App/App/GoogleService-Info.plist`

Current repository status is asymmetric: the iOS plist is present in its app
target, while `android/app/google-services.json` is absent. The iOS client also
refuses to persist a raw APNs token as FCM; it remains unavailable until the
native shell exposes a real FCM registration token. Android remains
unconfigured until its Firebase file, signing, and real-device registration are
completed. Neither platform is presently release evidence for native push.

The client registers a token only after explicit user permission/consent.
Functions resolve current claimed members and read their schema-2 profiles.
Disabled kinds, disabled push, below-threshold watering, and quiet hours are
resolved per recipient. Quiet-hour deliveries are deferred rather than dropped.
Invalid tokens are retired. Delivery records are private and expose the exact
title/body/link and retry outcome in Settings. A `sent` push status means FCM
accepted the message; it does not prove device display or user receipt.

Web payloads are data-only so the service worker is the single background system
notification owner. Native payloads contain notification plus data fields for
the platform. Foreground events become in-app banners and do not create a second
page-owned system notification.

## Emulator verification

Start interactive emulators with `npm run emulators`. The automated rules gate
uses an isolated demo project:

```sh
npm run test:rules
```

It verifies member/non-member access, private documents, denial of direct
client publication writes, profile/token shape, actor/revision-safe field
operations, immutable server collections, automation metadata protection,
Storage ownership/content limits, and denial of all legacy/fallback paths.
