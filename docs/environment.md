# Environment

Date: 2026-04-21

## Browser Environment

- `VITE_APP_RUNTIME`: `mock` or `firebase`.
- `VITE_ALLOWED_EMAILS`: exactly two mock/local allowlisted emails. Do not use
  this for production membership.
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_VAPID_KEY`: optional unless web push registration is
  enabled.
- `VITE_USE_FIREBASE_EMULATORS=true`: routes Firebase clients to emulators.
- `VITE_FIREBASE_AUTH_EMULATOR_PORT`: default `9099`.
- `VITE_FIREBASE_FIRESTORE_EMULATOR_PORT`: default `8080`.
- `VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT`: default `5001`.
- `VITE_FIREBASE_STORAGE_EMULATOR_PORT`: default `9199`.
- `VITE_ENABLE_PWA=false`: disables PWA registration for local debugging.
- `VITE_GOOGLE_MAPS_API_KEY`: optional browser geocoding key.
- `VITE_ENABLE_TOMORROW_WEATHER=true` and `VITE_TOMORROW_API_KEY`: optional
  browser weather enhancement. Prefer server-side Tomorrow.io for production.

## Hosting Workflow Environment

GitHub `Hosting Live` needs these repository secrets or variables in addition
to the browser values above:

- `FIREBASE_PROJECT_ID`: target live project.
- `FIREBASE_SERVICE_ACCOUNT`: deploy service-account JSON for Firebase CLI.
- `APP_LOGIN_PRIMARY_EMAIL`: Primary Gardener's Firebase Auth email.
- `APP_LOGIN_PARTNER_EMAIL`: Partner Gardener's Firebase Auth email.

Do not put Functions-only secrets into `VITE_*` workflow variables.

## Functions Environment

- `TOMORROW_API_KEY`: optional server-side Tomorrow.io key.
- `ENABLE_TOMORROW_WEATHER=true` or `TOMORROW_WEATHER_ENABLED=true`: enables
  Tomorrow.io in backend weather generation.
- `NWS_USER_AGENT`: optional identifying User-Agent for NWS requests.

## Auth Seed Environment

These values are used by `npm run auth:seed-users` and
`npm run auth:sync-access` and must stay out of browser build env:

- `APP_LOGIN_PRIMARY_EMAIL`: Primary Gardener's Firebase Auth email.
- `APP_LOGIN_PARTNER_EMAIL`: Partner Gardener's Firebase Auth email.
- `APP_LOGIN_PRIMARY_TEMP_PASSWORD`: initial or reset password for Primary Gardener.
- `APP_LOGIN_PARTNER_TEMP_PASSWORD`: initial or reset password for Partner Gardener.
- `FIREBASE_PROJECT_ID`: target Firebase project for live seeding.

The seed script creates missing users, sets display names, verifies email,
enables the accounts, and grants `gardenAccess: true` plus
`secretFaeriesMember: true`. Existing passwords are not changed unless
`-- --reset-passwords` is passed.

The sync script requires only `APP_LOGIN_PRIMARY_EMAIL`,
`APP_LOGIN_PARTNER_EMAIL`, and Firebase admin credentials. It grants those two
Auth users `gardenAccess: true` plus `secretFaeriesMember: true` and removes
those managed claims from any other Auth user.

## Carrier Messaging Scope

Carrier messaging is no longer part of the product scope. Do not add
provider-specific carrier secrets, phone-number seed values, or dry-run setup
for future prompt-chain work. Supported notification setup is limited to in-app
logs, web push, and optional native/local notifications.

## Secret Handling

- Browser `VITE_*` values are public by design. Production account emails must
  be stored in secure workflow/local environment values, not in `VITE_*`.
- Tomorrow.io server key and auth seed passwords belong only in Functions
  environment/secrets or local uncommitted env.
- Native Firebase files stay local or in the native build secret system:
  `ios/App/App/GoogleService-Info.plist` and
  `android/app/google-services.json` are not browser env and must not be
  committed unless the project explicitly chooses to commit non-secret config.
