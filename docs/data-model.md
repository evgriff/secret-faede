# Data model

## Versions

| Contract                      |         Current version |
| ----------------------------- | ----------------------: |
| Workspace metadata            |                       2 |
| Garden plan                   |                       9 |
| User profile                  |                       2 |
| Watering model                | `crop-water-balance-v2` |
| Watering calculation revision |                       1 |

Readers reject newer versions. Firebase readers require an explicit migration
for legacy versions; they never reinterpret incompatible live data as blank
state. Mock readers normalize local state into the current contract.

## Firestore layout

| Path                                                               | Owner               | Purpose                                                     |
| ------------------------------------------------------------------ | ------------------- | ----------------------------------------------------------- |
| `gardenWorkspaces/main`                                            | Functions           | Canonical workspace metadata and published revision pointer |
| `gardenWorkspaces/main/plans/published`                            | Functions           | Current shared published plan record                        |
| `gardenWorkspaces/main/drafts/{uid}`                               | matching user       | One private draft per account                               |
| `gardenWorkspaces/main/revisions/{revisionId}`                     | Functions           | Immutable shared publication history                        |
| `gardenWorkspaces/main/journal/{entryId}`                          | members             | Shared notes, photos, and issues                            |
| `gardenWorkspaces/main/harvests/{recordId}`                        | members             | Shared crop-group harvest ledger                            |
| `gardenWorkspaces/main/tasks/{taskId}`                             | members + Functions | Shared field-work state                                     |
| `gardenWorkspaces/main/waterApplications/{applicationId}`          | members             | Explicit crop-group water ledger                            |
| `gardenWorkspaces/main/weatherSnapshots/{snapshotId}`              | Functions           | Immutable weather input snapshot                            |
| `gardenWorkspaces/main/waterBalances/{cropGroupId}`                | Functions           | Durable root-zone balance per crop group                    |
| `gardenWorkspaces/main/wateringRecommendations/{recommendationId}` | Functions           | Explainable crop-group result                               |
| `gardenWorkspaces/main/alerts/{alertId}`                           | Functions           | Durable garden alert                                        |
| `users/{uid}`                                                      | matching user       | Private profile and notification preferences                |
| `users/{uid}/pushTokens/{tokenId}`                                 | matching user       | Active web/native push registrations                        |
| `users/{uid}/notificationDeliveries/{deliveryId}`                  | Functions           | Private delivery receipt/history                            |

The canonical workspace ID is always `main`. There is no client model for
multiple gardens.

## Workspace metadata and publication

`WorkspaceMetadata` contains:

- `id: "main"`
- `schemaVersion: 2`
- `publishedRevisionId`
- `updatedAtIso`
- optional server-owned automation lease/state fields

`PublishedPlanRecord` contains the plan, revision ID, publishing user, and
publication instant. A revision adds a human change summary. Authenticated
Functions callables own publish, revert, and shared location/climate
publication; they validate both access claims and the complete plan before
making metadata, published record, and revision agree in one transaction.
Firestore rules deny direct client writes to all three records.

`DraftPlanRecord` contains `userId`, `baseRevisionId`, plan, and update instant.
The document ID must equal `userId`, and `baseRevisionId` must equal the current
published revision when the draft is saved. A user cannot read another user's
draft.

## Garden plan

`GardenPlan` is a single complete snapshot:

- stable ID/name and ISO creation/update instants
- `setupCompleted`
- plot
- structures
- planting groups
- review decisions

The plot stores positive width/depth in feet, north rotation, snap interval,
climate defaults, and location:

- free-text label/query
- IANA timezone
- either a valid latitude/longitude pair or `null`

A missing coordinate pair is a supported incomplete/migrated safe state and
disables authoritative weather-derived recommendations. It does not become
`0,0` or inherit a default city. The current first-run and Settings forms
require an explicit valid coordinate pair, location/query, IANA timezone,
hardiness zone, and real frost-date assumptions before setup can be completed
or shared climate changes can be saved.

Structures store feet-based position/size, rotation, type, soil/drainage/depth,
mulch, irrigation zone, notes, and lock state. Growing structures are beds,
raised beds, and containers; paths and trellises do not provide growing area.

## Planting groups and instances

A `PlantingGroup` represents one crop cohort and is the unit of planning,
watering, task targeting, and harvest attribution. It stores:

- crop ID/name, lifecycle, arrangement, spacing, planned/planted dates, sun,
  notes, mulch, lock state, and irrigation/structure links
- feet-based group footprint and center
- one or more plant instances with their own IDs, labels, and feet coordinates
- a complete `PlantingWaterProfileSnapshot`

The group and every instance must remain inside the plot. A group assigned to a
growing structure must fit that structure. IDs are unique across their
respective collections. Locked items cannot be moved by layout suggestions.

The water profile snapshot contains base weekly inches, root depth, depletion
fraction, establishment/flowering/fruiting/mature coefficients, confidence,
source, and source version. It is intentionally stored with the plan instead of
looked up at calculation time.

## Water applications

Every `WaterApplication` targets exactly one crop-group ID, records its creating
user in `recordedByUserId`, and has a stable positive revision number.

An applied or partial record has:

- applied/recorded instants and method
- inches; or gallons plus saved area/reliability; or explicit unknown amount
- efficiency fraction, confidence, and source

A partial record credits only its explicit amount; it never means that the full
recommendation was applied. A skipped record has a reason and no amount or
efficiency. Skipped always credits zero water. Unknown amount is retained as
evidence of the action but also credits no invented depth.

Gallons convert to depth only when the saved area is reliable enough. The
original unit and area remain in the ledger so recalculation is auditable.

## Durable water balance

`WaterBalanceBaseline` is keyed by crop-group ID and stores:

- `asOfIso`
- depletion inches
- model version and calculation revision
- crop-profile fingerprint
- application ledger entries with credited depth/outcome/revision

The application ledger makes recalculation idempotent and permits corrected
application revisions without double credit. Feed corrections update the same
application ID at exactly the prior revision plus one; crop group and original
recorder are immutable, while outcome, explicit amount, method, date, or skip
reason may change. A model or profile fingerprint change is explicit;
incompatible state is not silently rolled forward.

Production migration assigns the non-user actor `migration` to legacy water
records that can be converted unambiguously. One-way runtime normalization may
use `legacy`. Feed retains that ID in the record and uses its compact two-label
presentation: the current ID is **You** and every other ID is **Garden member**.

## Watering recommendation

Every recommendation targets one crop group and lists exactly that group in
`plantingIds`. The record includes:

- status: `due`, `scheduled`, `suppressed`, or `checkSoil`
- action: `waterNow`, `planWatering`, `waitForForecast`, or `checkSoil`
- actionable flag, confidence, data quality, and calculation instant
- projected depletion, trigger, root-zone capacity, recommended depth, optional
  gallons, schedule/suppression/recheck instants
- resulting durable balance
- complete crop-profile/structure/area basis
- explicit crop stage, stage coefficient, stage source, and saved profile
  source/version
- ordered reason codes/details with source IDs and optional inch amounts
- crop-group, crop, structure, and deep-link target metadata

`recommendedDepthInches` and `recommendedGallons` are nullable by design. A soil
check is a real recommendation, not a disguised numeric estimate.

## Tasks and field memory

Tasks store kind, title, reason, notes, due garden date, priority, status,
creation/update/completion instants, source ID, and a garden/structure/crop-group
target. User transitions are `open`, `done`, `deferred`, or `snoozed`.

Journal entries store author, type, title/body, occurred date, target, and up to
the validated photo limit. Issues add category, severity, status, and optional
resolution instant. Harvest records always identify the crop and planting group
and retain the selected unit.

Photo metadata records content type, filename, object path, byte size, upload
instant, and optional dimensions. The Storage path includes the uploader UID;
the Firestore journal entry remains shared.

## User profile and delivery state

`UserProfile` contains identity display fields, an IANA timezone, update instant,
and `NotificationPreferences`:

- enabled booleans for watering, task due, frost, heat, and severe weather
- daily local check time
- minimum watering deficit in inches
- explicit push-enabled consent
- local quiet-hours start/end

Push tokens are per-user registrations with permission, platform, token ID,
first/last-seen instants, and user agent. A delivery receipt is server-owned and
private to its user; it records the resolved title/body/link, channel/platform,
attempts, eligibility/deferral, provider result, and final/retry state. For
push, `sent` records provider acceptance only; it does not assert that a device
displayed the notification.

## Authorization invariants

All Firebase access requires an authenticated identity with both membership
claims. Shared workspace readers can see published plans and field operations.
Only the matching user can see a draft, profile, push token, or delivery history.
Client code cannot write weather snapshots, balances, recommendations, alerts,
delivery receipts, or automation leases.

Validation exists in TypeScript and Firebase rules. TypeScript validation is for
safe behavior and useful errors; rules remain the authorization boundary.
