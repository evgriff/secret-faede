# API Integrations

Date: 2026-04-21

## Firebase Cloud Functions

- `dailyWateringCheck` now runs hourly in UTC and filters users by their saved
  `notificationPreference.defaultWateringCheckTime` in that user's local
  timezone. This avoids one global Detroit-only watering check while keeping
  Cloud Scheduler simple.
- `refreshGardenOperations` is an authenticated callable manual refresh. It
  only accepts the signed-in user's own uid, generates operations on the
  backend, writes Firestore, and lets the client reload through
  `GardenRepository`.
- Functions write the garden document with `waterRecommendations`,
  `weatherSnapshots`, `operationsLastGeneratedAtIso`,
  `operationsLastGeneratedLocalDate`, and `operationsLastProviderId`.
- Generated tasks are written to `gardens/{uid}/tasks` with stable ids so
  completed, snoozed, deferred, and skipped task state is preserved.
- Firebase scheduled functions are backed by Cloud Scheduler and an HTTP
  function created by the Firebase CLI:
  <https://firebase.google.com/docs/functions/schedule-functions>

## Weather Providers

- NWS is the default U.S. provider.
- Tomorrow.io is optional and only used when `ENABLE_TOMORROW_WEATHER=true` or
  `TOMORROW_WEATHER_ENABLED=true` and `TOMORROW_API_KEY` is present.
- Tomorrow.io handles enhanced forecast and evapotranspiration fields when
  available. NWS remains the fallback for alerts, recent precipitation, and any
  Tomorrow.io request failure.
- Provider decisions are logged with `providerId`, fallback provider, and
  reason. Request failures log the failed signal and whether stale cache was
  used.
- Both backend providers use short in-memory read-through caching. When a fresh
  request fails and a stale value exists, the stale value is used and logged.
  If there is no cached value, the failed signal falls back to a conservative
  empty weather signal so operations can still generate with limited quality.

Official references:

- NWS API overview and `/points` discovery:
  <https://www.weather.gov/documentation/services-web-api>
- NWS active alerts:
  <https://www.weather.gov/documentation/services-web-alerts>
- Tomorrow.io data layers, including evapotranspiration:
  <https://www.tomorrow.io/weather-api/data-layers/>

## Plant Catalog: Trefle

Trefle is the catalog ingestion/enrichment source, not a runtime dependency.
The browser imports the checked-in generated catalog at
`src/domain/crops/homeGardenCropCatalog.generated.json`; no normal app screen
calls Trefle.

Pipeline:

1. `npm run catalog:build` builds the offline home-garden catalog from the
   curated overlay and generated variety-group profiles.
2. `npm run catalog:ingest:trefle -- --write` refreshes the checked-in catalog
   with Trefle search results when `TREFLE_API_TOKEN` is available.
3. The curated overlay supplies gardening-specific fields that Trefle may not
   provide reliably for planning: spacing, row spacing, sow method, water need,
   support/trellis defaults, root depth, planting modes, pollinator role, and
   caution notes.
4. Runtime search uses local JSON only. Generated variety-group records are
   labeled as derived profiles and tell users to verify cultivar-specific timing
   from the seed packet or nursery tag.

Provenance fields on every crop profile:

- `source`: currently `trefle+curated-overlay` for shipped records.
- `lastRefreshedIso`: build or Trefle refresh timestamp.
- `manualOverride`: true when gardening heuristics override or supplement source
  data.
- `sourceTags`: machine-readable tags such as `trefle-query`,
  `curated-overlay`, `generated-variety-profile`, and Trefle ids when refreshed.
- `profileConfidence` and `completenessScore`: local quality labels for planner
  use.

Official references:

- Trefle getting started and token requirement:
  <https://docs.trefle.io/docs/guides/getting-started/>
- Trefle plant/species search with the `q` parameter:
  <https://docs.trefle.io/docs/guides/searching/>
- Trefle filters and null exclusion:
  <https://docs.trefle.io/docs/guides/filtering/>

## Watering Model

Watering recommendations now record:

- `generatedBy`: `backend`, `client`, or `manualRefresh`
- `refreshedAtIso`
- `dataQuality`: `complete`, `partial`, or `limited`

Backend recommendation inputs:

- crop or planting weekly water target
- recent rainfall
- forecast rainfall with partial credit
- heat stress multiplier
- evapotranspiration when the provider supplies it
- container/raised-bed multiplier
- mulch flag
- soil type
- drainage profile
- manual watering logs from journal notes
- irrigation zone label when assigned

Recommendations preserve history and stable ids. Old active/new
recommendations from prior dates are suppressed rather than deleted so Today
does not keep showing stale work.

## Task Automation

Backend generation writes:

- watering tasks from active backend recommendations
- frost-prep tasks when the saved weather snapshot has frost watch/warning
- heat-prep tasks when the saved weather snapshot has heat watch/warning
- upcoming planting tasks from saved planned dates
- succession review tasks for harvest-ready or harvested plantings

The backend does not delete existing user tasks. It refreshes matching open
generated tasks only when they are not snoozed or deferred.

## Client Fallbacks

- The Plan "Update weather" action first attempts the backend callable in
  Firebase mode. If the callable is unavailable, it falls back to the existing
  client-side weather/watering path.
- Mock mode keeps the client-side generator.
- The browser weather cache can now return stale cached data if a refresh
  request fails.

## Notification Delivery

### In-app

- In-app notification logs are durable Firestore documents under
  `gardens/{uid}/notifications/{notificationId}`.
- Logs now include delivery status plus user-facing `acknowledgedAtIso` and
  `dismissedAtIso` state.
- The Settings notification center reads the same log stream and filters by
  alert type.

### Web push

- Browser push registration uses FCM, stores tokens under
  `users/{uid}/pushTokens/{tokenId}`, and records token freshness timestamps.
- Foreground messages open `/app/today`; background notification clicks are
  handled in `firebase-messaging-sw.js` before importing FCM scripts so custom
  click handling is not overwritten.
- Failed FCM sends remove invalid/stale token documents when Firebase returns a
  registration-token error.
- FCM recommends storing tokens server-side with timestamps and refreshing token
  freshness over time:
  <https://firebase.google.com/docs/cloud-messaging/manage-tokens>
- FCM web receive/click behavior reference:
  <https://firebase.google.com/docs/cloud-messaging/web/receive-messages>

### Native and local notifications

- Capacitor-native push registration is exposed through the same
  `NotificationService` contract where native capabilities are available.
- Local notifications are used for device-local reminders such as harvest
  "not ready" follow-ups when the native shell reports support.
- Web/PWA remains fully usable without native notification capability; Settings
  reports unavailable native hooks instead of pretending registration happened.

### carrier messaging

- carrier messaging sends remain backend-only from Cloud Functions.
- Push is the primary out-of-app channel. carrier messaging is attempted only when push does
  not send for frost, heat-stress, or severe-weather alerts.
- `NOTIFICATION_DRY_RUN` defaults to dry-run unless explicitly set to `false`,
  `RETIRED_DELIVERY_PROVIDER_API_KEY` is present, and `RETIRED_DELIVERY_PROVIDER_FROM_NUMBER` is configured.
- carrier messaging sends require:
  - channel enabled
  - alert type enabled
  - quiet-hours pass
  - E.164 phone on the profile
  - stored carrier messaging consent with `status: granted`
  - high-value fallback alert type
  - push skipped or failed
  - rate limit pass
- Guardrails:
  - duplicate notification suppression
  - 3 carrier messaging/hour and 12 carrier messaging/day per garden log scan
  - one retry for notification provider 429/5xx responses
  - durable attempt logs with provider message id/status when available
  - notification provider status webhook updates provider delivery status
  - notification provider inbound webhook syncs START/STOP/HELP keyword intent into consent
    state and writes `users/{uid}/smsEvents`
- notification provider sends carrier messaging through `POST https://api.retiredDeliveryProvider.com/v2/messages` using
  `from`, `to`, and `text` fields with bearer-token auth:
  <https://developers.retiredDeliveryProvider.com/docs/messaging/messages/send-message>
- notification provider messaging webhooks deliver `message.received`, `message.sent`, and
  `message.finalized` events. Secret Faede verifies
  `retiredDeliveryProvider-signature-ed25519` and `retiredDeliveryProvider-timestamp` headers by default:
  <https://developers.retiredDeliveryProvider.com/docs/messaging/messages/receiving-webhooks>

## Required Secrets And Env

- `TREFLE_API_TOKEN`: optional local-only catalog refresh token. It is never
  required by the deployed app and must not be exposed to browser runtime config.
- `TOMORROW_API_KEY`: optional Functions secret/env for Tomorrow.io.
- `ENABLE_TOMORROW_WEATHER=true` or `TOMORROW_WEATHER_ENABLED=true`: opt in to
  Tomorrow.io on Functions.
- `NWS_USER_AGENT`: optional identifying User-Agent for NWS requests.
- `RETIRED_DELIVERY_PROVIDER_API_KEY`: Functions-only credential for live carrier messaging fallback.
- `RETIRED_DELIVERY_PROVIDER_FROM_NUMBER`: E.164 notification provider sender number.
- `RETIRED_DELIVERY_PROVIDER_PUBLIC_KEY`: notification provider webhook public key for Ed25519 signature
  verification.
- `RETIRED_DELIVERY_PROVIDER_MESSAGING_PROFILE_ID`: optional profile id when the configured sender
  requires one.
- `RETIRED_DELIVERY_PROVIDER_WEBHOOK_URL`: optional per-message callback URL when not relying on a
  Messaging Profile webhook.
- `RETIRED_DELIVERY_PROVIDER_VALIDATE_WEBHOOKS=false`: local/emulator-only escape hatch. Keep
  validation on in production.
- `DEFAULT_ALERT_PHONE_E164`: remains the only source for the default dev/demo
  phone. It must not be committed.

## Known Gaps

- Backend weather cache is in-memory per Functions instance, not Firestore or
  Memorystore-backed.
- The scheduled job scans all user documents hourly. That is acceptable for the
  current prototype, but should become a query/indexed schedule queue before
  scale.
- NWS evapotranspiration is not available in this adapter; ET only appears when
  Tomorrow.io returns it.
- Soil type, drainage profile, and irrigation zone fields are persisted but do
  not yet have dedicated Settings/Inspector controls beyond existing object
  editing paths.
