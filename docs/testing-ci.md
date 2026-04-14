# Testing and CI

## Test strategy

This milestone uses three layers:

- unit and component tests with Vitest and React Testing Library
- one repository/service test for the mock auth seam
- one Playwright smoke flow covering sign-in, garden selection, and the garden shell

The goal is useful regression coverage for the scaffold, not artificial coverage targets.

## Script reference

| Script                  | Purpose                                 |
| ----------------------- | --------------------------------------- |
| `npm run lint`          | ESLint across source, tests, and config |
| `npm run typecheck`     | TypeScript verification without emit    |
| `npm run test:unit`     | unit and component tests                |
| `npm run test:coverage` | unit tests with coverage output         |
| `npm run test:e2e`      | Playwright smoke path                   |
| `npm run build`         | production bundle build                 |
| `npm run ci`            | local quality-gate equivalent           |

## CI workflows

`quality.yml`

- runs on pushes to `main` and on pull requests
- installs dependencies with `npm ci`
- runs formatting check, lint, typecheck, unit/component tests, and build

`hosting-preview.yml`

- runs on pull requests
- deploys the built app to a Firebase Hosting preview channel
- skips cleanly if Firebase secrets are not present

`hosting-live.yml`

- runs on pushes to `main`
- deploys the built app to the live Firebase Hosting channel
- skips cleanly if Firebase secrets are not present

## What blocks merges

The intended merge gate is the quality workflow:

- formatting must pass
- lint must pass
- typecheck must pass
- unit/component tests must pass
- build must pass

Preview deploys are useful operational feedback but should not be the only quality signal.

## Preview deployment requirements

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT`
- a Firebase project configured for Hosting

If preview deploys should avoid real backend resources, set them up against a non-production Firebase project.

## Intentionally deferred

- emulator seed automation
- Firestore rules unit tests
- browser matrix beyond one Playwright smoke project
- coverage thresholds
- live Firebase integration tests in CI
