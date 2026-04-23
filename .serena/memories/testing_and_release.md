# Testing And Release

Test layers:

- unit and component tests for config, allowlist, auth flows, router behavior, UI helpers, and feature components
- domain tests for planning, geometry, sun and shade, watering, tasks, crop catalog logic, summaries, and demo data
- Firebase adapter integration tests for auth, user profiles, notifications, and media storage
- emulator-backed Firestore and Storage rules tests
- Cloud Functions build plus notification and garden-operations tests
- Playwright smoke coverage for auth, Plan, Today, Feed, Settings, offline flows, and regressions
- visual baselines for the first viewport of Plan, Today, Feed, and Settings

CI behavior:

- `quality.yml` runs `npm run ci` on pushes to `main` and pull requests
- `hosting-preview.yml` builds mock-first preview deployments with PWA disabled
- `hosting-live.yml` runs the full gate and deploys rules, functions, and Hosting from `main`

Release expectations:

- preview builds stay mock-safe unless intentionally reconfigured
- live builds require Firebase runtime env vars and deploy backend pieces together with Hosting
- update visual baselines only for intentional UI changes
- bundle analysis outputs land in `output/bundle-analysis/`
