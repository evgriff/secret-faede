# Story: Feed Operational Memory

User story:

As a grower, I need a private operational memory of notes, issues, photos, watering, harvests, and season summaries so I can remember what happened and improve future decisions.

Route and workflow:

- primary route: `/app/feed`
- legacy redirects: `/app/log` and `/app/journal`
- Feed records notes, structured issues, photo updates, harvests, task/publish/watering history, and compact in-season summaries

Success criteria:

- Feed remains private garden memory, not a social feed
- one New entry launcher opens modes for note, issue, photo update, and harvest
- photo updates can use image-led cards, while watering, issue, task, publish, and harvest memories remain compact
- item-linked memories can jump to the relevant Plan selection or focused Feed card
- offline text entries queue locally; photo behavior should explain browser/native limits clearly

Implementation ownership:

- `src/features/log`: Feed route UI, composer, filters, cards, issues, photos, harvests, summaries
- `src/features/journal`: compatibility exports and summary helpers
- `MediaStorageService`: journal photo upload abstraction
- `GardenRepository`: shared operations persistence

Off-scope traps:

- no social posting, public sharing, analytics dashboard, or generic diary product expansion
- no carrier-message contact delivery data

Primary local sources:

- `docs/architecture.md`
- `docs/demo-script.md`
- `docs/manual-qa-checklist.md`
- `README.md`
