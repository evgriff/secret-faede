# Secret Faede

Secret Faede is a small garden plot planner PWA. It uses email-link auth, then routes the signed-in user into one saved real-world garden editor.

## MVP

Included:

- React + TypeScript + Vite PWA shell
- routes for `/`, `/sign-in`, `/auth/complete`, `/access-denied`, `/app`, `/app/garden`, `/app/tasks`, `/app/journal`, `/app/settings`, and `*`
- Firebase email-link auth behind `AuthService`
- mock runtime and Firebase runtime from one env parser
- application-level allowlist for exactly two configured email addresses
- one persisted garden per authenticated user
- plot width/depth in feet with a 1 square foot visual grid
- plant center positions stored as `xFt` and `yFt`
- authenticated app shell for the garden workspace, tasks, journal, and settings
- editable settings for alert location, timezone, check time, thresholds, and
  notification channels
- weather provider layer with NWS default, optional Tomorrow.io, and watering
  recommendations
- in-app notification logs, FCM web push registration, and backend carrier messaging alert
  dispatch with Twilio dry-run support
- generated task timeline for planting, trellising, thinning, pruning,
  fertilizing, mulching, watering, harvest windows, and succession prompts
- journal, issue tracking, photo attachments, harvest logging, and in-season
  analytics
- Firebase Cloud Functions source for daily watering checks and weather-driven
  frost, heat, and severe-weather alerts
- Firebase Storage for authenticated journal photos
- Firebase Hosting and Local Emulator Suite scaffolding
- ESLint, Prettier, Vitest, React Testing Library, Playwright, Husky, lint-staged, and GitHub Actions

Not implemented in this foundation pass:

- multiple gardens
- runtime external plant APIs
- maps, collaboration, onboarding, and AI features
- production email notification delivery

## Quick start

1. Use Node 22.
2. Run `npm ci`.
3. Start the default mock workflow with `npm run dev`.

Optional local config:

- copy `.env.local.example` to `.env.local` for Firebase or emulator work
- keep `.env.example` committed and generic

## Runtime modes

`mock`

- default local and CI baseline
- no Firebase config required
- sign-in uses the mock completion link rendered in the UI
- garden persistence uses localStorage by user id
- user profile persistence uses localStorage by user id
- journal photos are stored as local data URLs in the saved mock garden record

`firebase`

- set `VITE_APP_RUNTIME=firebase`
- provide all `VITE_FIREBASE_*` values
- keep `VITE_ALLOWED_EMAILS` set to exactly two distinct email addresses
- garden persistence uses Firestore path `gardens/{uid}`
- user profile persistence uses Firestore path `users/{uid}`
- journal photo binaries use Firebase Storage under `users/{uid}/journal/...`

`firebase + emulators`

- run `npm run emulators`
- run `npm run dev:firebase:emulators`

If Firebase mode is requested without complete web config, the app falls back to mock mode and shows a visible notice.

## Scripts

- `npm run dev`: default mock-first dev server
- `npm run dev:firebase:emulators`: dev server pointed at Firebase emulators
- `npm run emulators`: start Auth, Firestore, Storage, Functions, Hosting, and Emulator UI
- `npm run setup:firebase:live`: enable email-link auth and authorized domains for a live Firebase project
- `npm run functions:build`: syntax-check Cloud Functions source
- `npm run functions:test`: run Cloud Functions notification logic tests
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run build`
- `npm run ci`
- `npm run seed:dev`: seed an existing Firebase Auth user with Detroit demo data

## Firebase and deployment

The allowlist is an application-level gate. It prevents unauthorized users from entering the garden editor after sign-in, but it is not a hard pre-auth block on account creation.

Firestore rules allow authenticated users to read and write only their own garden document at `gardens/{uid}`, nested garden subcollections, user profile document, and nested push-token documents.

See:

- [docs/architecture.md](docs/architecture.md)
- [docs/firebase.md](docs/firebase.md)
- [docs/testing-ci.md](docs/testing-ci.md)
- [docs/deployment.md](docs/deployment.md)
- [docs/repo-audit.md](docs/repo-audit.md)
