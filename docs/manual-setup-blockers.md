# Manual Setup Blockers

Date: 2026-07-10

These release prerequisites require project-owner credentials, provider
configuration, real accounts, or physical devices. Passing CI does not satisfy
them.

Current release status:

- production `VITE_FIREBASE_MESSAGING_VAPID_KEY` is not configured
- the production workspace migration has not been reviewed/applied/rechecked
- `android/app/google-services.json` is absent
- the iOS Firebase plist is present, but native registration does not yet
  provide a safe FCM token path

These are release blockers, not CI failures. Do not push/deploy `main` or
advertise the affected push surfaces until they are resolved and smoke-tested.

## Firebase project and web app

Before Firebase-mode testing or deployment:

1. Select the production Firebase project and register its web app.
2. Enable Email/Password Authentication.
3. configure the six required browser values:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`,
   `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_MESSAGING_SENDER_ID`,
   `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_STORAGE_BUCKET`.
   Confirm public `VITE_FIREBASE_PROJECT_ID` exactly equals protected
   `FIREBASE_PROJECT_ID`; the live workflow rejects a mismatch.
4. Add localhost, preview, live Hosting, and any custom domain to Auth's
   authorized domains.
5. Configure ADC/Firebase CLI login for administrative scripts and the
   `FIREBASE_SERVICE_ACCOUNT` GitHub secret for deployment.
6. Run `npm run setup:firebase:live` where supported, then review the Firebase
   console rather than assuming every project setting is API-configurable.
7. Deploy Firestore rules/indexes and Storage rules before exposing migrated
   data to the client.

Incomplete browser configuration intentionally falls back to mock mode. A
release smoke must confirm the deployed build reports Firebase mode, not merely
that the page renders.

## Exactly two production accounts

Set secure local/workflow values for `APP_LOGIN_PRIMARY_EMAIL` and
`APP_LOGIN_PARTNER_EMAIL`. If the accounts do not exist, also set strong
temporary password values outside source control.

Review and run:

```sh
npm --prefix functions ci
npm run auth:seed-users -- --dry-run
npm run auth:seed-users
npm run auth:sync-access -- --dry-run
npm run auth:sync-access
```

The intended result is exactly two enabled Auth accounts with
`gardenAccess: true` and `secretFaeriesMember: true`. The sync command removes
those managed claims from other Auth users. Do not use
`-- --reset-passwords` unless password rotation is deliberate.

After a claim change, sign out/in or force an ID-token refresh. Verify that a
user missing either claim reaches `/access-denied` and cannot read Firestore or
Storage even if its email appears in a local allowlist.

## Required v2 workspace migration

Production data must be migrated before the v2 Hosting client is deployed. This
step is still outstanding for the current release. The
client does not silently interpret legacy `gardens/{uid}` or an older workspace
as current data.

1. Authenticate the Firebase CLI with an account allowed to read/write the
   target project.
2. Run a dry run:

   ```sh
   npm run migrate:workspace-v2:dry-run -- --project <project-id>
   ```

3. Preserve the generated mode-`0600` backup under
   `output/production-backups/` outside normal source control.
4. Review every proposed write and warning. In particular, confirm the chosen
   published source, per-user draft ownership, coordinate/timezone cleanup,
   crop-group water-profile snapshots, and legacy water logs. Ambiguous water
   notes must remain uncredited.
5. Apply only after review:

   ```sh
   npm run migrate:workspace-v2:apply -- --project <project-id>
   ```

6. Rerun the dry run. It must report the workspace already current: workspace
   schema 2, plan schema 9, matching revision IDs, and profile schema 2.
7. Smoke both accounts before deleting or archiving any legacy documents. The
   migration is additive and does not authorize destructive cleanup.

The 2026-07-10 live dry run is intentionally non-applicable: it produced zero
actions and 105 redacted geometry blockers across the published plan, two
drafts, and retained revisions. Every affected source has plantings without a
saved bed/container growing area; several also have instance/plot containment
issues. The backup is mode `0600`. Repair and review the actual legacy plans,
then rerun the dry run; never bypass these blockers or synthesize assignments.

## Real garden location

Watering accuracy requires a deliberate location label/query, exact valid
latitude/longitude pair, IANA timezone, hardiness zone, and typical frost dates.
First-run setup and Settings require these values. Environment variables and
seed scripts must not inject a default city. Lower-level operation code still
treats missing coordinates in incomplete/migrated data as safe soil-check mode.

Before enabling watering/weather alerts:

- compare the saved point and timezone with the intended garden
- refresh operations and inspect the provider, observation/forecast times,
  data-quality labels, reason codes, and crop-specific amounts
- compare at least two crop groups with different saved water profiles
- use a deliberately prepared non-production null-coordinate migration fixture
  to confirm safe soil-check output and no automatic weather/watering push

## Weather providers

NWS requires outbound network access and an identifying `NWS_USER_AGENT`. The
production workflow requires this variable, and the production value is now
configured. Tomorrow.io is optional; enable it only when a valid
server-side `TOMORROW_API_KEY` has been configured for Functions and the
additional provider has been intentionally accepted.

Perform a controlled production refresh and inspect Functions logs for the
chosen provider, fallback reason, failed signals, and stale/insufficient
classification. Do not treat a successful HTTP request as proof that rain or
evapotranspiration semantics are correct.

## Web push

Before claiming web push support:

1. Generate a Firebase Web Push certificate.
2. set the public `VITE_FIREBASE_MESSAGING_VAPID_KEY` build variable.
3. confirm `/firebase-messaging-sw.js` is served from the deployed origin and
   contains the intended Firebase config query.
4. enable push from Settings on each provisioned account/device and verify a
   token document under `users/{uid}/pushTokens/{tokenId}`.
5. generate controlled task and watering alerts.
6. verify foreground in-app banner, background system notification, exact
   Today deep link, separate crop-group alerts, same-alert retry coalescing,
   quiet-hour deferral, and private delivery history.
7. verify an invalid/expired token is removed after the provider reports it.

Web push registration must remain visibly unavailable when the VAPID key is
absent. It is currently absent from the production environment and is required
by the live workflow. Browser permission alone is not evidence that a token
exists. A provider-accepted send is not evidence that a device displayed it.

## Native builds

iOS setup requires a final bundle ID, Apple Developer access, Push
Notifications capability, an APNs auth key uploaded to Firebase,
`GoogleService-Info.plist`, release signing, and inclusion of
`PrivacyInfo.xcprivacy` in the target. The plist is currently present, but the
adapter correctly refuses to register its raw APNs token as FCM; a real FCM
token bridge is still required.

Android setup requires a final application ID, Firebase Android app,
`google-services.json`, release keystore/signing, and a suitable monochrome
notification icon. `android/app/google-services.json` is currently absent.

For both platforms:

- run the intended Capacitor sync/build flow
- confirm native token registration uses the correct platform label
- verify background tap and foreground in-app behavior on a physical device
- verify camera/photo upload permission behavior when photo capture is in scope
- verify Settings reports unsupported capabilities honestly outside a native
  shell

The mobile adapter can schedule local notifications, but the active v2 routes
do not currently create a separate device-local reminder schedule. Do not
describe local reminder delivery as production-ready without adding and testing
that workflow.

## GitHub live workflow

The live workflow needs:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT`
- `NWS_USER_AGENT`
- the six required Firebase browser variables
- secure primary/partner account email values
- `VITE_FIREBASE_MESSAGING_VAPID_KEY`

Confirm the workflow runs the full release gate, syncs access claims, and
verifies the protected/public Firebase project IDs match. Before deploy it
writes only the NWS identity into `functions/.env.<project-id>` with mode `0600`,
then deploys rules/indexes, Storage, Functions, and Hosting. The workspace
migration is a separately reviewed pre-deploy operation; a green workflow must
not be used to skip it.

## Final live verification

Before declaring the release ready:

- both accounts complete sign-in, shared publish, separate draft, and separate
  Settings/profile checks
- production rules deny a non-member and cross-user private writes
- canonical Functions generate separate balances/recommendations/tasks for each
  active crop group
- applied/partial/skipped water records affect only the selected group and skip
  remains zero credit
- corrected water keeps the same ID/crop/recorder, advances revision once, and
  replaces rather than duplicates ledger credit
- Feed photo upload/read and private delivery-history reads work
- web/native push works on every platform claimed by release notes
- a push marked sent is described as provider-accepted unless device display
  was separately observed
- a two-session publish conflict cannot silently overwrite the other account
- mobile/desktop routes have no serious console, network, focus, overflow, or
  touch defects
- rollback information and the migration backup are accessible to the project
  owner

## Explicitly excluded

Carrier messaging is not a setup blocker because it is not product scope. Do
not configure phone numbers, provider secrets, webhooks, fixtures, or smoke
tests for it.
