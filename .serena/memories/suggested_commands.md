# Suggested Commands

Core workflow:

- `git status --short --branch`
- `npm ci`
- `npm run dev`
- `npm run emulators`
- `npm run dev:firebase:emulators`

Verification:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:rules`
- `npm run test:e2e`
- `npm run test:visual`
- `npm run build`
- `npm run ci`

Targeted support commands:

- `npm run functions:build`
- `npm run functions:test`
- `npm run quality:deps`
- `npm run quality:files`
- `npm run quality:bundle`
- `npm run catalog:build`
- `npm run catalog:ingest:trefle`
- `npm run auth:seed-users`
- `npm run seed:dev`
- `npm run deploy:rules`
- `npm run deploy:functions`
- `npm run deploy:hosting`
- `npm run deploy:all`

Serena maintenance:

- `serena project index <repo-path> --log-level INFO --timeout 20`
- `serena project health-check <repo-path>`
- `serena print-system-prompt <repo-path> --context=plugins/serena/codex-context.yml --only-instructions`
