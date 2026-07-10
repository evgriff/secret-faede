# codex.md

## Product contract

Secret Faeries is a functionality-first planner and garden-operations app for
one real shared food garden. Exactly two provisioned password accounts can use
one published workspace; drafts and notification delivery receipts remain
private to each account.

The plot is the source of operational truth. Plan changes feed Today tasks and
crop-group watering, completed work feeds the durable ledger, Feed preserves
field memory, and Settings controls alert consent. Features that do not make
that loop more useful do not belong in the app.

## Active v2 foundation

- `src/main.tsx` mounts `src/v2/app/V2App.tsx`
- route guards use the `AuthService` boundary; there is no registration route
- `GardenRepository` is the only client boundary for shared workspace data
- `UserProfileRepository` is the only client boundary for private settings
- canonical Firestore workspace is `gardenWorkspaces/main`
- workspace schema is 2; plan schema is 9; user-profile schema is 2
- published plans and revisions are shared; drafts live at
  `gardenWorkspaces/main/drafts/{uid}`
- publish, revert, and shared settings publication cross authenticated callable
  Functions; clients cannot write metadata, published plans, or revisions
- plot, structures, crop groups, and planting instances store feet-based
  coordinates from the plot's left/top edges
- every active crop group receives its own deterministic watering balance and
  recommendation
- watering results retain explicit stage/stage-source, crop-profile, weather,
  and calculation provenance; applied/partial/skipped history is actor-attributed
  and revisioned
- in-app, web push, and native push adapters use the same durable alert/receipt
  pipeline and exact route deep links; web/native registration stays
  unavailable until the corresponding platform configuration is complete
- the previous client is removed; only explicit one-way migration readers for
  legacy persisted data remain in the v2 data layer

## Deterministic watering safety

The client and Functions implementations share the
`crop-water-balance-v2` behavior contract. Recommendation output must be a pure
function of saved plan/profile inputs, prior balance, weather observations and
forecast periods, water applications, timezone, and calculation instant.

Required invariants:

- calculate separately for each `PlantingGroup.id`
- persist one durable balance per crop group and never pool unrelated crops
- retain a versioned water-profile snapshot on the planting group
- never substitute Detroit or any other location when coordinates/timezone are
  missing or invalid
- treat a skipped water log as zero credit
- credit a partial log only by its explicit recorded amount and replace prior
  ledger credit when the same application advances revision
- do not infer gallons when growing area is unreliable
- downgrade uncertain evidence to `checkSoil`/low confidence rather than
  inventing an amount
- keep reason codes, source IDs, profile fingerprint, calculation revision, and
  model version with the result
- send watering push only for actionable, due, positive recommendations that
  pass the recipient's alert threshold and consent settings
- use stable alert/delivery IDs so retrying cannot duplicate a notification

## Repository map

`src/v2/app`

- composition, auth/runtime/workspace providers, guarded routes, and adapters
  for weather, media, notifications, and operations refresh

`src/v2/domain`

- plan, profile, operations, workspace, garden-time, and deterministic watering
  contracts; no UI or Firebase concerns

`src/v2/data`

- mock/Firebase repository implementations, validation, subscriptions, default
  state, and one-way legacy migration readers

`src/v2/routes`

- `auth` and `system`: sign-in, access-denied, and recovery surfaces
- `plan`: setup, plot editing, inspectors, review, layout, draft/publish/history
- `today`: independent watering cards, task actions, and water logging
- `feed`: journal/issue/photo/harvest composition and activity history
- `settings`: location/timezone, alert consent/thresholds, delivery state

`src/v2/ui`

- accessible shell, modal/focus behavior, async/error states, status messages,
  and the visual token layer

`src/infrastructure`

- reusable runtime adapters selected by the v2 service composition; adapters do
  not own v2 garden persistence

`functions`

- canonical scheduled/on-demand operations, weather provider access, crop-group
  water balances, task generation, durable alerts, quiet-hour deferral, push
  fan-out, retry, and delivery receipts

`scripts/migrate-workspace-v2*`

- backup-first, dry-run-by-default production migration to workspace schema 2,
  plan schema 9, and profile schema 2

`e2e` and `test/rules`

- semantic browser journeys and Firebase authorization/shape contracts

## Product boundaries

Do not add multiple gardens, public onboarding, dashboards, charts, maps,
collaboration, lore, AI, carrier messaging, or email delivery. Weather, tasks,
journal, notifications, and mobile support are in scope only where they directly
support the saved plot and real field work.

Do not add dependencies until the platform is insufficient, the need is in
current scope, total code is reduced, architecture remains smaller, and an ADR
documents the decision.

## Engineering rules

- use named exports, plain TypeScript, small files, and readable route guards
- keep `AuthService`, `GardenRepository`, and `UserProfileRepository` explicit
- use `xFt` from the left and `yFt` from the top; never persist pixels
- use IANA timezone calculations for all garden-day and quiet-hour decisions
- make runtime fallback visible; never hide persistence corruption or migration
  requirements behind mock data
- validate data at repository and Firebase-rule boundaries
- preserve user-owned dirty files and follow `docs/source-control-protocol.md`
- use Serena symbol navigation/refactors when its repo plugin is available and
  update the matching stable-topic memories when contracts change

## Required verification

Before release, run at minimum:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run quality:serena`
4. `npm run test:unit`
5. `npm run test:e2e`
6. `npm run build`
7. `npm run ci`

`npm run ci` is the authoritative aggregate gate and also covers formatting,
dependency/file-quality checks, high-severity production dependency audits for
the client and Functions, integration tests, Firebase rules, Functions, bundle
analysis, and visual regression. Production deployment additionally requires
the migration and manual checks documented in `docs/deployment.md`.
