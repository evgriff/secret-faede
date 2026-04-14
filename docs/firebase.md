# Firebase Setup

## Required Firebase products

- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- Firebase Local Emulator Suite

Cloud Functions are intentionally not part of Milestone 1.

## Project status

The repo is already wired with the current Firebase Web app values for the `secret-faeries` project in `.env.example`:

- `authDomain=your-project-id.firebaseapp.com`
- `projectId=secret-faeries`
- `storageBucket=your-project-id.firebasestorage.app`
- `messagingSenderId=your-sender-id`
- `appId=your-firebase-app-id`

To use the live Firebase adapters locally, copy `.env.example` to `.env.local` and set `VITE_APP_RUNTIME=firebase`.

The repo also includes `npm run setup:firebase:live`, which uses the current Firebase CLI login to:

- ensure email auth is enabled with `passwordRequired=false` so email-link sign-in works
- ensure `localhost`, `127.0.0.1`, `your-project-id.firebaseapp.com`, and `secret-faeries.web.app` are authorized domains
- seed one canonical dev user, garden, membership, and starter plot set in Firestore

The tracked Firebase project is also pinned in `.firebaserc`, and the live membership lookup path is backed by:

- the collection-group-aware member read rule in `firestore.rules`
- the `members.uid` field override in `firestore.indexes.json`

## Email-link auth setup

Enable email-link auth:

1. Open Firebase Console.
2. Go to Authentication.
3. Enable Email/Password.
4. Enable Email link (passwordless sign-in).

Required auth settings:

- use `handleCodeInApp=true`
- make sure the app URL for completion points at `/auth/complete`
- do not encode the email address into the redirect URL

## Authorized domains

Add these domains as appropriate:

- your Firebase Hosting domain
- any custom production domain
- localhost for local development

Important localhost note:

- Firebase email-link auth commonly fails in local work because `localhost` is missing from Authorized domains
- if local email-link auth fails unexpectedly, check Authorized domains first

## Environment variables

The app reads these values:

```bash
VITE_APP_RUNTIME=mock|firebase
VITE_ENABLE_PWA=true
VITE_USE_FIREBASE_EMULATORS=false|true
VITE_FIREBASE_API_KEY=your-firebase-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=secret-faeries
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-firebase-app-id
VITE_FIREBASE_EMULATOR_HOST=127.0.0.1
VITE_FIREBASE_AUTH_EMULATOR_PORT=9099
VITE_FIREBASE_FIRESTORE_EMULATOR_PORT=8080
```

The Firebase Web config also includes a `measurementId`, but this app does not read it because Firebase Analytics is intentionally excluded from Milestone 1.

## Emulator usage

Start the suite:

```bash
npm run emulators
```

Point the app at emulators:

```bash
VITE_APP_RUNTIME=firebase
VITE_USE_FIREBASE_EMULATORS=true
```

Notes:

- the app itself does not require real Firebase credentials in mock mode
- emulator-backed mode is available for live Firebase adapter work
- garden selection UI still defaults to mock data unless Firestore documents exist

## Hosting notes

`firebase.json` is already wired for SPA hosting:

- `dist/` as the public directory
- rewrite all routes to `index.html`
- Auth, Firestore, Hosting, and Emulator UI ports configured

## GitHub Actions secrets

Preview and live deploy workflows expect:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT`

`FIREBASE_SERVICE_ACCOUNT` should be the JSON service-account credential stored as a GitHub secret.

## Preview and live deployment cautions

- Hosting preview URLs can point at the same Firebase project as production if you configure them that way
- preview deployments can therefore hit real backend resources
- if you want safe preview data, use a separate Firebase project or point previews at emulator-backed or non-production config

## Owner follow-up

The repo scaffolding is complete. Live Firebase usage now only needs:

1. `npm run setup:firebase:live` run once from a machine authenticated with `firebase login`
2. `.env.local` updated to `VITE_APP_RUNTIME=firebase` for local live-adapter work
3. one successful manual Hosting deploy or GitHub deploy-secret setup, depending on whether automated previews matter now
4. any custom production domain added to Authorized domains if you introduce one later
