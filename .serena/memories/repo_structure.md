# Repo Structure

Core app code lives under `src/`:

- `src/app`: composition root, router, providers, and route guards.
- `src/domain`: canonical interfaces and models for auth, gardens, crops, users, weather, notifications, media, mobile, and telemetry.
- `src/features/auth`: sign-in, access denied, and auth context.
- `src/features/plan`: Plan workspace, canvas tools, inspector, optimizer/review helpers, and pointer/keyboard hooks.
- `src/features/garden`: compatibility exports, garden state hook, crop picker, coordinate math, sun/shade, watering, planning, and review helpers.
- `src/features/today`: Today route and generated field work UI.
- `src/features/log` and `src/features/journal`: Feed route, notes, issues, photos, harvests, summaries, and compatibility exports.
- `src/features/settings`: notification preference and alert default editing.
- `src/infrastructure`: Firebase/mock adapters, runtime service selection, weather cache/providers, notification adapters, and media storage adapters.
- `src/shared`: config parsing, allowlist helpers, reusable shell UI, and global styles.

Cloud Functions source lives in `functions/`. Operational docs live in `docs/`. Utility scripts live in `scripts/`. Native shell projects live in `ios/` and `android/`.
