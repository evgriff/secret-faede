# Repo Audit

## 1. Current stack detected

- Node 22 + npm
- React 19
- TypeScript 5
- Vite 7
- React Router 7
- Firebase modular Web SDK
- `vite-plugin-pwa`
- ESLint flat config
- Prettier
- Vitest + React Testing Library
- Playwright
- Husky + lint-staged

## 2. Current Firebase-related files detected

- `firebase.json`
- `.firebaserc`
- `firestore.rules`
- `firestore.indexes.json`
- `scripts/setup-live-firebase.mjs`
- `src/infrastructure/firebase/*`
- `.env.example`

## 3. Current route structure detected

- `/`
- `/sign-in`
- `/auth/complete` legacy redirect
- `/access-denied`
- `/app`
- `/app/plan`
- `/app/today`
- `/app/feed`
- `/app/settings`
- `/app/garden`, `/app/tasks`, `/app/journal` legacy redirects
- `*`

## 4. Preserved seams

- `AuthService` for password auth
- `GardenRepository` for one shared published garden plus one private draft per
  provisioned user
- mock/runtime split
- Firebase Auth, Firestore, Hosting, and emulator scaffolding
- GitHub Actions quality and Hosting workflows

## 5. Removed scope

- birthday intro and design-review routes
- decorative entry-flow components and assets
- style-pack route and documents
- placeholder authenticated shell
- old multi-garden/mock garden selection files
- dependencies only used by removed decorative UI

## 6. Current product boundary

- one shared published garden workspace with private per-user drafts
- plot dimensions in feet
- plant and planting-instance center positions in feet
- shared draft/publish save through `gardenWorkspaces/main` in Firebase mode
- authenticated shell routes for Plan, Today, Feed, and Settings
- weather reads and watering recommendations are scoped to garden operations
- no multiple garden management, maps, collaboration, carrier messaging,
  onboarding-heavy flows, or AI features
