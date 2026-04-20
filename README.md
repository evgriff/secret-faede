# Secret Faede

Secret Faede is a small garden plot planner PWA. It uses email-link auth, then routes the signed-in user into one saved real-world garden editor.

## MVP

Included:

- React + TypeScript + Vite PWA shell
- routes for `/`, `/sign-in`, `/auth/complete`, `/access-denied`, `/app`, and `*`
- Firebase email-link auth behind `AuthService`
- mock runtime and Firebase runtime from one env parser
- application-level allowlist for exactly two configured email addresses
- one persisted garden per authenticated user
- plot width/depth in feet with a 1 square foot visual grid
- plant center positions stored as `xFt` and `yFt`
- Firebase Hosting and Local Emulator Suite scaffolding
- ESLint, Prettier, Vitest, React Testing Library, Playwright, Husky, lint-staged, and GitHub Actions

Intentionally excluded:

- multiple gardens
- plant species libraries
- dashboards, reminders, weather, maps, collaboration, onboarding, and AI features
- Cloud Functions or server code

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

`firebase`

- set `VITE_APP_RUNTIME=firebase`
- provide all `VITE_FIREBASE_*` values
- keep `VITE_ALLOWED_EMAILS` set to exactly two distinct email addresses
- garden persistence uses Firestore path `gardens/{uid}`

`firebase + emulators`

- run `npm run emulators`
- run `npm run dev:firebase:emulators`

If Firebase mode is requested without complete web config, the app falls back to mock mode and shows a visible notice.

## Scripts

- `npm run dev`: default mock-first dev server
- `npm run dev:firebase:emulators`: dev server pointed at Firebase emulators
- `npm run emulators`: start Auth, Firestore, Hosting, and Emulator UI
- `npm run setup:firebase:live`: enable email-link auth and authorized domains for a live Firebase project
- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run build`
- `npm run ci`

## Firebase and deployment

The allowlist is an application-level gate. It prevents unauthorized users from entering the garden editor after sign-in, but it is not a hard pre-auth block on account creation.

Firestore rules allow authenticated users to read and write only their own garden document at `gardens/{uid}`.

See:

- [docs/architecture.md](docs/architecture.md)
- [docs/firebase.md](docs/firebase.md)
- [docs/testing-ci.md](docs/testing-ci.md)
- [docs/deployment.md](docs/deployment.md)
- [docs/repo-audit.md](docs/repo-audit.md)
