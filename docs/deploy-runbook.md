# Deploy Runbook

Date: 2026-04-21

This runbook describes the production path the repo can actually run today:
Firebase Hosting, Firebase Auth Email/Password, Firestore, Storage, Cloud
Functions, FCM web/native push, and optional Capacitor shells.

## Preflight

- Use Node 22 for local parity.
- Run `npm ci` and `npm --prefix functions ci` after dependency changes.
- Keep all private values out of browser env and source files.
- Confirm live build repository variables:
  - `VITE_APP_RUNTIME=firebase`
  - `VITE_ENABLE_PWA=true`
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
- Confirm optional live build repository variables for web push registration:
  - `VITE_FIREBASE_MESSAGING_VAPID_KEY`
- Confirm live production secrets:
  - `APP_LOGIN_PRIMARY_EMAIL`
  - `APP_LOGIN_PARTNER_EMAIL`
- Run `npm run ci`. This now includes format, dependency ADR guard,
  oversized-file guard, lint, typecheck, unit, Firebase adapter integration,
  emulator-backed Firestore/Storage rules, Functions build/tests, build, bundle
  analysis and budget, Playwright E2E, and visual regression.

## Firebase Auth Setup

1. Create or choose the Firebase project.
2. Enable Firebase Authentication.
3. Enable Email/Password.
4. Add authorized domains:
   - `localhost`
   - `127.0.0.1`
   - `<project>.firebaseapp.com`
   - `<project>.web.app`
   - the final custom domain
   - any preview domain intentionally used with live Firebase
5. Do not enable or link a public sign-up surface in Secret Faeries.

Mock/local builds use the client allowlist as a UX gate only. Firebase
production access is controlled by Auth custom claims, and Firestore, Storage,
and callable Functions require the same claims:

```json
{
  "gardenAccess": true,
  "secretFaeriesMember": true
}
```

## Account Seeding

Only Primary Gardener and Partner Gardener should be provisioned for production.

```bash
export FIREBASE_PROJECT_ID=your-project-id
export APP_LOGIN_PRIMARY_EMAIL=primary.gardener@example.com
export APP_LOGIN_PARTNER_EMAIL=partner.gardener@example.com
export APP_LOGIN_PRIMARY_TEMP_PASSWORD='replace-with-long-temp-password'
export APP_LOGIN_PARTNER_TEMP_PASSWORD='replace-with-long-temp-password'

npm --prefix functions ci
npm run auth:seed-users -- --dry-run
npm run auth:seed-users
```

The seed creates missing Auth users, sets display names, verifies email, enables
the accounts, and grants the required claims. Existing passwords are unchanged
unless `-- --reset-passwords` is passed. After claims change, users must sign out
and sign back in.

Use the access sync whenever the allowed production account emails change, and
as part of the live deploy workflow:

```bash
export FIREBASE_PROJECT_ID=your-project-id
export APP_LOGIN_PRIMARY_EMAIL=primary.gardener@example.com
export APP_LOGIN_PARTNER_EMAIL=partner.gardener@example.com

npm run auth:sync-access -- --dry-run
npm run auth:sync-access
```

The sync grants the required claims to only those two Auth users and removes the
managed access claims from any stale Auth users.

## Demo Seed

For local demos, mock mode is still the fastest path:

```bash
npm run dev
```

Sign in with an allowlisted email and click **Enter demo** from the shell, or
use the matching demo card in Settings. **Reset seeded demo** restores the
canonical Detroit baseline and returns to the active workspace; **Exit demo**
restores the garden draft saved before demo mode. The demo includes beds, paths,
crop supports, quiet planting-context objects, optimizer-ready wanted crops,
Review proposals, Today tasks/alerts, Feed memories, a local SVG photo,
harvests, and notification history.

For a live Firebase demo account, use the script after the production user
exists:

```bash
export FIREBASE_PROJECT_ID=your-project-id
export SEED_USER_EMAIL=primary.gardener@example.com
npm run seed:dev -- --dry-run
npm run seed:dev
```

Do not seed phone-number delivery data. The live seed writes the legacy
`gardens/{uid}` aggregate and nested collections used by Functions; the app
will migrate that garden into the shared published workspace on first load.

## Domain Setup

1. In Firebase Hosting, add the custom domain.
2. Add the DNS TXT verification record.
3. Add Firebase-provided A/AAAA or CNAME records.
4. Wait for certificate provisioning.
5. Add the custom domain to Firebase Auth authorized domains.
6. Load `/`, `/app/plan`, `/app/today`, `/app/feed`, and `/app/settings` on the
   custom domain after deploy.

## FCM Setup

1. In Firebase Console, generate a Web Push certificate.
2. Store the public VAPID key as `VITE_FIREBASE_MESSAGING_VAPID_KEY`.
3. Confirm `public/firebase-messaging-sw.js` is deployed at the origin root.
4. Sign in as Primary Gardener and Partner Gardener on the production domain.
5. Enable push in Settings.
6. Confirm token docs are written under
   `users/{uid}/pushTokens/{tokenId}` with `platform: "web"`.
7. Send one controlled foreground/background push before a real demo.

## Carrier Messaging Setup

None. Carrier messaging is outside product scope. Do not configure carrier
delivery for demos or production deploys. There are no carrier-message
Functions exports, webhook routes, provider secrets, or phone seed values to
configure.

## Native Mobile Setup

The web/PWA release does not require native stores. If using the Capacitor shell:

1. Run `npm run mobile:sync` after the final web build.
2. iOS:
   - Register bundle id `com.secretfaeries.app` or the final replacement.
   - Enable Push Notifications.
   - Upload an APNs auth key to Firebase Cloud Messaging.
   - Add `GoogleService-Info.plist` to `ios/App/App/` and the Xcode target.
   - Confirm `ios/App/PrivacyInfo.xcprivacy` is in the target before App Store
     submission.
3. Android:
   - Create the Google Play app/package `com.secretfaeries.app` or final
     replacement.
   - Configure Play App Signing or a release keystore outside the repo.
   - Add `android/app/google-services.json`.
   - Add a final white transparent notification icon before public push tests.
4. Smoke native push, local notifications, camera capture, and network status on
   a real device or simulator/emulator.
5. PIN/biometric quick unlock is not implemented; do not store secrets in
   Capacitor Preferences.

## Deploy

Manual deploy commands:

```bash
export FIREBASE_PROJECT_ID=your-project-id
npm run ci
npm run deploy:rules
npm run deploy:functions
npm run deploy:hosting
```

One-shot deploy:

```bash
export FIREBASE_PROJECT_ID=your-project-id
npm run deploy:all
```

The `Hosting Live` GitHub workflow also runs the full release gate, syncs
production Auth access claims from secure `APP_LOGIN_*` secrets, deploys
Firestore rules/indexes, Storage rules, Functions, then deploys Hosting live
when `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT`, all required `VITE_*`
variables, and the production access secrets are configured.

## Production Checklist

- Firebase Auth: Email/Password enabled, no public sign-up surface, Primary Gardener and
  Partner Gardener provisioned, required custom claims set, and both users have refreshed
  tokens after claims assignment.
- FCM web push, if enabled: VAPID key configured, service worker deployed at
  the origin root, token docs written for each production user, and one
  foreground plus one background notification smoke tested.
- Capacitor native push/local notifications, if shipping native shells:
  platform Firebase config files installed locally, APNs/Play signing handled
  outside the repo, release keystore or App Store signing ready, and local
  notification smoke completed on the target device class.
- Live smoke: Plan, Today, Feed, Settings, demo enter/reset/exit,
  optimize/apply, Review decision summary, publish/revert, push registration,
  and offline text queue verified on the production domain.

## Post-Deploy Smoke

- Desktop web:
  - Primary Gardener signs in.
  - Enter demo from the shell, reset the seeded demo, then exit back to the
    saved real garden draft.
  - Open Plan, Today, Feed, Settings.
  - Generate optimizer proposals and open Review.
- Mobile web:
  - Partner Gardener signs in on the production domain.
  - Confirm remembered session, bottom navigation, Today quick actions, Feed
    composer, and Plan mode actions.
- Shared garden:
  - Publish a low-risk draft from one account.
  - Reload from the other account and confirm the published state is visible.
  - Use Review revert from History and accept the confirmation prompt only in a
    controlled demo account.
- Notifications:
  - Register web push for one account.
  - Confirm in-app alerts and notification center history.
- Offline:
  - Queue a text-only Feed entry offline.
  - Reconnect and confirm queued state clears.
  - Do not claim offline photo upload.
- Native shell, if included:
  - Run `npm run mobile:sync` and `npx cap doctor`.
  - Smoke camera/network/local notification hooks after native Firebase config
    files are installed locally.

## Rollback

- Hosting: redeploy the previous known-good build or Hosting release.
- Functions: redeploy the previous known-good Functions source.
- Rules: keep the previous deployed rules files available. If a tester is
  unexpectedly blocked, verify custom claims and token refresh before rolling
  back rules.
