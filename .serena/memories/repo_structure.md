# Repo Structure

Top-level layout:

- `src/app`: composition root, providers, router, protected layout, and redirects
- `src/domain`: canonical interfaces and garden, crop, user, weather, media, mobile, and telemetry models
- `src/infrastructure`: runtime service assembly plus mock, Firebase, Capacitor, and weather-provider adapters
- `functions/`: scheduled notification and garden-operations logic with tests in `functions/test`
- `scripts/`: catalog, Firebase setup, seeding, bundle, and repo-quality scripts
- `docs/`: architecture, Firebase, testing/CI, deployment, runbooks, and product notes
- `plugins/serena`: repo-local Serena plugin wiring, including `.mcp.json`, plugin metadata, and the custom Codex context file used to expose the intended toolset
- `.agents/plugins/marketplace.json`: Codex marketplace entry that auto-loads the repo-local Serena plugin
- `.serena/`: Serena project config, caches/logs, and tracked project memories

Feature ownership inside `src/features`:

- `auth`: sign-in, access denied, auth context, session resume
- `plan`: route page, canvas UI, chooser flows, first-run setup, review/problem inbox, optimizer, publish, and revert
- `garden`: garden state hook, crop helpers, feet-based geometry, warning, sun, watering, and review engines, plus editor support components
- `today`: Today page, task groupings, field actions, quick actions, and local notification helpers
- `log` and `journal`: Feed route UI, entry composer, issues, photos, harvests, summaries, and analytics helpers
- `settings`: alert defaults, notification center, mobile-device controls, and demo controls
- `demo`: browser-local demo mode storage
- `shared`: feature-level design primitives and shared utilities
- `tasks`: task engine and compatibility route export
