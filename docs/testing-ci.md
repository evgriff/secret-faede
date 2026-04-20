# Testing and CI

## Test strategy

Keep the test surface small and high-signal:

- config parsing unit tests
- auth and route behavior component tests
- Playwright smoke paths for auth and the garden editor

Focus areas:

- allowlist parsing and normalization
- root redirects
- sign-in form behavior
- different-device auth completion
- access-denied behavior
- authenticated garden editor rendering
- garden coordinate math
- plot resize and plant clamping
- mock garden persistence

## Local commands

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run build`
- `npm run ci`

`npm run ci` runs format check, lint, typecheck, unit tests, build, and Playwright smoke coverage.

## GitHub Actions

`quality.yml`

- runs on pull requests and pushes to `main`
- injects mock-safe env values
- installs Playwright Chromium
- runs `npm run ci`

`hosting-preview.yml`

- runs on pull requests
- builds with mock runtime by default
- disables PWA registration for safer preview behavior
- deploys to Firebase Hosting preview channels when deploy secrets are present

`hosting-live.yml`

- runs on pushes to `main`
- builds with Firebase runtime only
- requires explicit `VITE_*` repository variables
- validates required build env before deploying live Hosting

## CI configuration needed

GitHub secrets:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT`

GitHub repository variables for live builds:

- `VITE_ALLOWED_EMAILS`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`

## Intentionally deferred

- Firestore rules tests
- emulator seed data
- live Firebase integration tests in CI
- browser matrix expansion beyond the current smoke coverage
