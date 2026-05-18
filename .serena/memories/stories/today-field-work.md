# Story: Today Field Work

User story:

As a grower standing in the garden, I need Today to show the work that matters now, explain why it is due, and let me complete or defer it quickly.

Route and workflow:

- primary route: `/app/today`
- legacy redirect: `/app/tasks`
- Today is derived from the saved garden plan, watering schedule, weather, frost dates, crop defaults, planting events, issues, and harvest context

Success criteria:

- watering work leads with amount, target, reasoning, and direct actions
- weather refreshes automatically on authenticated Today load; the manual refresh
  button is a retry/repair action, not the normal path
- every visible calendar day uses selected-date weather facts, including
  forecast condition, rain chance/amount, and next-rain timing relative to that
  selected day
- the watering calendar includes a keyboard-accessible question-mark help popup
  explaining how watering tasks are scheduled from crop need, rain, weather, and
  logged watering
- generated tasks cover planting, supports, thinning, pruning, fertilizing, mulching, watering, harvest windows, and succession prompts
- field actions are fast: water done, task done, issue, note/photo, and harvest logging
- empty or quiet days collapse secondary panels instead of becoming dashboards
- alerts should bring the user back to Today or the relevant route, not create a separate dashboard
- public sample task timing is anchored to the generic Detroit climate baseline, so generated sow, harden-off, plant-out, seedling, and thinning dates should be validated against the Detroit frost dates

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
- `README.md`
