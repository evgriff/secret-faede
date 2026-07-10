# Story: Plan Real Plot Editor

User story:

As a home food grower, I need a measured plot editor with crop-specific care
inputs and safe draft/publish history so the saved plan matches the real garden
and can drive trustworthy field work.

Route and ownership:

- canonical route: `/app/plan`
- legacy redirect: `/app/garden`
- canonical selection links:
  `?plantingId=<crop-group-id>` and `?structureId=<structure-id>`
- active implementation: `src/v2/routes/plan`
- persistence: `GardenRepository` through `src/v2/app/WorkspaceProvider.tsx`

Success criteria:

- first-run setup requires garden name, exact plot width/depth, a blank,
  raised-bed, or container starting structure, location/query, exact coordinate
  pair, IANA timezone, hardiness zone, and typical frost dates
- internal new-plan storage starts with null coordinates/neutral `UTC`, but
  setup cannot complete in that state and no preset/default city is inferred
- plot/object dimensions stay in feet; crop-group and plant-instance centers use
  `xFt` from the left and `yFt` from the top
- structures and crop groups can be selected, edited, moved by pointer or
  keyboard, locked, and deleted; crop groups can also be duplicated
- pointer preview remains rendering state until release, then commits the same
  feet-based mutation as keyboard movement
- each crop group owns crop identity, arrangement/instances, lifecycle,
  growing-area link, geometry, notes, and a versioned water-profile snapshot
- the inspector makes weekly need, root depth, depletion fraction, profile
  confidence/source/version, and stage coefficients visibly specific to the
  selected crop group
- geometry/link/water-profile validation blocks invalid save/publish and
  assigned crop footprints must fit their growing structure
- Review exposes current problems plus explicit ignore/restore records; ignored
  state never removes the underlying geometry fact
- checked layout is previewed without mutation and requires explicit apply
- draft save/discard, publish summary, revision history, two-step restore, and
  expected-revision conflict recovery are visible
- publish/revert/shared-climate publication cross authenticated Functions
  callables; Firestore denies direct client writes to shared publication records
- a Plan deep link focuses only the matching existing object and never changes
  the draft

Design constraints:

- keep the editor canvas-first and accessible using labeled DOM controls
- do not turn layout/review into score dashboards or make unsupported yield
  claims
- weather/Today/Feed/Settings support the plot; they do not duplicate its
  editing authority
- no maps/GIS, generic AI planning, or multi-garden navigation

Primary local sources:

- `docs/architecture.md`
- `docs/data-model.md`
- `docs/ux-architecture.md`
- `docs/demo-script.md`
- `README.md`
