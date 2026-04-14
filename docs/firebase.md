# Firebase Setup

## Required Firebase products

- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- Firebase Local Emulator Suite

Cloud Functions are intentionally not part of Milestone 1.

## Create the Firebase project

1. Create a Firebase project.
2. Add a Web app to the project.
3. Copy the Firebase Web config values into `.env.local`.
4. Enable Authentication, Firestore, and Hosting in the console.

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
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_EMULATOR_HOST=127.0.0.1
VITE_FIREBASE_AUTH_EMULATOR_PORT=9099
VITE_FIREBASE_FIRESTORE_EMULATOR_PORT=8080
```

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

The repo scaffolding is complete without cloud credentials, but the owner still needs to:

1. create the Firebase project
2. enable Email Link auth
3. add Authorized domains
4. populate `.env.local` for live or emulator-backed Firebase mode
5. add GitHub secrets for preview and production deployments
