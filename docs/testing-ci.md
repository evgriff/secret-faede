# Testing and CI

## Test Strategy

Keep the test surface small and high-signal:

- config parsing, allowlist, auth, and route behavior unit/component tests
- domain tests for crop catalog, garden validation, planning, sun/shade,
  watering, task generation, Feed summaries, and demo data
- repository tests for mock persistence and pending Firebase garden saves
- Cloud Functions syntax and notification/operations logic tests
- Firebase emulator-backed Firestore and Storage rules tests
- Playwright smoke paths for auth, canvas-first Plan, Today, Feed, Settings,
  demo loading, offline text queueing, and redesign regressions
- first-viewport visual baselines for Plan, Today, Feed, and Settings at desktop
  and mobile widths

Focus areas:

- allowlist parsing and normalization
- root redirects and protected route behavior
- password sign-in, password reset copy, and persisted-session behavior
- access-denied handling
- authenticated Plan editor rendering, stable overlays, proposal walkthroughs,
  and persistence
- feet-based garden coordinate math
- plot resize, plant clamping, individual plant nodes, structures, and
  sun/shade overrides
- weather/watering task generation and manual field actions
- Feed notes, issues, photos, harvests, and offline text-only saves
- Firestore/Storage owner-plus-membership-claim authorization

## Local Commands

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:rules`
- `npm run test:e2e`
- `npm run test:visual`
- `npm run test:visual:update`
- `npm run build`
- `npm run quality:deps`
- `npm run quality:files`
- `npm run quality:serena`
- `npm run quality:bundle`
- `npm run ci`

`npm run ci` runs format check, dependency ADR check, large-file architecture
check, Serena topic-catalog enforcement, lint, typecheck, unit tests, Firebase
adapter integration tests, emulator-backed Firestore/Storage rules tests,
Functions build/tests, build, bundle summary generation, bundle-budget
enforcement, Playwright smoke coverage, and visual regression.

Visual regression is part of the CI gate:

- baseline screenshots: `e2e/__screenshots__/`
- visual artifacts and diffs: `output/playwright/visual/`
- update baselines only for intentional layout changes

Bundle analysis output:

- `output/bundle-analysis/bundle-summary.md`
- `output/bundle-analysis/bundle-summary.json`

## GitHub Actions

`quality.yml`

- runs on pull requests and pushes to `main`
- checks out full git history so dependency comparison can see the PR base
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
- runs `npm run ci`
- deploys Firestore rules/indexes, Storage rules, and Functions
- deploys live Hosting only after backend deployment succeeds

## CI Configuration Needed

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
- `VITE_FIREBASE_MESSAGING_VAPID_KEY`

## Intentionally Deferred

- live Firebase integration tests in CI
- emulator seed data in CI
- browser matrix expansion beyond the current smoke coverage
