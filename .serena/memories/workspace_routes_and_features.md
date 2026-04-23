# Workspace Routes And Features

Route map:

- `/`, `/sign-in`, `/access-denied`
- protected shell at `/app`
- authenticated workspaces: `/app/plan`, `/app/today`, `/app/feed`, `/app/settings`
- legacy redirects from `/auth/complete`, `/app/garden`, `/app/tasks`, `/app/log`, and `/app/journal`

Feature responsibilities:

- Plan is the product center: first-run setup, plot editing, grouped plant footprints, crop chooser, inspector, problem review, optimizer variants, publish/revert, weather operations, and sun overlays
- Today turns the saved plan into field work: generated tasks, watering and weather context, harvest, issue, and photo quick actions, manual tasks, and local alert helpers
- Feed records notes, issues, photos, harvests, and compact season summaries from the same garden state
- Settings owns alert defaults, quiet hours, check time, push/native/local notification controls, location and timezone edits, and demo mode controls
- Auth pages handle password sign-in, access-denied recovery, and remembered-session behavior

Cross-cutting ownership:

- `src/features/garden` holds shared garden state, feet-based geometry, constraint checks, sun and shade, watering, and review logic used by Plan and operations flows
- `src/features/tasks/taskEngine.ts` is the generated task source that feeds Today and related workflows
- `src/features/demo` keeps demo mode browser-local and reversible; it is not a separate product model
