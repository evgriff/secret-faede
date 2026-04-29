# Data Model

Date: 2026-04-21

## Garden Workspace

Secret Faeries now treats the garden plan as one shared published plan with
private per-user drafts.

Canonical Firebase paths:

- `gardenWorkspaces/main`: the current published garden revision.
- `gardenWorkspaces/main/drafts/{uid}`: one private working draft per user.
- `gardenWorkspaces/main/revisions/{revisionId}`: published revision history.
- `gardenWorkspaces/main/journal/{entryId}`: shared notes, issues, watering
  logs, photo updates, and other Feed entries.
- `gardenWorkspaces/main/harvests/{harvestId}`: shared harvest records.
- `gardenWorkspaces/main/tasks/{taskId}`: shared generated/manual task state.
- `gardenWorkspaces/main/wateringSchedule/{entryId}` and
  `gardenWorkspaces/main/weatherSnapshots/{snapshotId}`: shared operations
  schedule and weather context.
- `gardenWorkspaces/main/notifications/{notificationId}`: shared in-app alert
  history.
- `users/{uid}`: user profile, alert preferences, and push tokens.

Legacy path:

- `gardens/{uid}` remains readable for migration and older seed data, but new
  editor saves go to the user's draft workspace.

## User Profile Notifications

`users/{uid}` stores alert defaults and delivery preferences outside the garden
aggregate. Supported delivery is intentionally narrow:

- in-app notification history is always on and is rendered from
  `gardens/{uid}/notifications/{notificationId}`
- push delivery is controlled by `notificationPreference.channels.push`,
  `notificationPreference.channelConsent.push`, `pushPermission`, and
  `pushTokenLastRegisteredAtIso`
- daily watering checks use `defaultWateringCheckTime`, `timezone`, quiet hours,
  alert-type toggles, and weather/watering thresholds
- local reminders are device-local native capability, not a cloud delivery
  channel

Legacy carrier-message, email delivery, and phone fields are ignored during
parsing and are not exposed by Settings, seed data, Functions, or rules.

## Garden Schema Version

Every parsed garden aggregate now carries `schemaVersion:
CURRENT_GARDEN_SCHEMA_VERSION`, currently `8`.

The migration helper in `src/domain/gardens/schemaMigrations.ts` runs before
normal validation. It keeps legacy records readable by:

- copying old `plants[]` data into canonical `plantings[]` when needed
- normalizing plot defaults to `gridUnitFt: 1` and `snapUnitFt: 0.125`
- adding missing workspace arrays such as `structures[]`, `tasks[]`,
  `journalEntries[]`, and `sunShadeLayers[]`
- adding an empty `seasonPlan` when older records do not have one
- simplifying legacy season-plan records by reading old quantity/form fields and
  dropping former weighting, sowing, container, and ordering fields
- adding explicit `PlantSupportPlan` defaults to saved plantings and dropping
  obsolete marker/node overlay collections that are no longer part of the Plan
  state model
- normalizing `supportStructureIds[]` on every planting so future trellis links
  can be stored explicitly without auto-linking older manually placed
  structures
- removing legacy utility structures such as compost, hose bibs, water sources,
  fences, and tree obstacles from saved page-level structures while keeping
  beds, containers, paths, and trellises readable

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
  publish review, including an impact class of `support`, `planned`, or
  `move`.

## User Draft

A draft stores:

- `userId`: draft owner.
- `garden`: the owner's editable garden aggregate.
- `baseRevisionId`: published revision the draft started from.
- `updatedAtIso`: last draft save time.
- `suggestionDecisions`: accepted/rejected review suggestions tracked while
  editing, including the same impact class used during publish review.

Draft saves do not change `gardenWorkspaces/main`. Publishing is the only path
that replaces the shared published plan. Feed and Today operations are not
draft-owned; they save immediately to the shared operation collections and are
overlaid onto each user's draft on read. New activity records include nullable
`createdByUserId`, `createdByDisplayName`, and `createdByEmail` fields so legacy
records remain readable while new posts show the poster clearly.

## Offline Queue And Conflict State

Firebase draft saves that fail while offline or while Firestore is temporarily
unavailable are stored locally under `secret-faeries.pending-garden-save.v1:{uid}`.
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
- `quantity`: desired plant count before layout; this is the primary visible
  placement input.
- `plantingForm`: recommended or user-adjusted planting form (`single`,
  `row`, `block`, `cluster`, or `trellisLine`).
- `supportAllowed`: optional support allowance for crops where support
  materially affects placement; defaults to true during legacy reads.
- `varietyName` and `notes`: user-supplied season context.

Wanted crops are not plantings. They become optimizer layout requests first; the
canvas still persists placed crops as `plantings[]` with feet-based coordinates.
Legacy quantity/form aliases plus former weighting, sowing, container, and
ordering fields are compatibility-read and then dropped from the
parsed/persisted model.

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

## Planting Instances And Arrangement Groups

`plantings[]` now model a placed crop as an arrangement-aware group with
individual plant nodes. Quantity-to-footprint geometry is centralized in
`src/domain/gardens/plantingGeometry.ts` so rendering, optimizer proposals, and
future sun/shade calculations use the same deterministic feet-based shape:

- the parent planting stores shared crop identity, lifecycle, care defaults,
  arrangement form, and group center `xFt`/`yFt`
- `instances[]` stores each individual plant node with `id`, `label`, `xFt`,
  and `yFt`, all in canonical feet
- `plantCount` is normalized to the number of saved instances
- row, block, cluster, trellis-line, and single modes remain arrangement
  metadata for adding, rendering, optimizer output, and future group editing
- row, block, and cluster geometry derives internal dots, footprint hulls, and
  default arrangement dimensions from quantity, spacing, mature spread, and
  placement mode instead of duplicating layout math in UI components

Backward compatibility:

- older aggregate plantings without `instances[]` are parsed into deterministic
  instance positions from the saved mode/count/spacing fields
- saved instances are preserved and the parent center is recalculated from
  their average position
- default single plantings create one instance at the parent center

Runtime implications:

- Plan renders and selects parent planting groups as grouped footprints with
  internal approximate dots; the inspector still edits the shared parent
  planting metadata
- Add Plant and the Plan inspector use the same arrangement editor to adjust
  quantity, form, and spacing; changing those arrangement fields regenerates
  deterministic `instances[]` in feet while preserving shared crop identity
- reducing quantity shrinks the derived footprint and increasing quantity
  expands it predictably unless a saved record carries explicit per-instance
  positions that should be preserved
- moving a parent planting moves all instances by the same feet-based delta;
  moving an instance updates only that node and recenters the parent group
- Today tasks, Feed entries, harvest logs, water recommendations, and issue
  targets still reference the parent `plantingId` until a later prompt defines
  instance-level operations
- optimizer proposals, starter templates, succession plantings, and demo data
  must create instances before saving so generated layouts do not collapse
  quantity into one visual object
- draft save, publish, revert, offline queue, and revision history persist the
  full garden aggregate, including `instances[]`

## Weather And Watering Balance

`garden.wateringSchedule[]` remains the canonical saved watering work list.
Entries may include optional `waterBalance` metadata from the lifecycle model:

- `modelVersion`: current engine version, starting with `water-balance-v1`.
- `baselineDate` and `baselineSource`: the date/source used to start the water
  balance, including planting events, planted-on records, manual watering, or
  the fallback recent-weather window.
- `dailyNeedInches`, `rootZoneCapacityInches`,
  `allowedDepletionInches`/`thresholdInches`, `currentDepletionInches`, and
  `effectiveDeficitInches`: the root-zone bucket state that decides whether
  Today should show watering.
- `actionableDeficitInches`: the amount still worth applying after forecast
  rain is considered; forecast credit may delay work but does not complete it.
- `recentRainCreditInches`, `manualWaterCreditInches`,
  `plantingWaterCreditInches`, and `forecastCreditInches`: weather and field
  credits counted by the engine.
- `observedRainCreditInches` and `rootZoneCapacitySource`: compatibility-safe
  metadata for explaining how much real rain was credited and whether the
  storage capacity was estimated from garden context.
- `nextCheckReason`: short user-facing explanation used by Today and weather
  panels.

Same-day `directSowed`, `plantedOut`, and `plantedOn` records are treated as
watering baselines, so a newly planted crop does not immediately create a
watering task unless later partial/override state leaves a real deficit.
Forecast rain can suppress or delay work, but completion still comes from an
actual watering log or explicit Today action.

`buildWateringOutlook()` derives transient Today watering windows from the
latest weather snapshot and saved schedule. These windows are not persisted;
they provide the user-facing plan fields `startDate`, `endDate`, `bestDate`,
`headline`, `details`, and `amountInches` so Today can say when to water without
showing repeated daily deficit math.

## Plant Planning Redesign Model

The redesign-facing plant planning model lives in
`src/domain/gardens/plantPlanning.ts`. It names the next UI layer in product
terms without creating a second persistence schema:

- `PlantSpecies` adapts the existing crop catalog `CropProfile`.
- `PlantGroup` adapts a saved `Planting` as one species, one chosen quantity,
  one placement mode, and feet-based center coordinates.
- `PlantDot` is derived from the group quantity, spacing, row spacing, and
  placement mode for rendering individual lightweight plant positions.
- `PlantSupportPlan` stores plant-level supports such as cages, stakes,
  stake-and-weave, row cover, and netting on the plant group. Trellises remain
  normal grid structures and can be linked from the group by structure id.
- `LayoutProblem`, `LayoutResolutionOption`, `LayoutResolution`, and
  `LayoutVariant` model optimizer conflicts and fixes as typed actions instead
  of parsing recommendation copy.
- `PlantEditorModalState` and `DetailedViewState` reserve one shared state
  shape for the future plant editor modal and Detailed View toggle.
- Browser-local Plan UI state is versioned separately under
  `secret-faeries.plan-state.v2:{uid}`. It stores selected/hovered plant group
  ids, label visibility, editor/Detailed View state, typed problem-resolution
  state, and location-match defaults, but always rebuilds `PlantGroup[]` from
  the garden aggregate instead of persisting duplicate crop geometry.

## Plant Catalog And Location Match

The redesign add-plants flow reads `PlantCatalogEntry` values from
`src/domain/crops/plantCatalog.ts`. The module adapts the existing generated
crop catalog instead of introducing a second crop database. Each plant entry
exposes the fields the compact chooser and plant editor need: lifecycle, sun
preference, water need, spacing, mature size, support defaults, compatible
placement modes, timing, harvest cycle, difficulty, description, and local
climate inputs.

Location match lives in `src/domain/crops/plantLocationMatch.ts`. If the user
has not chosen a location, it uses Detroit / southeast Michigan defaults from
the saved garden climate profile, including USDA zone 6a, average frost dates,
and broad cool-season, warm-season, and perennial planting windows.

The match score is intentionally heuristic. It combines placement sun, local
season timing, days to maturity before fall frost, perennial hardiness, and
catalog confidence. The UI should show bands instead of fake precision:

- `Strong match`: score 82-100.
- `Good match`: score 66-81.
- `Watch timing`: score 45-65.
- `Poor match`: score below 45.

Migration note:

- Existing saved gardens continue to read through the current garden migration
  and validation path. Old `plants[]` are copied to `plantings[]`, missing
  `instances[]` are deterministically rebuilt, missing support plans default to
  no support or the legacy support type, `supportStructureIds[]` defaults to an
  empty array, and `createPlantGroupFromPlanting` exposes those records as
  `PlantGroup` values for the redesign UI. Legacy browser-only marker/node
  state is dropped during the local Plan state migration because it is not
  canonical garden data.

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
The UI requires a two-step confirmation before calling this operation.

## Structure Layer

Saved structures remain rectangular, feet-based objects with top-left
coordinates. Beds, containers, access paths, and trellises are the primary Plan
objects. Plant-level cages, stakes, stake-and-weave, row cover, and netting are
stored on the planting support plan instead of in `structures[]`. `trellisLine`
is an arrangement mode only; a crop that needs a real trellis is satisfied by a
linked or nearby saved trellis structure. Legacy shade, utility, compost, and
water-source objects remain parseable only long enough for migration cleanup:

- `type`: authorable values are `raisedBed`, `inGroundBed`, `container`,
  `pathway`, and `trellis`; `path` and `bed` are legacy aliases that still read
  as page structures.
- `widthFt`, `depthFt`, `heightFt`, `xFt`, `yFt`: persisted in feet.
- `material`: `woodChips`, `mulch`, `gravel`, `pavers`, `stone`, `lumber`,
  `wire`, `metal`, `soil`, `mixed`, or `none`.
- `workingClearanceFt`: the aisle/maintenance clearance expected around beds,
  containers, paths, and trellises.
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
- cage and stake summaries come from planting support plans, while trellis
  summaries use saved grid trellis structures and explicit
  `supportStructureIds[]` links. Missing-support suggestions use the central
  crop support profile plus plant count, row length, and spacing.

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
  planting modes, legacy trellis flags, and a normalized `supportProfile`
- local guidance: notes, pollinator/beneficial role, caution/toxicity notes
  when relevant, hardiness, and perennial suitability
- provenance: `source`, `lastRefreshedIso`, `manualOverride`,
  `profileCompleteness`, and `completenessScore`
- iconography: `defaultIcon`, with crop-specific glyphs first and
  category/family fallbacks when a precise crop icon is unavailable

Trefle is used through the offline ingestion pipeline. The browser does not call
Trefle during normal use. Gardening-specific values are marked as curated
overlays because botanical source data rarely contains complete spacing,
support, sowing, and water-management fields. Crop support profiles split
plant-level supports from saved grid trellises and include source tags for the
curated extension guidance used by warnings, Review, Optimize, materials,
tasks, crop focus, Choose Plants, and the plant editor.

## Authorization

Firestore rules require `gardenAccess: true` and `secretFaeriesMember: true`.
Members can read the shared published plan and revision history. Users can only
read and write their own draft document.
