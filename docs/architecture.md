# Architecture

## Summary

Secret Faeries has one React application, one shared garden workspace, two
provisioned users, and three explicit client boundaries:

- `AuthService` owns identity and session state
- `GardenRepository` owns plans and shared garden operations
- `UserProfileRepository` owns private notification settings

The v2 client under `src/v2` is the only application. Firebase adapters for
auth, weather, media, device state, push, and telemetry are reused through the
v2 composition root. The previous client has been removed; one-way readers for
legacy persisted data exist only inside the v2 migration boundary.

```text
AuthService ───────────────► route guard / account state
GardenRepository ─────────► Plan ─► Today ─► Feed
UserProfileRepository ────► Settings ─► notification consent
Weather + Functions ──────► per-crop balances/recommendations/tasks
Media + notifications ────► field records and alert delivery
```

## Composition and runtime

`src/main.tsx` mounts `V2App`. `createV2Services` reads the centralized runtime
environment, selects reusable operational adapters, then installs either the
mock or Firebase v2 repositories.

The app provider order is:

1. runtime/services
2. auth session
3. guarded router
4. workspace/profile subscriptions
5. route surface

The route guard distinguishes four states: checking, signed out, authenticated
member, and authenticated non-member. It never renders private workspace data
before both authentication and membership checks succeed.

Incomplete Firebase web configuration visibly falls back to mock mode. A
missing or unsupported Firebase workspace does not fall back: the repository
returns a migration/version error so production data problems are explicit.

## Route architecture

The public/recovery surfaces are:

- `/sign-in`: password sign-in for provisioned accounts; no registration
- `/access-denied`: authenticated identity without required membership
- system recovery states for unavailable, migration-required, or newer data

The authenticated shell owns primary navigation, runtime/offline state, account
actions, foreground alert banners, and route focus restoration:

- `/app/plan`: setup, feet-based plot editing, private draft, review, publish,
  history, and revert
- `/app/today`: one watering card per crop group, exact task actions, and water
  application logging
- `/app/feed`: notes, issues, photos, harvest records, watering activity, and
  field history
- `/app/settings`: garden location/timezone, personal alert preferences,
  consent/device state, and private delivery history

Legacy URLs only redirect into these routes; they do not mount legacy pages.
Deep links use stable IDs, for example crop-group focus in Plan and exact task or
watering focus in Today.

## Domain boundaries

`src/v2/domain` has no React or Firebase imports. Its stable schemas are:

- workspace schema 2
- garden plan schema 9
- user profile schema 2
- watering model `crop-water-balance-v2`, calculation revision 1

The plot coordinate system is canonical domain state: `xFt` is measured from
the left edge, `yFt` from the top edge, and dimensions are feet. Pixel geometry
exists only in rendering/input adapters.

Each planting group stores its own immutable-at-save water-profile snapshot.
That prevents a catalog revision from silently changing historical watering
behavior. Manual edits create an explicit new snapshot source/version.

## Persistence

`GardenRepository` exposes a single `GardenWorkspaceView` containing the user's
private draft, the shared published plan, recent revisions, and shared
operations. UI code never reads Firestore directly.

Firebase uses:

- metadata at `gardenWorkspaces/main`
- published plan at `gardenWorkspaces/main/plans/published`
- private draft at `gardenWorkspaces/main/drafts/{uid}`
- immutable publish history under `revisions`
- shared journal, harvest, task, and water-application collections
- server-owned weather, water-balance, recommendation, alert, and automation
  documents
- user-owned profile/push token documents and server-owned private delivery
  receipts under `users/{uid}`

Draft save validates the plan and expected published revision. Publication,
revert, and shared location/climate updates cross authenticated Functions
callables. The server revalidates the complete schema-9 plan and performs the
transaction that creates a revision, replaces the published record, advances
metadata, and clears or rebases only the actor's draft. Firestore rules deny
direct client writes to metadata, the published record, and revisions. A
mismatched expectation returns a conflict instead of overwriting another
user's publish.

The active mock and Firebase adapters return `committed` only after their
authoritative local-storage write, Firestore write, or callable transaction has
succeeded; errors propagate. The shared result type retains a `queued` variant
as an extension seam, but no active adapter currently promises a durable
offline queue. Subscriptions refresh the combined workspace after accepted
writes.

Mock repositories preserve the same interface, validation, conflicts, schema
normalization, and per-user draft/profile separation in local storage.

## Deterministic crop-group watering

Watering is not a calendar schedule. Functions calculate a durable root-zone
water balance independently for each active `PlantingGroup.id`.

For each crop group the model:

1. validates the timezone, calculation instant, ordered/non-overlapping weather
   periods, unique source IDs, profile version, and prior balance revision
2. resolves the saved crop water profile plus explicit stage, stage source,
   and stage coefficient
3. caps root depth by structure soil depth, then applies soil, drainage,
   container, mulch, and crop depletion factors
4. rolls the prior depletion forward with observed ET and rain
5. credits only the explicit amount on applied or partial water, multiplied by
   saved efficiency; skipped applications receive exactly zero credit
6. projects forecast ET/rain and compares depletion with the crop-specific
   trigger
7. emits an explainable due/scheduled/suppressed/check-soil recommendation and
   the next durable balance

Each result retains the stage/source, profile source/version/fingerprint,
weather source IDs, reason evidence, model version, and calculation revision.
New balances, incompatible revisions, unreliable growing area, missing water
amounts, stale/insufficient weather, and low-confidence crop profiles are
represented with reason codes and lower confidence. The model uses safe soil
checks where precision is not justified. It does not substitute a default
city, weather station, rain value, or application amount.

No coordinates means no authoritative weather lookup. The operation run still
creates non-weather tasks and one safe crop-group soil check, but automatic
weather-derived watering push is suppressed until a real location is saved.

The Functions implementation is the canonical production calculator. The
client uses persisted recommendations and only creates conservative check-soil
fallback cards when the canonical result is unavailable or stale.

## Operations and notifications

An hourly UTC schedule claims the canonical workspace operation run. A claim
prevents overlapping workers from publishing competing balances. The worker
loads the exact published revision, reads weather, computes balances and
recommendations, merges generated tasks while preserving concurrent user
actions, and commits server-owned output.

Only due, actionable, positive watering recommendations become watering
alerts. Task alerts link to their exact task. Weather alerts require real
coordinates and validated weather evidence.

For every alert, the delivery pipeline:

1. resolves the two current members from Auth claims
2. reads each user's profile and enabled alert kind
3. applies the watering threshold, push consent, timezone, and quiet hours
4. writes a stable per-user delivery record
5. asks FCM to accept web data-only or native notification-plus-data payloads
6. records provider acceptance/failure and retries pending attempts

Alert and delivery IDs provide idempotency. Web service-worker tags are based on
the alert ID: a retry coalesces, while separate crop groups remain separate.
Foreground web/native events become in-app banners, avoiding a duplicate system
notification from the page and the platform.

A push receipt with status `sent` means the push provider accepted the message.
It is not evidence that an operating system displayed the notification or that
the user saw it; those claims require real-device smoke testing.

## Media and security

Journal photo metadata is stored with the shared entry; bytes are stored at
`gardenWorkspaces/main/journal/{entryId}/{uid}/{photoId}-{fileName}`. The owner segment
prevents one member from overwriting another member's object. Both members may
read shared photos; only the uploader may create/delete their object.

Firebase rules require both `gardenAccess` and `secretFaeriesMember` claims.
Rules enforce document ownership, exact allowed keys, bounded values, immutable
server output, and denial of direct publication writes. Callable boundary tests
cover claim checks, full plan validation, expected-revision conflicts, and the
atomic server transaction. Client validation improves error messages but is
never treated as authorization.

## UI and accessibility

The visual system lives under `src/v2/ui` and route-scoped CSS modules. Shared
primitives own focus-visible states, form help/errors, status messaging, async
states, modal focus trapping/restoration, reduced-motion behavior, and the
responsive authenticated shell. Route modules own only product-specific layout.

Primary flows must remain usable at a 320 CSS-pixel viewport and with keyboard
input. Plot objects expose selection and keyboard movement in addition to
pointer dragging. Color is never the only status signal.

## Verification architecture

- Vitest covers pure domains, repositories, route models, and React behavior
- Firebase emulator tests cover Firestore and Storage authorization/shapes
- Functions tests cover deterministic calculations, claims/concurrency,
  notification eligibility, quiet hours, retries, and payloads
- Playwright covers complete mock user journeys, accessibility semantics,
  responsive behavior, and visual baselines
- browser QA exercises the built interaction model and console on desktop/mobile
- `npm run ci` is the aggregate release gate

See `docs/data-model.md`, `docs/firebase.md`, `docs/testing-ci.md`, and
`docs/deployment.md` for the operational contracts.
