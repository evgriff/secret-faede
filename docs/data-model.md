# Data Model

Date: 2026-04-21

## Garden Workspace

Secret Faede now treats the garden plan as one shared published plan with
private per-user drafts.

Canonical Firebase paths:

- `gardenWorkspaces/main`: the current published garden revision.
- `gardenWorkspaces/main/drafts/{uid}`: one private working draft per user.
- `gardenWorkspaces/main/revisions/{revisionId}`: published revision history.
- `users/{uid}`: user profile, alert preferences, and push tokens.

Legacy path:

- `gardens/{uid}` remains readable for migration and older seed data, but new
  editor saves go to the user's draft workspace.

## Garden Schema Version

Every parsed garden aggregate now carries `schemaVersion:
CURRENT_GARDEN_SCHEMA_VERSION`, currently `2`.

The migration helper in `src/domain/gardens/schemaMigrations.ts` runs before
normal validation. It keeps legacy records readable by:

- copying old `plants[]` data into canonical `plantings[]` when needed
- normalizing plot defaults to `gridUnitFt: 1` and `snapUnitFt: 0.125`
- adding missing workspace arrays such as `structures[]`, `tasks[]`,
  `journalEntries[]`, and `sunShadeLayers[]`
- adding an empty `seasonPlan` when older records do not have one

The parser still bounds all feet-based dimensions and coordinates after the
migration pass. Future schema changes should add a migration step instead of
branching inside route components.

## Published Revision

A published revision stores:

- `id`: stable revision id.
- `garden`: full garden aggregate at publish time.
- `publishedAtIso`: publish timestamp.
- `publishedByUserId` and `publishedByEmail`.
- `baseRevisionId`: draft base revision, or `null` for initial publish.
- `action`: `initial`, `publish`, or `revert`.
- `revertedFromRevisionId`: source revision when action is `revert`.
- `changesetSummary`: count-based summary of changed plot settings, plantings,
  structures, tasks, journal entries, harvests, and suggestion decisions.
- `suggestionDecisions`: accepted/rejected review suggestions included in the
  publish review.

## User Draft

A draft stores:

- `userId`: draft owner.
- `garden`: the owner's editable garden aggregate.
- `baseRevisionId`: published revision the draft started from.
- `updatedAtIso`: last draft save time.
- `suggestionDecisions`: accepted/rejected review suggestions tracked while
  editing.

Draft saves do not change `gardenWorkspaces/main`. Publishing is the only path
that replaces the shared published plan.

## Offline Queue And Conflict State

Firebase draft saves that fail while offline or while Firestore is temporarily
unavailable are stored locally under `secret-faede.pending-garden-save.v1:{uid}`.
The pending record stores:

- the garden aggregate
- `draftBaseRevisionId`
- `draftUpdatedAtIso`
- `gardenUpdatedAtIso`
- `queuedAtIso`
- `schemaVersion`
- optional `conflictDetectedAtIso` and `publishedRevisionId`

When the app comes back online, Firebase sync checks the queued draft's
`draftBaseRevisionId` against the current published revision before writing. If
the published revision changed first, the app marks the pending save as a sync
conflict and keeps the local draft queued for an explicit Plan review. It does
not silently convert that stale draft into a last-write-wins cloud save.

## Season Plan

`garden.seasonPlan` stores pre-layout crop intent for the current planning
season. It is part of the garden aggregate so drafts, publish summaries, revert,
offline saves, and Firebase rules all follow the same existing garden workflow.

`seasonPlan.wantedCrops[]` stores:

- `cropId`: reference into the offline crop catalog.
- `targetQuantity`: desired count before layout.
- `modePreference`: preferred planting mode (`single`, `row`, `block`,
  `cluster`, or `trellisLine`).
- `commitment`: `mustGrow` or `niceToHave`.
- `sowPreference`: `directSow`, `transplant`, or `noPreference`.
- `containerAllowed` and `supportAllowed`: optimizer constraints.
- `priority`: `high`, `medium`, or `low`.
- `rank`: board order for optimizer priority.
- `varietyName` and `notes`: user-supplied season context.

Wanted crops are not plantings. They become optimizer layout requests first; the
canvas still persists placed crops as `plantings[]` with feet-based coordinates.

## Planting Lifecycle And Relocation

Saved `plantings[]` remain the canonical placed crop records. Plant centers are
persisted as `xFt` and `yFt` in feet from the left and top plot edges.

Each planting stores lifecycle and relocation state:

- `status`: `planned`, `planted`, `growing`, `harvest-ready`, `harvested`, or
  `removed`.
- `locked`: manual editor lock that prevents direct movement.
- `allowRelocation`: explicit user override that allows a real-world planting
  to be moved by the planner or optimizer.

Lifecycle status controls real-world immutability:

- `planned` crops are movable draft ideas unless manually locked.
- `planted`, `growing`, and `harvest-ready` crops reserve their saved footprint
  and are anchored unless the user explicitly enables `allowRelocation`.
- `harvested` and `removed` crops no longer reserve optimizer space and can free
  the area for future proposals.

The optimizer works around anchored real-world plantings instead of silently
relocating them. Review suggestions carry a relocation impact label so planned
geometry moves stay distinct from proposals that would ask the gardener to
physically move an already planted crop.

## Publish

Publish flow:

1. Save the current editor state as the user's draft.
2. Compare the draft garden to the published garden at the draft base revision.
3. Show the changeset summary, accepted/rejected suggestions, and stale-base
   warning if the current published revision differs from `baseRevisionId`.
4. If no stale-base conflict exists, create a new revision and make it current.
5. If a stale-base conflict exists, require an explicit "publish anyway"
   confirmation.

This is intentionally not a merge UI. With two users, the app surfaces that the
base changed and lets the user either sync from published or publish anyway.

## Revert

Reverting does not mutate history. It creates a new published revision whose
`garden` is copied from the selected prior revision and whose `action` is
`revert`. The reverting user's draft is reset to the new published revision.

## Structure Layer

Saved structures remain rectangular, feet-based objects with top-left
coordinates:

- `type`: `raisedBed`, `inGroundBed`, `container`, `pathway`, `path`,
  `trellis`, `fenceWall`, `treeObstacle`, `compost`, `waterSource`,
  `hoseBib`, or legacy aliases.
- `widthFt`, `depthFt`, `heightFt`, `xFt`, `yFt`: persisted in feet.
- `material`: `woodChips`, `mulch`, `gravel`, `pavers`, `stone`, `lumber`,
  `wire`, `metal`, `soil`, `mixed`, or `none`.
- `workingClearanceFt`: the aisle/maintenance clearance expected around beds,
  containers, compost, water, and support structures.
- `accessiblePath`: marks paths that should meet the larger accessible default.
- `continuousPath`: records whether a path segment is part of a usable route.
- `locked`: marks installed or otherwise fixed structures that should stay
  anchored unless the user unlocks them.

Default path width is 3 ft. Accessible path defaults create 4 ft paths. The
review engine flags path segments below their saved standard, path segments not
marked continuous, and beds/containers without a saved path inside their working
clearance.

Material summaries are derived from the same saved structures:

- beds report dimensions, square footage, and raised/container soil capacity
- paths report surface material area
- trellises report count and total saved length
- crop support suggestions use crop growth form, trellis flags, planting mode,
  plant count, row length, and spacing

## Crop Catalog

The runtime crop library is the checked-in
`src/domain/crops/homeGardenCropCatalog.generated.json` file. It currently
contains 883 practical home-garden profiles across vegetables, herbs, berries,
tree/common fruits, pollinator flowers, cover crops, grains, roots, brassicas,
and companion/beneficial plantings.

Each `CropProfile` stores:

- identity: `id`, `commonName`, `scientificName`, `family`, `aliases`,
  `synonyms`, and optional `varietyGroup`
- taxonomy/planning: `category`, `lifecycle`, `growthForm`, `roles`, and
  `sourceTags`
- geometry/care defaults: mature height/spread, spacing, row spacing, root
  depth, sun requirement, weekly water, sow method, days to maturity, supported
  planting modes, and trellis/support flags
- local guidance: notes, pollinator/beneficial role, caution/toxicity notes
  when relevant, hardiness, and perennial suitability
- provenance: `source`, `lastRefreshedIso`, `manualOverride`,
  `profileConfidence`, and `completenessScore`
- iconography: `defaultIcon`, with crop-specific glyphs first and
  category/family fallbacks when a precise crop icon is unavailable

Trefle is used through the offline ingestion pipeline. The browser does not call
Trefle during normal use. Gardening-specific values are marked as curated
overlays because botanical source data rarely contains complete spacing,
trellis, sowing, and water-management fields.

## Authorization

Firestore rules require `gardenAccess: true` and `secretFaedeMember: true`.
Members can read the shared published plan and revision history. Users can only
read and write their own draft document.
