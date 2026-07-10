# Story: Feed Operational Memory

User story:

As a grower, I need one private operational history of notes, issues, photos,
harvests, and crop-specific watering decisions so I can remember what happened
and improve the next field decision.

Route and ownership:

- canonical route: `/app/feed`
- legacy redirects: `/app/log` and `/app/journal`
- active implementation: `src/v2/routes/feed` with composition/media adapters
  in `src/v2/app/FeedRoute.tsx`
- `GardenRepository` writes shared journal, harvest, and water-application
  records; `MediaStorageService` uploads journal photos

Success criteria:

- one **New entry** action opens explicit Note, Issue, Photo, and Harvest modes
- note/issue/photo targets are the whole garden, one structure, or one crop
  group; harvests belong to one crop group
- issues store category, severity, open/in-progress/resolved status, and
  resolution time
- photo files are validated for type/count/size, uploaded under an uploader-
  scoped Storage path, and written to metadata only after successful upload
- summary and filters remain compact: search, type, target, and status
- open issues can stay visible without turning Feed into a dashboard
- applied/partial water shows the explicit amount/method; skipped water shows
  its reason and structural zero credit, with no invented amount
- activity labels the immutable recorder as **You** or **Garden member** and
  filters applied, partial, and skipped outcomes separately
- correction updates the same application ID at revision +1, preserves crop and
  original recorder, and can change outcome, amount, method, date, or skip reason
  before canonical recalculation replaces prior credit
- crop/structure target links use the canonical Plan query and a missing target
  degrades safely
- all garden dates use the relevant saved IANA timezone helper, never UTC string
  slicing
- no active repository promises a durable offline text queue; failed/pending
  commands remain distinct from committed state, and photo bytes are volatile
  and never described as queued

Presentation rules:

- Feed is private operational memory, not social posting
- photo entries may be image-led; tasks, issues, harvests, and watering records
  stay compact
- field records remain understandable without analytics charts or season-score
  dashboards

Primary local sources:

- `docs/architecture.md`
- `docs/ux-architecture.md`
- `docs/demo-script.md`
- `docs/testing-plan.md`
- `README.md`
