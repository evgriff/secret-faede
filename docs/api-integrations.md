# API Integrations

Date: 2026-07-09

The active v2 client owns no direct garden-data API calls. `AuthService`,
`GardenRepository`, and `UserProfileRepository` are its stable boundaries;
Firebase, weather, media, push, and mobile implementations are selected in
`src/v2/app/services.ts`.

## Firebase Auth

Firebase mode uses Email/Password Auth for two provisioned accounts. Access
requires both `gardenAccess: true` and `secretFaeriesMember: true` ID-token
claims. `FirebaseAuthService` listens for ID-token changes so membership changes
are reflected without treating a stale authentication event as authorization.

There is no registration integration or public sign-up route. Mock mode uses
the configured two-address allowlist only for local development and tests.

## Firestore and Storage

All shared client data belongs to the canonical `gardenWorkspaces/main`
workspace:

- `plans/published`: current shared plan
- `drafts/{uid}`: one private draft per member
- `revisions/{revisionId}`: immutable publish/revert history
- `journal/{entryId}`, `harvests/{harvestId}`, `tasks/{taskId}`, and
  `waterApplications/{applicationId}`: shared operational records
- `wateringRecommendations/{cropGroupId}`,
  `waterBalances/{cropGroupId}`, `weatherSnapshots/{snapshotId}`, and
  `alerts/{alertId}`: server-owned output

Private profile, token, and delivery state lives at `users/{uid}` and its
`pushTokens` and `notificationDeliveries` subcollections. The v2 client does
not use `gardens/{uid}` as active persistence; legacy documents are inputs only
to the explicit one-way migration.

Journal images use
`gardenWorkspaces/main/journal/{entryId}/{uid}/{photoId}-{fileName}`. The user
segment prevents one member from overwriting the other member's object. Photos
must pass client and Storage-rule type/size checks; there is no durable offline
binary-upload queue.

Clients may save only their own private draft directly. Publication crosses
the callable Functions boundary:

- `publishGardenDraftV2`: validates and publishes the actor's current draft
- `revertGardenPlanV2`: restores a selected immutable revision as a new publish
- `publishGardenSettingsV2`: publishes only shared location/climate and rebases
  the actor's private draft when one exists

All three require both membership claims and an expected revision. Firestore
rules deny direct client writes to workspace metadata, `plans/published`, and
`revisions`.

## Canonical Functions

`functions/index.js` exports three v2 operation entry points:

- `dailyWateringCheck`: runs at minute 0 of every hour in UTC. A workspace
  claim/lease ensures only one worker publishes output, and the saved garden
  timezone/check time determines whether a non-forced run is due.
- `refreshGardenOperations`: authenticated callable refresh. It requires both
  membership claims and accepts only the signed-in user's own uid.
- `onGardenWeatherSnapshotUpdated`: creates frost, heat, and severe-weather
  alerts from a newly committed canonical weather snapshot.

An operation run validates workspace schema 2, plan schema 9, revision linkage,
feet-based geometry, IANA timezone, coordinates, structures, and crop-group
water profiles before calculation. It loads the exact published revision,
claims a 15-minute lease, reads shared applications/balances/tasks, calculates
operations, preserves concurrent field actions, and commits only if the
published revision and shared water ledger are still compatible.

The worker writes one balance and one recommendation per active crop group,
the weather snapshot, and stable generated tasks. It never writes client-owned
drafts or profiles.

## Weather providers

The National Weather Service adapter is the default U.S. provider. It resolves
the saved point, current conditions, forecast, alerts, recent precipitation,
and available agricultural signals. Tomorrow.io is an optional server-side
enhancement when explicitly enabled and given a server key; NWS remains its
fallback.

Provider behavior is intentionally conservative:

- location comes only from the saved latitude/longitude pair
- no city, station, rainfall, or evapotranspiration value is substituted for
  missing evidence
- recent precipitation and forecast quality are labeled fresh, cached, stale,
  or insufficient
- failures are logged by signal and become safe unavailable inputs
- process-local caches may serve a labeled stale value after a provider error
- precipitation probability or descriptive rain is not credited as observed
  water

Without coordinates, the provider is not called. The worker records an
unavailable weather snapshot, retains non-weather tasks, returns one low-
confidence `checkSoil` recommendation for each active crop group, and suppresses
automatic weather/watering push.

## Deterministic crop-group watering

`crop-water-balance-v2` calculation revision 1 is the behavior contract used by
the TypeScript client domain and production Functions implementation. Each
calculation is a pure function of:

- the exact calculation instant and valid garden timezone
- one crop group's saved/versioned water-profile snapshot
- lifecycle-derived or explicit stage and stage coefficient
- measured/geometry/estimated area and linked growing structure
- structure soil depth/type, drainage, container status, mulch, and irrigation
  context
- the compatible prior crop-group balance and application ledger
- ordered historical observations and forecast periods with unique source IDs
- explicit applied, partial, or skipped water records, actor/revision identity,
  and application efficiency

The model caps the effective root zone by structure soil depth, accrues ET,
credits observed rain and explicit applied/partial water, applies crop/soil/container/
mulch factors, and projects forecast depletion against that crop group's own
trigger. Partial credits only its recorded amount; a skipped application always
receives zero credit. An unknown amount
is never converted to inches, and gallons are omitted when growing area is not
reliable.

Every result carries model/revision identifiers, a profile fingerprint,
calculation and recheck times, basis, confidence, data quality, root-zone
capacity, current/projected depletion, trigger, optional depth/gallons, reason
codes/details, source IDs, status, action, and an exact crop-group deep link.
Possible statuses are `due`, `scheduled`, `suppressed`, and `checkSoil`.

Uncertain inputs lower confidence or produce a soil check instead of false
precision. Only an actionable `due` result with a positive depth can create a
watering alert, and per-user delivery still applies the enabled alert kind,
minimum deficit, consent, timezone, and quiet hours.

The client prefers fresh persisted Functions results. If none is available, it
creates only a conservative per-crop soil-check card; it does not reproduce a
supposedly authoritative server amount.

## Task automation

Functions derive stable tasks for crop-group watering or soil checks, lifecycle
and planting timelines, support, thinning, feeding, pruning, mulching,
inspection/weeding, harvest, succession review, and evidence-backed frost/heat
preparation. Regeneration merges matching open generated tasks while preserving
concurrent user completion, snooze, defer, and reopen state. Task alerts link to
the exact task in Today.

## Notification delivery

Alerts are durable shared facts under the workspace; delivery decisions and
receipts are private to each member.

For every stable alert ID, Functions:

1. list enabled Auth users with both membership claims
2. validate user-profile schema 2 and notification preferences
3. always record an in-app delivery receipt
4. apply alert-kind consent, watering threshold, push consent, timezone, and
   quiet hours before push
5. defer quiet-hour push until the exact local quiet-hours end
6. ask FCM to accept payloads, remove invalid tokens, retry transient failures,
   and record provider acceptance/failure

Stable alert/delivery IDs make retries idempotent. Separate crop-group IDs keep
different watering alerts distinct.

Web tokens receive data-only FCM payloads. `firebase-messaging-sw.js` displays
the background notification, tags it with the alert ID, and focuses or opens
the exact deep link. Foreground web messages become in-app banners so the page
does not duplicate the service worker's system notification.

Native iOS/Android tokens receive platform notification-plus-data payloads and
foreground messages also use the in-app banner path. The Capacitor adapter can
report and schedule device-local notifications, but current v2 routes do not
create an independent local-reminder schedule; Settings reports capability
without claiming registration or delivery occurred.

The persisted push status `sent` means FCM accepted the request, not that a
device displayed it. Current native registration is not release-ready: Android
lacks `google-services.json`, and iOS requires an FCM-token bridge rather than
registering the raw APNs token. Settings exposes these states as unconfigured.

## Local crop catalog

Trefle is an optional ingestion/enrichment source, never a runtime dependency.
The active crop picker reads the checked-in local catalog. Catalog records are
combined with curated garden fields, and each saved crop group receives its own
water-profile snapshot so a later catalog refresh cannot silently change a
published plan's watering behavior.

- `npm run catalog:build` rebuilds the local catalog.
- `TREFLE_API_TOKEN npm run catalog:ingest:trefle -- --write` explicitly
  refreshes source data.

## External references

- [Firebase scheduled functions](https://firebase.google.com/docs/functions/schedule-functions)
- [Firebase Cloud Messaging token management](https://firebase.google.com/docs/cloud-messaging/manage-tokens)
- [Firebase Cloud Messaging web receive behavior](https://firebase.google.com/docs/cloud-messaging/web/receive-messages)
- [National Weather Service API](https://www.weather.gov/documentation/services-web-api)
- [Tomorrow.io weather data layers](https://www.tomorrow.io/weather-api/data-layers/)
- [Trefle getting started](https://docs.trefle.io/docs/guides/getting-started/)

## Known integration limits

- provider caches are process-local rather than durable shared caches
- weather behavior still needs periodic contract checks against live provider
  responses
- production web push is blocked until the VAPID build variable is configured
- native push is blocked until each claimed platform has complete Firebase
  configuration, a valid FCM token path, signing, and real-device smoke tests
- native local-notification capability exists, but v2 has no separate local
  scheduling workflow
- photo uploads require a connection
- production schema migration is an explicit pre-deploy step, not a runtime
  compatibility mode

Carrier messaging is explicitly excluded. Do not add phone/contact fields,
carrier providers, webhooks, or delivery fallbacks.
