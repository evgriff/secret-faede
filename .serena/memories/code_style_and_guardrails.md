# Code Style And Guardrails

- Prefer small files, named exports, plain TypeScript, readable route guards, and explicit service seams.
- Keep `AuthService` as the auth boundary, `GardenRepository` as the garden persistence boundary, and `UserProfileRepository` as the user profile boundary.
- Use mock-first patterns and keep mock mode working when touching runtime behavior.
- Store plot dimensions and positions in feet. Plant and planting-instance centers use `xFt` from the left edge and `yFt` from the top edge.
- Do not store canonical garden coordinates as raw pixels.
- Do not reintroduce carrier messaging.
- Do not add dependencies unless they clearly reduce code and cognitive load for the current foundation scope; document accepted dependencies in `docs/adr/`.
- For UI work, preserve the app’s canvas-first Plan workspace and field-friendly operations surfaces.
- Before substantial edits, name the intended write set and keep changes scoped.
- Treat pre-existing dirty files as user-owned.
