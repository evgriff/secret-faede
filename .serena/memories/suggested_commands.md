# Suggested Commands

- `git status --short --branch`: start every agentic workflow and confirm the branch.
- `npm ci`: install dependencies with Node 22.
- `npm run dev`: start the default mock-first Vite dev server.
- `npm run dev:firebase:emulators`: run Vite against Firebase emulators.
- `npm run emulators`: start Auth, Firestore, Storage, Functions, Hosting, and Emulator UI.
- `npm run lint`: run ESLint.
- `npm run typecheck`: run TypeScript project checks.
- `npm run test:unit`: run unit tests, excluding integration tests.
- `npm run test:integration`: run Firebase integration tests.
- `npm run test:rules`: run Firestore and Storage rules tests.
- `npm run test:e2e`: run Playwright end-to-end tests.
- `npm run build`: run TypeScript build and Vite production build.
- `npm run ci`: run the full repository quality gate.
- `npm run functions:build`: syntax-check Cloud Functions source.
- `npm run functions:test`: run Cloud Functions notification logic tests.
- `serena project index <repo-path> --log-level INFO --timeout 20`: refresh Serena’s symbol cache.
- `serena project health-check <repo-path>`: verify Serena project health.
