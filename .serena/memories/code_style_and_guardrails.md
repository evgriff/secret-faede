# Code Style And Guardrails

Architecture rules:

- Keep seams explicit: `AuthService` owns auth, `GardenRepository` owns garden persistence, `UserProfileRepository` owns profile preferences, and runtime adapters stay behind domain interfaces.
- Preserve mock-first, PWA-first behavior. Firebase or native features are additive, not replacements for the web shell.
- Keep the single shared published workspace plus per-user drafts model. Do not invent parallel persistence flows or bypass the repositories from UI code.
- No public sign-up flow. The app-level allowlist still gates access after password sign-in.

Data rules:

- Plot dimensions, structure geometry, and plant or planting-instance centers are canonical feet-based values.
- Use `xFt` from the left edge and `yFt` from the top edge. Never store raw pixels as canonical coordinates.
- Treat carrier messaging as removed scope; do not add new phone or provider flows.

Implementation style:

- Prefer small files, named exports, plain TypeScript, readable route guards, and explicit helper names over generic utility sprawl.
- Follow existing feature boundaries instead of moving garden logic into route components.
- Avoid new dependencies unless they clearly reduce code for the current scope and the reason can be documented in `docs/adr/`.

Product guardrails:

- Keep the canvas-first Plan workspace and field-friendly Today, Feed, and Settings flows intact.
- Do not add dashboards, charts, maps, collaboration, lore, AI, public onboarding, or multiple-garden product scope.
