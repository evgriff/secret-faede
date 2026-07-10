# Testing Plan

Date: 2026-07-10

Testing protects the operational loop, not just route rendering: a saved plan
must produce deterministic crop-group work, field actions must update the
correct durable records, and every persistence/delivery boundary must fail
closed.

## Release gates

Run every command below before a release:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run quality:serena`
4. `npm run test:unit`
5. `npm run test:e2e`
6. `npm run build`
7. `npm run ci`

`npm run ci` is the authoritative aggregate. It also runs formatting,
dependency/file-quality guards, high-severity production dependency audits for
the client and Functions, Firebase adapter integration tests, emulator rules
tests, Functions syntax/tests, bundle analysis/budget, and visual regression.

Use targeted commands during development:

- domain, repository, or React behavior: `npm run test:unit`
- Firebase adapters: `npm run test:integration`
- Firestore/Storage rules: `npm run test:rules`
- Functions/watering/delivery: `npm run functions:build && npm run functions:test`
- semantic browser journeys: `npm run test:e2e`
- intended visual changes: `npm run test:visual:update`, review the images,
  then `npm run test:visual`
- migration changes: `npx vitest run scripts/migrate-workspace-v2.test.mjs`
- production bundle changes: `npm run quality:bundle`

Do not update screenshots merely to make a failure disappear. Review the route
at the affected viewport, confirm the change is intentional, then update and
rerun the visual suite.

## Deterministic watering contract

The TypeScript domain and Functions implementations must test the same
`crop-water-balance-v2` invariants:

- one result per active crop-group ID, even when crops share a bed or irrigation
  zone
- input ordering cannot change the result; invalid order, overlap, duplicate
  source IDs, invalid timezones, and incompatible revisions are rejected
- saved crop-profile/stage/structure factors change only the owning crop group
- explicit stage, stage source, coefficient, profile source/version/fingerprint,
  and weather source IDs survive client/Functions parity
- root depth is capped by known structure soil depth
- observed rain and explicit applications are credited once through ledger
  IDs/revisions
- partial water credits only its explicit amount; skipped water is always zero
  credit and has no inferred amount
- unknown water amount, unreliable area, missing structure, low-confidence crop
  profile, and missing/stale weather lower confidence or produce `checkSoil`
- gallons are absent unless area is reliable
- missing coordinates never trigger a default weather location
- the same explicit inputs and calculation instant produce byte-stable
  recommendation semantics, reason codes, balance, and timestamps
- actionable push eligibility requires `due`, positive depth, adequate evidence,
  and the member's threshold/consent

Tests should assert useful reason codes and source IDs, not only headline
amounts. Any model-version or calculation-revision change requires fixtures for
the previous balance compatibility path and an explicit migration/rebaseline
decision.

## Current automated coverage

### Domain and time

`src/v2/domain/**` tests cover crop-group targeting, target factors, root-zone
balance accrual, forecast projection, missing/stale weather, application
ledger behavior, separate group recommendations, safety downgrades, IANA
garden-date conversion, quiet-hour boundaries, and DST ambiguity/gaps.

Plan/profile/workspace contracts are schema-versioned and repository
validation tests cover bounds, unique IDs, target links, feet-based geometry,
water-profile ranges, coordinate pairs, IANA timezones, alert preferences, and
unknown-field rejection where required.

### Persistence and migration

Mock repository tests cover per-user draft/profile isolation, subscriptions,
expected-revision conflicts, collision-free revisions, publish/revert/history,
operation writes, normalization, and localStorage recovery. Firebase gateway
tests cover callable request/result mapping for server-owned publication.

Firebase rule tests cover:

- both required membership claims
- shared published reads, client-owned private draft writes, and denied direct
  metadata/published/revision writes
- expected schema/key/shape validation
- callable auth/claim validation plus atomic server publish/revision linkage
- operation write ownership and immutable server-only balances,
  recommendations, alerts, automation, and delivery decisions
- user-owned profile/token scope and private delivery receipt reads
- uploader-scoped journal photo objects with member reads

The v2 migration tests cover dry-run option parsing, backup-first planning,
current-workspace no-op behavior, schema/profile conversion, conservative water
log credit, warning output, deterministic revision IDs, and idempotency.

### Functions and notifications

Functions tests cover canonical workspace validation, operation claims,
already-generated/run-in-progress/revision-conflict paths, preservation of
concurrent task/application actions, per-crop balance/recommendation writes,
safe no-coordinate output, generated watering/weather/lifecycle/succession
tasks, exact deep links, weather alert creation, and provider fallback
classification.

Delivery tests cover the two-claim recipient filter, profile validation,
alert-kind/threshold/consent decisions, quiet-hour deferral across timezones,
stable alert and delivery IDs, retry limits, invalid-token deletion, platform-
specific web/native payloads, and persisted receipt title/body/status. Tests
interpret push `sent` as provider acceptance; only physical-device QA can prove
display/tap behavior.

### Route and component behavior

React/Vitest tests cover:

- sign-in, reset/denied/recovery routes, auth guards, and route restoration
- shell navigation, skip link, route focus, foreground banners, loading/error/
  conflict states, and modal focus trap/restoration
- Plan setup, crop/structure editing, water-profile inputs, validation, review,
  checked layout, draft/publish/history/revert, drag and keyboard movement
- Today ordering/focus, separate watering cards, reasons/basis, applied/partial/
  skipped logging, and task complete/snooze/defer/reopen
- Feed activity composition/filtering, note/issue/photo/harvest creation,
  watering activity, issue lifecycle, upload validation, and empty states
- Settings shared location/climate validation, private alert preferences,
  registration truth, capability reporting, and delivery history

### Browser and visual journeys

The v2 Playwright suite is intentionally semantic:

- `auth-session.spec.ts`: guarded deep-link resume, last-route memory,
  session-only login, allowlist denial, and revoked access
- `plan-workflow.spec.ts`: setup, add/edit/drag, water-profile input, save,
  review, publish, history, and two-step restore
- `today-operations.spec.ts`: separate crop-group recommendations, safe missing-
  weather soil checks, exact watering/task focus, task actions, and structural
  zero-credit skips
- `feed-settings.spec.ts`: note/issue/harvest/watering history, filters, issue
  lifecycle, settings validation/persistence, and honest push state
- `accessibility-responsive.spec.ts`: 320 CSS-pixel route containment, route
  focus, one visible navigation, skip link, modal focus, and keyboard plot nudge

`main-routes.visual.ts` captures auth, first-run setup, Plan, Today, Feed,
Settings, add-crop, review, and checked-layout states at desktop and mobile
viewports. Baselines live in `e2e/__screenshots__/`; transient traces/diffs live
under `output/playwright/`.

## Manual release checks

Automation does not replace these environment-dependent checks:

- both provisioned production accounts can sign in and read the same published
  plan while retaining separate drafts and profiles
- an account missing either claim reaches access denied and cannot read
  Firestore/Storage directly
- v2 migration dry run creates a private backup, reviewed warnings are
  acceptable, apply is idempotent, and the client opens schema 2/9 without a
  fallback
- a real saved coordinate pair/timezone produces plausible provider evidence;
  a deliberately prepared incomplete/migrated null-coordinate fixture returns
  every active crop group to safe soil checks
- two crops with intentionally different profiles produce separate balances,
  recommendations, tasks, alerts, and exact deep links
- applied inches/gallons affect only the selected group; partial application is
  credited explicitly; skip gives zero credit
- web foreground/background push, quiet-hour deferral, duplicate retry, and
  exact-click focus work on the deployed origin
- native push works on one real iOS and Android device when those builds are in
  release scope
- photo upload/read/delete rules work for both members and one member cannot
  overwrite the other's object
- publish conflict messaging is honest across two simultaneous sessions
- keyboard-only and VoiceOver/NVDA smoke can complete the primary Plan/Today/
  Feed/Settings flows
- Plan drag/nudge and all four routes remain usable at 320 CSS pixels and on a
  real touch device outdoors
- offline/pending actions make no unsupported durable-queue promise, preserve
  form edits where designed, and never describe photo bytes as queued
- the deployed app has no unexpected console errors or failed requests during
  the main journey

## Residual risks to report, not hide

- live NWS/Tomorrow payload changes can outpace fixtures
- platform push credentials and notification permission behavior cannot be
  proven by mock tests
- the production web VAPID variable is currently missing
- Android Firebase configuration is absent, and iOS lacks a verified FCM-token
  bridge; neither native platform is release evidence yet
- Firestore offline transaction/conflict timing needs periodic multi-device QA
- native device-local notification scheduling is not an active v2 route flow
- photo binaries have no offline queue
- real-device touch target and outdoor contrast checks remain manual

## Release evidence

Every release handoff should record:

- exact files/surfaces and schema/model revisions changed
- all commands run and whether they passed
- migration dry-run/apply report and backup path, without secrets
- live integrations and devices exercised
- visual baseline changes reviewed
- unresolved failures, skipped gates, setup blockers, and residual risks

A build is not release-ready when a required check is skipped, a migration is
unreviewed, or watering/push evidence has only been tested with invented
location data.
