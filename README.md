# Secret Faede

Secret Faede is a personal-use garden plot tracker PWA scaffold. Milestone 1 is intentionally narrow: it delivers the foundation for future planting, layout, care, and collaboration work without shipping those features early.

## Milestone 1 scope

Included:

- installable React + TypeScript + Vite PWA shell
- guarded routing for `/`, `/sign-in`, `/auth/complete`, `/gardens`, `/gardens/:gardenId`, and `*`
- email-link auth behind an `AuthService` boundary
- deterministic mock auth and mock garden data for local work and CI
- Firebase client skeleton for Auth, Firestore, Hosting, and emulators
- Firestore schema draft, security rules scaffold, and hosting config
- ESLint, Prettier, Vitest, React Testing Library, Playwright, Husky, lint-staged, and GitHub Actions

Intentionally excluded:

- plot editing UI
- planting CRUD
- reminders or notifications
- weather integration
- analytics, telemetry, or AI features
- any custom backend code

## Stack

- Node.js 22 + npm
- React 19 + TypeScript 5 + Vite 7
- React Router 7
- CSS Modules + CSS custom properties
- Firebase modular SDK
- `vite-plugin-pwa`
- ESLint flat config + Prettier
- Vitest + React Testing Library + Playwright

## Local setup

1. Use Node 22.
2. Install dependencies with `npm ci`.
3. Copy `.env.example` to `.env.local` if you want to change runtime settings.
4. Start the app with `npm run dev`.

The default `.env.example` keeps the app in `mock` mode. That is the intended local and CI baseline.

## Runtime modes

`mock` mode:

- default for local work and CI
- no Firebase credentials required
- mock sign-in link is rendered directly in the UI
- deterministic mock gardens back the selection screen

`firebase` mode:

- set `VITE_APP_RUNTIME=firebase`
- provide all required `VITE_FIREBASE_*` values
- optionally set `VITE_USE_FIREBASE_EMULATORS=true`
- if Firebase mode is requested without complete config, the app falls back to mock mode with a visible notice

## Emulator usage

Start the Firebase Local Emulator Suite:

```bash
npm run emulators
```

To point the app at emulators, set these in `.env.local`:

```bash
VITE_APP_RUNTIME=firebase
VITE_USE_FIREBASE_EMULATORS=true
VITE_FIREBASE_API_KEY=demo-api-key
VITE_FIREBASE_AUTH_DOMAIN=demo-secret-faede.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-secret-faede
VITE_FIREBASE_STORAGE_BUCKET=demo-secret-faede.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=000000000000
VITE_FIREBASE_APP_ID=1:000000000000:web:demo
```

The current milestone keeps garden reads mocked by default. The Firebase repository implementation is present and ready for seeded emulator data or live documents, but local development does not depend on that seed data existing.

## Scripts

- `npm run dev`: start the Vite dev server
- `npm run build`: typecheck with project references and build the production bundle
- `npm run preview`: preview the production build locally
- `npm run typecheck`: run TypeScript without emitting
- `npm run lint`: run ESLint
- `npm run lint:fix`: run ESLint with fixes
- `npm run format`: format the repo with Prettier
- `npm run format:check`: verify formatting
- `npm run test`: run Vitest in watch mode
- `npm run test:unit`: run unit and component tests once
- `npm run test:coverage`: run unit tests with coverage
- `npm run test:e2e`: run the Playwright smoke flow
- `npm run ci`: local equivalent of the quality workflow
- `npm run emulators`: start Firebase Auth, Firestore, Hosting, and Emulator UI

## Deployment overview

Quality checks run on pushes to `main` and on pull requests.

Preview deploys:

- run on pull requests
- deploy the built SPA to a Firebase Hosting preview channel
- require repository secrets for the Firebase service account and project ID
- can hit real Firebase backend resources if the preview project points at live services

Production deploys:

- run on pushes to `main`
- deploy to the Firebase Hosting live channel
- use the same secret set as preview deploys

See [docs/firebase.md](docs/firebase.md), [docs/testing-ci.md](docs/testing-ci.md), and [docs/architecture.md](docs/architecture.md) for the operational details.
