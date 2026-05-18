# Story: Plan Real Plot Editor

User story:

As a home food grower, I need a real plot editor that preserves physical dimensions, crop placement, supports, sun/shade context, and draft/publish safety so I can decide what goes where and keep the garden plan accurate.

Route and workflow:

- primary route: `/app/plan`
- legacy redirect: `/app/garden`
- first-run setup asks for garden name, plot type, plot size, and starter layout, with optional location and climate details
- first-run and layout fixtures use the generic Detroit climate/location baseline so public builds avoid private location data while keeping frost-date behavior realistic
- Plan remains the product center and should be canvas-first

Success criteria:

- plot width/depth and object positions remain feet-based
- Add Plants asks for crop and quantity, then uses arrangement-aware planting groups
- grouped plant footprints expose individual plant nodes when needed
- Review and Optimize present practical before/after choices, not numeric score dashboards
- Publish, revert, stale draft conflicts, and draft recovery actions are visible
  and recoverable from the primary Plan controls
- pointer interactions should avoid forced synchronous React renders so drag,
  resize, select, and pan stay responsive on production-sized gardens
- drop/release should keep the imperative preview visible, then commit feet-based
  state and autosave after paint so pointer-up does not block the visual release
- weather, watering, sun, and operations panels support the editor rather than replacing it
- layout suggestions and seasonal crop planning should keep climate-aware assertions tied to the public Detroit baseline

Implementation ownership:

- `src/features/plan`: route, canvas workspace, overlays, inspectors, first-run, review, optimizer, publish/revert
- `src/features/garden`: shared state, geometry, sun/shade, warning, watering, and review engines
- `src/domain/gardens`: canonical garden model and repository interfaces

Off-scope traps:

- do not add map/GIS behavior
- do not turn Review or Optimize into dashboards
- do not reintroduce score-heavy optimizer UI or generic AI planning

Primary local sources:

- `docs/architecture.md`
- `docs/demo-script.md`
- `docs/manual-qa-checklist.md`
- `README.md`
