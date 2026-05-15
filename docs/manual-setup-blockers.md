# Manual Setup Blockers

Date: 2026-04-21

These items are not solved by app code alone. Do them before inviting real
Firebase testers or enabling production push notifications.

## Firebase Project And Web App

Required:

1. Create or choose a Firebase project.
2. Register a web app.
3. Set these live build repository variables:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
4. Optionally set `VITE_FIREBASE_MESSAGING_VAPID_KEY` after generating a
   Firebase Web Push certificate.
5. Set these production environment secrets:
   - `APP_LOGIN_PRIMARY_EMAIL`
   - `APP_LOGIN_PARTNER_EMAIL`
6. Enable Authentication Email/Password. Do not add a public sign-up path in
   the app.
7. Add authorized domains for local, preview, live Hosting, and any custom
   domain.
8. Deploy Firestore and Storage rules before using Firebase mode with real data.

## Production Login Users

Only Primary Gardener and Partner Gardener should be provisioned for production. Firestore, Storage, and
callable Functions require both `gardenAccess: true` and
`secretFaeriesMember: true`. The browser allowlist is mock/local only and does
not grant production access.

Preferred seed flow:

```bash
export FIREBASE_PROJECT_ID=your-project-id
export APP_LOGIN_PRIMARY_EMAIL=primary.gardener@example.com
export APP_LOGIN_PARTNER_EMAIL=partner.gardener@example.com
export APP_LOGIN_PRIMARY_TEMP_PASSWORD='replace-with-long-temp-password'
export APP_LOGIN_PARTNER_TEMP_PASSWORD='replace-with-long-temp-password'

npm --prefix functions ci
npm run auth:seed-users -- --dry-run
npm run auth:seed-users
npm run auth:sync-access -- --dry-run
npm run auth:sync-access
```

Use `npm run auth:seed-users -- --reset-passwords` only when intentionally
rotating existing passwords. After claims change, the user must sign out and
sign back in, or refresh their Firebase ID token.

Manual claim fallback if the seed script cannot be used:

```bash
cd functions
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json node - <<'NODE'
const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const email = 'tester@example.com';

admin
  .auth()
  .getUserByEmail(email)
  .then((user) =>
    admin.auth().setCustomUserClaims(user.uid, {
      ...(user.customClaims || {}),
      gardenAccess: true,
      secretFaeriesMember: true,
    }),
  )
  .then(() => {
    console.log(`Secret Faeries access granted to ${email}`);
  })
  .finally(() => process.exit());
NODE
```

Firebase Console setup that remains manual:

- Confirm Email/Password provider is enabled.
- Confirm no sign-up screen or invite link is exposed by this app.
- If Identity Platform is upgraded later, add Auth blocking triggers to reject
  accounts outside the two-user membership list before sign-in completes.

## GitHub Deploy Secrets

Required for Hosting preview/live workflows:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT`

Live workflow also requires the Firebase `VITE_*` repository variables listed
above. The live workflow now runs the full release gate, deploys Firestore
rules/indexes, Storage rules, Functions, and then Hosting.

## Web Push

Required for real FCM registration:

1. Generate a Firebase Web Push certificate.
2. Set `VITE_FIREBASE_MESSAGING_VAPID_KEY`.
3. Confirm `public/firebase-messaging-sw.js` is served from the deployed origin.
4. Smoke test token creation under `users/{uid}/pushTokens/{tokenId}`.
5. Send a controlled push and confirm foreground and background behavior.

## Native Mobile Shell

Required before TestFlight, Google Play testing, or real native push:

1. Apple Developer access:
   - Register bundle id `com.secretfaeries.app` or choose the final replacement.
   - Enable Push Notifications for the app id.
   - Create or reuse an APNs auth key and upload it in Firebase Cloud Messaging.
   - Add `GoogleService-Info.plist` to `ios/App/App/` and the Xcode app target.
   - Confirm `ios/App/PrivacyInfo.xcprivacy` is included in the target before
     App Store submission.
2. Google Play / Android access:
   - Create the Android app with package `com.secretfaeries.app` or choose the
     final replacement.
   - Configure app signing or a release keystore outside the repository.
   - Download `google-services.json` and place it at
     `android/app/google-services.json`.
   - Generate a white transparent notification icon before public push testing;
     otherwise Android may show the default app icon.
3. Firebase:
   - Register iOS and Android apps matching the final ids.
   - Confirm native push token writes under `users/{uid}/pushTokens/{tokenId}`.
   - Send one controlled push to each platform after native config files are in
     place.
4. Quick unlock:
   - Select an audited Keychain/Keystore storage implementation and document it
     in a new ADR.
   - Do not store Firebase passwords, refresh tokens, or long-lived secrets in
     Capacitor Preferences.

## Carrier Messaging

Carrier messaging is no longer in scope. Do not set carrier delivery secrets,
add phone-number seed values, configure carrier webhooks, or run carrier
delivery smoke tests. Any new carrier-message code should be treated as scope
regression.

## Optional Provider Keys

- `TOMORROW_API_KEY`: optional server-side weather enhancement in Functions.
- `VITE_TOMORROW_API_KEY`: optional browser weather enhancement; use only a
  restricted public key.
- `VITE_GOOGLE_MAPS_API_KEY`: optional browser geocoding key.
- `TREFLE_API_TOKEN`: optional local catalog ingestion key; not used at runtime.

## Current Manual Verification Still Needed

- Live password auth on the production domain with the seeded Primary Gardener and Partner Gardener
  accounts.
- Live Firestore and Storage access with a production user who has
  `gardenAccess: true` and `secretFaeriesMember: true`.
- Live FCM registration and delivery.
- Live NWS/Tomorrow weather refresh from a saved garden location.
- Offline save flush after reconnect in Firebase mode.
- Real mobile touch pass for Plan drag/resize and sun painting.
