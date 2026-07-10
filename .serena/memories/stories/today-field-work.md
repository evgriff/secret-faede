# Story: Today Field Work

User story:

As a grower standing in the garden, I need Today to show separate, explainable
watering decisions and the practical work due now, then record exactly what I
did without corrupting another crop's history.

Route and ownership:

- canonical route: `/app/today`
- legacy redirect: `/app/tasks`
- exact focus links use `focus=watering` with crop-group/recommendation ID,
  `focus=task` with task ID, or `focus=weather` with snapshot/alert ID
- active implementation: `src/v2/routes/today` with weather/recommendation/
  persistence composition in `src/v2/app/TodayRoute.tsx`
- `GardenRepository` writes tasks and water applications; Functions own
  canonical generated balances/recommendations/tasks/alerts

Watering success criteria:

- one card exists for every active crop group; shared beds/zones never pool
  recommendations
- cards expose crop target, status/action, confidence, data quality, root-zone
  depletion/trigger, optional depth/gallons, recheck time, reasons/source IDs,
  and saved calculation basis including explicit stage/stage source/coefficient
  plus profile and weather provenance
- the client prefers fresh persisted `crop-water-balance-v2` output and uses
  only conservative per-crop soil-check fallback when it is absent/stale
- missing coordinates or insufficient evidence show `checkSoil` without an
  invented city, rainfall, amount, or automatic watering push
- applied/partial logs contain an explicit amount/unit, method, and efficiency;
  skipped logs require a reason, contain no amount, and receive zero credit
- every log stores the signed-in actor and revision 1; partial credits only its
  explicit amount
- a saved Firebase application requests canonical refresh; the field update
  reports committed only after the active repository succeeds, or surfaces an
  error without promising offline sync

Task/weather success criteria:

- generated work covers crop lifecycle/timeline, support, thinning, feeding,
  pruning, mulch, inspection/weeding, watering, harvest, succession review, and
  evidence-backed frost/heat preparation
- task cards show passive target/reason/priority/date and support complete,
  reopen, snooze, and defer without duplicate generated records
- regenerated tasks preserve concurrent user actions
- exact alert/task/watering deep links focus the intended card and degrade
  safely when its ID is gone
- weather refresh uses the saved coordinate pair/timezone, labels provider/
  freshness/failure, and never treats qualitative rain as observed water
- quiet/empty states remain compact rather than becoming a dashboard

Interaction rules:

- watering/task completion never requires a photo
- Today is the alert landing surface, not a second planner or notification
  command center
- all garden dates and snooze/defer calculations use the saved IANA timezone
  and explicit DST policy

Primary local sources:

- `docs/architecture.md`
- `docs/api-integrations.md`
- `docs/ux-architecture.md`
- `docs/testing-plan.md`
- `README.md`
