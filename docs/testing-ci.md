# Testing and CI

## Release philosophy

Testing follows the contracts that can damage real garden decisions:

- deterministic crop-group watering and time math are pure, fixture-driven tests
- repositories validate schema/conflict/subscription behavior
- Firebase emulators prove authorization and server-owned boundaries
- Functions tests prove canonical calculation, concurrency, alert eligibility,
  quiet hours, retries, idempotency, and platform payloads
- Playwright proves complete user journeys and responsive/accessibility behavior
- visual snapshots catch accidental layout drift, not product correctness

A test that only asserts an old implementation detail should be removed during a
rewrite. A behavior or safety invariant should be retained and expressed against
the v2 surface.

## Commands

Fast local checks:

```sh
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run build
```

Focused suites:

```sh
npm run test:integration
npm run test:rules
npm run functions:build
npm run functions:test
npm run test:e2e
npm run test:visual
```

Quality checks:

```sh
npm run quality:deps
npm run quality:files
npm run quality:serena
npm run quality:bundle
npm run audit:prod
```

Authoritative aggregate gate:

```sh
npm run ci
```

`ci` runs formatting, dependency/file/Serena checks, the high-severity
production dependency audit for the client and Functions, lint, TypeScript,
unit and Firebase integration tests, Firestore/Storage emulator rules,
Functions build and tests, production build/bundle analysis, E2E, and visual
regression.

Use Node 22, npm 11, Java 21 for Firebase emulators, and the Playwright Chromium
version installed from the lockfile. Do not interpret results from an unsupported
Node version as release evidence.

## Unit and component coverage

Vitest/Testing Library covers:

- garden-time conversion, DST gaps/ambiguities, local dates, and quiet hours
- crop-group target construction, balance accrual, weather projection,
  recommendation thresholds, confidence downgrades, and reason evidence
- independent crop groups, skipped/unknown applications, unreliable area,
  missing/stale weather, model/profile revisions, and deterministic replay
- plan/profile/workspace validation and legacy migration
- mock/Firebase repository conflict, transaction, normalization, and error paths
- Plan, Today, Feed, Settings, auth, shell, modal, and async-state behavior
- deep-link/focus helpers and client fallback recommendation safety
- backup-first migration option parsing, idempotency, profile conversion, and
  ambiguous-water exclusion

Watering fixtures use fixed ISO instants, IANA timezones, explicit prior
balances, and named observations. Tests must not depend on the machine clock,
locale, network, or mutable catalog data.

## Firebase integration and rules

`test:integration` verifies reusable Firebase auth/profile/media/notification
adapters against configured emulators. `test:rules` starts isolated Firestore and
Storage emulators through `firebase emulators:exec` and runs
`vitest.rules.config.ts`.

Rules tests must include positive and negative examples for:

- both required membership claims
- published/shared read access and private draft/profile/delivery isolation
- denied direct client writes to metadata/published/revisions
- authenticated callable publication/revert/settings boundaries and atomic
  publish/revision/metadata linkage
- exact profile, token, journal, harvest, task, and water-application shapes
- denied client writes to weather/balance/recommendation/alert/delivery data
- Storage uploader ownership, type, metadata, size, overwrite, delete, and
  fallback path denial

The demo rules project IDs are intentionally non-production. A test command must
never point emulators at the live project.

## Functions coverage

Functions tests use in-memory Firestore/messaging doubles and fixed time. The
suite proves:

- a canonical published plan produces one independent recommendation/balance
  per active crop group
- null coordinates enter safe check-soil mode without a default weather lookup
- non-weather tasks still generate in safe mode
- persisted applications and prior balances replay idempotently
- actor-attributed applied/partial/skipped revisions replace rather than
  duplicate ledger credit
- operation claims prevent overlap, stale claims recover, and commits preserve
  concurrent task actions
- only due/actionable/positive watering and due tasks create alerts
- profile kind/threshold/push/quiet-hour eligibility is per user
- quiet-hour deferral and transient failures retry without duplicate delivery
- permanent token failures retire registrations
- web and native payloads use the correct notification ownership model
- notification receipts retain title/body/link and attempt state; `sent` means
  provider acceptance, not device display

Functions source must also pass its package formatter and Node syntax build.

## E2E and visual coverage

Playwright runs the v2 app in deterministic mock mode. Semantic specs cover:

- sign-in, session restore/sign-out, denied access, and recovery states
- first setup and plot settings
- adding/editing/moving structures and crop groups, keyboard/pointer behavior,
  private draft, review, layout, publish, history, revert, and conflict feedback
- one watering card per crop group, exact deep links, applied/partial/skipped logs,
  task state transitions, and refresh state
- note/issue/photo/harvest composition and Feed activity
- profile validation, consent, thresholds, quiet hours, delivery/device state
- offline/runtime banners, modal focus, keyboard access, reduced motion, and
  320-pixel responsive use

Visual specs keep a small set of stable route/modal snapshots at explicit
desktop and mobile sizes. Snapshot updates require manual inspection and a
product reason; `--update-snapshots` is never a fix for an unexplained diff.

## Browser QA

Before release, run a hands-on browser pass against the same build/runtime being
released. Inspect visible state and console errors on desktop and 320-pixel
mobile widths. Exercise both form validation and successful flows. For Firebase,
test one session from each provisioned account and verify private drafts/delivery
history are not visible across accounts.

Real push still requires device/browser QA because emulators and mock messaging
cannot prove APNs/FCM credentials, OS permission prompts, background delivery,
notification taps, or installed-PWA behavior.

## GitHub Actions

`.github/workflows/quality.yml` runs `npm run ci` for pull requests and `main`.
It uses mock mode, Node 22, Java 21, and Chromium.

`.github/workflows/hosting-preview.yml` builds a mock preview for pull requests
when Firebase deploy credentials exist.

`.github/workflows/hosting-live.yml` runs the full release gate again with the
production Firebase browser configuration, authenticates a service account,
synchronizes access claims, deploys rules/indexes/Storage/Functions, then deploys
the Hosting live channel. It intentionally does not migrate Firestore.

Live workflow prerequisites:

- secrets: `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT`,
  `APP_LOGIN_PRIMARY_EMAIL`, `APP_LOGIN_PARTNER_EMAIL`
- variables: all required `VITE_FIREBASE_*` browser values, including the VAPID
  key required by the live workflow, plus `NWS_USER_AGENT`
- exact equality between protected `FIREBASE_PROJECT_ID` and public
  `VITE_FIREBASE_PROJECT_ID`
- a mode-`0600` generated `functions/.env.<project-id>` containing the NWS
  identity before Functions deployment
- protected production environment and least-privilege service account

A workflow skip caused by missing deploy configuration is not a successful
deployment. Inspect both the Quality and Hosting Live runs after every release.
