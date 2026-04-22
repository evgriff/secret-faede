# Secret Faede

Secret Faede is a small garden plot planner PWA. It uses Firebase
email/password auth for two provisioned accounts, then routes the signed-in user
into one saved real-world garden editor.

## MVP

Included:

- React + TypeScript + Vite PWA shell
- routes for `/`, `/sign-in`, `/access-denied`, `/app`, `/app/plan`,
  `/app/today`, `/app/feed`, `/app/settings`, legacy redirects from
  `/auth/complete`, `/app/garden`, `/app/tasks`, `/app/log`,
  `/app/journal`, and `*`
- Firebase email/password auth behind `AuthService`, with no public sign-up UI
- mock runtime and Firebase runtime from one env parser
- application-level allowlist for exactly two configured email addresses
- one shared published garden with one private draft per authenticated user
- plot width/depth in feet with a 1 square foot visual grid
- plant center positions stored as `xFt` and `yFt`
- authenticated app shell for Plan, Today, Feed, and Settings
- editable settings for alert location, timezone, check time, thresholds, and
  notification channels
- weather provider layer with NWS default, optional Tomorrow.io, and watering
  recommendations
- in-app notification logs, FCM web/native push registration, and local native
  alerts
- generated task timeline for planting, trellising, thinning, pruning,
  fertilizing, mulching, watering, harvest windows, and succession prompts
- journal, issue tracking, photo attachments, harvest logging, and in-season
  analytics
- sample garden mode with a stable Detroit garden loaded from Settings
- Firebase Cloud Functions source for daily watering checks and weather-driven
  frost, heat, and severe-weather alerts
- Firebase Storage for authenticated journal photos
- Firebase Hosting and Local Emulator Suite scaffolding
- ESLint, Prettier, Vitest, React Testing Library, Playwright, Husky, lint-staged, and GitHub Actions

Not implemented in this foundation pass:

- multiple gardens
- runtime external plant APIs
- maps, collaboration, carrier messaging, onboarding, dashboards, and AI features
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
- sign-in accepts an allowlisted email with the mock password `password`
- garden persistence uses localStorage by user id
- user profile persistence uses localStorage by user id
- journal photos are stored as local data URLs in the saved mock garden record

`firebase`

- set `VITE_APP_RUNTIME=firebase`
- provide all `VITE_FIREBASE_*` values
- keep `VITE_ALLOWED_EMAILS` set to exactly two distinct email addresses
- shared draft/publish persistence uses Firestore path `gardenWorkspaces/main`
- legacy `gardens/{uid}` data remains a migration source
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
- `npm run setup:firebase:live`: enable Email/Password auth and authorized domains for a live Firebase project
- `npm run auth:seed-users`: create or update the Primary Gardener and Partner Gardener Firebase Auth users from `APP_LOGIN_*` env
- `npm run mobile:sync`: build the PWA bundle and sync it into the Capacitor iOS/Android shells
- `npm run mobile:ios` / `npm run mobile:android`: open the native shell projects
- `npm run functions:build`: syntax-check Cloud Functions source
- `npm run functions:test`: run Cloud Functions notification logic tests
- `npm run catalog:build`: rebuild the checked-in offline home-garden plant catalog
- `npm run catalog:ingest:trefle`: refresh local catalog provenance/enrichment with Trefle when `TREFLE_API_TOKEN` is available
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:rules`
- `npm run test:e2e`
- `npm run test:visual` / `npm run test:visual:update`
- `npm run quality:deps`
- `npm run quality:files`
- `npm run quality:bundle`
- `npm run build`
- `npm run ci`
- `npm run seed:dev`: seed an existing Firebase Auth user with Detroit demo data

## Firebase and deployment

The allowlist is an application-level gate. It prevents unauthorized users from
entering the garden editor after sign-in, and the app exposes no public sign-up
path. For stronger pre-auth enforcement, upgrade the project to Identity
Platform and add Auth blocking triggers.

Firestore and Storage rules require the signed-in user to own the document path
and carry the Firebase Auth custom claims `gardenAccess: true` and
`secretFaedeMember: true`. The browser allowlist is still a user-facing gate,
not the data-protection boundary.

See:

- [docs/architecture.md](docs/architecture.md)
- [docs/data-model.md](docs/data-model.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/ux-architecture.md](docs/ux-architecture.md)
- [docs/release-roadmap.md](docs/release-roadmap.md)
- [docs/release-ledger.md](docs/release-ledger.md)
- [docs/release-checklist.md](docs/release-checklist.md)
- [docs/release-hypothesis.md](docs/release-hypothesis.md)
- [docs/testing-plan.md](docs/testing-plan.md)
- [docs/demo-script.md](docs/demo-script.md)
- [docs/firebase.md](docs/firebase.md)
- [docs/testing-ci.md](docs/testing-ci.md)
- [docs/deployment.md](docs/deployment.md)
- [docs/local-setup.md](docs/local-setup.md)
- [docs/repo-audit.md](docs/repo-audit.md)
- [docs/notes.md](docs/notes.md)
- [docs/manual-setup-blockers.md](docs/manual-setup-blockers.md)
