# Secret Faeries

Secret Faeries is a private garden plot planner and field-operations app for one
real home food garden. Two provisioned Firebase email/password accounts share
one published workspace while each account keeps its own unpublished draft.

The active client is the v2 implementation under `src/v2`. It is deliberately
small: Plan describes the garden, Today turns that plan into practical work,
Feed records what happened, and Settings controls trustworthy alerts.

## Product scope

Implemented:

- guarded routes for `/sign-in`, `/access-denied`, `/app/plan`, `/app/today`,
  `/app/feed`, and `/app/settings`, plus intentional legacy redirects
- a feet-based plot editor for structures, crop groups, and individual planting
  instances; saved coordinates are always `xFt`/`yFt`, never pixels
- exact first-run operational setup for location/query, latitude/longitude,
  IANA timezone, hardiness zone, and typical frost dates; nothing is geocoded or
  inferred from a default city
- private drafts, optimistic conflict detection, server-callable publishing,
  revision history, revert, review decisions, and checked layout suggestions
- one deterministic watering recommendation for every active crop group
- generated task work, completion/defer/snooze actions, journal notes, issues,
  photo attachments, harvest records, and watering logs
- user-owned alert preferences, quiet hours, and private notification history;
  web/native push adapters remain visibly unavailable until their platform
  configuration is complete
- Firebase Auth, Firestore, Storage, Functions, Hosting, emulators, rules, CI,
  unit/integration/rules/E2E/visual tests, and a backup-first v2 migration

Intentionally out of scope:

- multiple gardens, public registration, collaboration, maps, dashboards,
  charts, lore, onboarding, AI, carrier messaging, and email delivery
- runtime crop-data APIs; watering inputs are saved, versioned snapshots so a
  catalog update cannot silently change an existing crop group

## Watering contract

Watering advice is calculated independently per active crop group with the
versioned `crop-water-balance-v2` deterministic model. The result records all
inputs and reasons needed to explain it:

- the crop group's saved weekly need, root depth, depletion fraction, and stage
  coefficient
- lifecycle/stage, crop area, structure type, soil depth/type, drainage, mulch,
  container adjustment, and application efficiency
- the durable prior root-zone balance, observed rain and evapotranspiration,
  forecast rain/evapotranspiration, and credited manual water applications
- confidence, data quality, trigger, projected depletion, recommended depth,
  optional gallons, suppression time, recheck time, and deep link

Each result explicitly identifies the crop stage, whether that stage was saved
or derived from lifecycle, its coefficient, the saved profile source/version,
profile fingerprint, and weather source IDs. The same inputs always produce the
same output. Missing or stale evidence is not
invented. A new or incompatible balance, unreliable area, unknown water amount,
low-confidence crop profile, or incomplete weather can downgrade the result to
an explicit soil check instead of presenting false precision. A garden without
coordinates can still generate non-weather tasks and safe soil checks, but it
does not send automatic weather-derived watering push alerts.

Applied and partial watering credit only the amount actually recorded for that
crop group; skipped watering receives zero credit. Corrections keep the same
record ID, crop group, and original recorder while advancing the record
revision, so recalculation replaces prior credit instead of duplicating it.

Only actionable, due crop-group recommendations with a positive amount can
become watering alerts. Delivery also honors each account's enabled alert kinds,
minimum deficit, push consent, timezone, and quiet hours. Web notifications use
data-only FCM handling; configured native builds use native push handling.
Alert IDs make retries idempotent, while crop-group IDs keep separate
recommendations from overwriting one another.

## Quick start

Use Node 22 and npm 11.

```sh
npm ci
npm run dev
```

The default runtime is mock mode. Sign in with either configured mock account
and password `password`. Mock plan/profile data is stored locally and normalized
to the current schemas on read.

For Firebase emulator work:

```sh
npm run emulators
npm run dev:firebase:emulators
```

Copy `.env.local.example` to `.env.local` only when local Firebase configuration
is needed. Do not put membership emails or credentials in `VITE_*` variables.

## Runtime modes

`mock`

- default for local development and browser tests
- no Firebase project required
- two-account allowlist and local persistence
- no production push delivery

`firebase`

- set `VITE_APP_RUNTIME=firebase` and all required `VITE_FIREBASE_*` values
- authorization is enforced by Auth custom claims, Firestore rules, and Storage
  rules
- canonical workspace: `gardenWorkspaces/main`
- profiles and private delivery receipts: `users/{uid}`
- photo objects:
  `gardenWorkspaces/main/journal/{entryId}/{uid}/{photoId}-{fileName}`
- publishing, revert, and shared location/climate publication use authenticated
  Functions callables; direct client writes to metadata, published plans, and
  revisions are denied

`firebase + emulators`

- set `VITE_USE_FIREBASE_EMULATORS=true`, normally through
  `npm run dev:firebase:emulators`
- uses local Auth, Firestore, Storage, and Functions endpoints

Incomplete Firebase web configuration falls back to mock mode with a visible
runtime notice; production migration errors do not silently fall back.

## Main commands

- `npm run lint`, `npm run typecheck`, `npm run format:check`
- `npm run test:unit`, `npm run test:integration`, `npm run test:rules`
- `npm run functions:build`, `npm run functions:test`
- `npm run test:e2e`, `npm run test:visual`
- `npm run quality:deps`, `npm run quality:files`,
  `npm run quality:serena`, `npm run quality:bundle`
- `npm run audit:prod`: reject high-severity client or Functions production
  dependency advisories
- `npm run build`: production web build
- `npm run ci`: complete release gate
- `npm run auth:seed-users`: provision the two password accounts
- `npm run auth:sync-access`: synchronize production access claims
- `npm run setup:firebase:live`: configure supported Firebase project settings
- `node scripts/migrate-workspace-v2.mjs --project <id>`: create a local backup
  and dry-run the schema migration
- `node scripts/migrate-workspace-v2.mjs --project <id> --apply`: apply the
  reviewed, idempotent migration
- `npm run deploy:all`: run CI, then deploy rules, indexes, Storage, Functions,
  and Hosting; migration is a separate pre-deploy release step

## Release rule

A green build is necessary but not sufficient for deployment. A release also
requires the reviewed production migration to be applied and rechecked,
current access claims, matching protected/public Firebase project IDs, the
production NWS identity and web VAPID key, device-tested platform configuration
for every native target advertised, and production smoke checks for both
provisioned accounts. See [docs/deployment.md](docs/deployment.md) and
[docs/deploy-runbook.md](docs/deploy-runbook.md).

Architecture and operations references:

- [docs/architecture.md](docs/architecture.md)
- [docs/data-model.md](docs/data-model.md)
- [docs/firebase.md](docs/firebase.md)
- [docs/testing-ci.md](docs/testing-ci.md)
- [docs/manual-qa-checklist.md](docs/manual-qa-checklist.md)
- [docs/release-candidate-checklist.md](docs/release-candidate-checklist.md)
