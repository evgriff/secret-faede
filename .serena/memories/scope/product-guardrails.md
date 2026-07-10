# Product Guardrails

Secret Faeries is a small, private plot planner and field-operations app for one
real home food garden.

Product center:

- one accurate measured plot
- one shared published workspace with one private draft per member
- deterministic crop-group watering and practical tasks derived from the saved
  plan
- actor-attributed, revisioned applied/partial/skipped field records that update
  future balances
- private notes, issues, photos, harvests, and delivery history

Hard boundaries:

- exactly two provisioned password accounts; no public registration
- `AuthService`, `GardenRepository`, and `UserProfileRepository` remain explicit
  seams
- production membership uses secure administrative environment values and both
  Firebase Auth claims, never browser allowlist configuration
- `src/v2` is the only client; the previous client is removed and only one-way
  legacy persisted-data readers remain inside the v2 migration boundary
- mock-first local/CI behavior and PWA usability remain; native support is
  additive
- environment/config must not supply a default city, coordinates, timezone,
  rain value, or watering amount
- uncertain agronomic/weather evidence must lower confidence or request a soil
  check, never create false precision
- each crop group receives its own saved water profile, balance,
  recommendation, ledger credit, task, and alert identity
- first-run and Settings require deliberate exact coordinates, IANA timezone,
  and climate assumptions; incomplete/migrated null coordinates remain a safe
  non-weather state, never a default city

Non-goals:

- multiple gardens, public onboarding/sign-up, public sharing, social feed,
  collaboration, dashboards, charts, maps/GIS, marketplace, lore, generic AI,
  email delivery, or carrier messaging
- dependencies that do not reduce total code for current scope and have no ADR

Data rules:

- plot and object dimensions are feet
- crop-group/plant-instance centers use `xFt` from the left and `yFt` from the
  top
- never persist raw pixels as domain coordinates
- use valid IANA timezones for garden-day, scheduling, and quiet-hour logic
- preserve versioned water inputs/reasons/model revisions for auditability
- profile, draft, token, receipt, and upload-owner boundaries remain private
  even though the published plan and field operations are shared

Change discipline:

- stable product, architecture, story, or workflow changes must update the
  corresponding `.serena/memories/` topics
- `npm run quality:serena` enforces the catalog and mapped updates

Primary local sources:

- `AGENTS.md`
- `codex.md`
- `README.md`
- `docs/architecture.md`
- `docs/firebase.md`
