# Product Guardrails

Secret Faeries is a small, private garden plot planner and garden operations app for one real home food garden.

Product center:

- one accurate real plot plan
- one shared published garden workspace with private per-user drafts
- practical daily garden operations derived from the saved plan
- field history that improves future decisions

Hard boundaries:

- preserve password auth for exactly two provisioned accounts
- keep production membership in secure `APP_LOGIN_*` environment values and
  Firebase Auth custom claims, not browser `VITE_*` config
- keep Firebase web push VAPID config optional for Hosting deploys unless web
  push registration is enabled
- keep `AuthService` as the auth seam
- keep `GardenRepository` as the garden persistence seam
- keep `UserProfileRepository` as the profile and alert preference seam
- keep mock-first local and CI behavior
- keep PWA-first behavior; native support is additive
- `npm run quality:serena` requires this memory to move with product guardrail
  docs such as `AGENTS.md`, `codex.md`, `README.md`, `docs/architecture.md`,
  and `docs/firebase.md`

Non-goals:

- no dashboards, charts, maps, collaboration, lore, AI, carrier messaging, social feed, public onboarding, public sign-up, marketplace, or multi-garden product scope
- no new dependencies unless they clearly reduce code for current foundation scope and are documented in `docs/adr/`

Data rules:

- plot dimensions are stored in feet
- plant and planting-instance centers use `xFt` from the left plot edge and `yFt` from the top plot edge
- never store raw pixels as canonical garden coordinates

Primary local sources:

- `AGENTS.md`
- `codex.md`
- `README.md`
- `docs/architecture.md`
- `docs/firebase.md`
