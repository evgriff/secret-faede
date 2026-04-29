# Story: Today Field Work

User story:

As a grower standing in the garden, I need Today to show the work that matters now, explain why it is due, and let me complete or defer it quickly.

Route and workflow:

- primary route: `/app/today`
- legacy redirect: `/app/tasks`
- Today is derived from the saved garden plan, watering schedule, weather, frost dates, crop defaults, planting events, issues, and harvest context

Success criteria:

- watering work leads with amount, target, reasoning, and direct actions
- generated tasks cover planting, supports, thinning, pruning, fertilizing, mulching, watering, harvest windows, and succession prompts
- field actions are fast: water done, task done, issue, note/photo, and harvest logging
- empty or quiet days collapse secondary panels instead of becoming dashboards
- alerts should bring the user back to Today or the relevant route, not create a separate dashboard

Implementation ownership:

- `src/features/today`: route, day overview, task grouping, field actions, local alert helpers
- `src/features/tasks`: generated task engine
- `src/features/garden`: watering and garden planning inputs
- `GardenRepository`: persists user actions and generated state updates

Off-scope traps:

- do not add analytics panels or dashboard-first summaries
- do not make photo prompts mandatory for water/task completion
- do not add carrier messaging

Primary local sources:

- `docs/architecture.md`
- `docs/demo-script.md`
- `docs/manual-qa-checklist.md`
- `docs/architecture.md`
