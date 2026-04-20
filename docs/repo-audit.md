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
- `/auth/complete`
- `/access-denied`
- `/app`
- `/app/garden`
- `/app/tasks`
- `/app/journal`
- `/app/settings`
- `*`

## 4. Preserved seams

- `AuthService` for email-link auth
- `GardenRepository` for one saved garden per user
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

- one garden per authenticated user
- plot dimensions in feet
- plant center positions in feet
- manual save to `gardens/{uid}` in Firebase mode
- authenticated shell routes for garden, tasks, journal, and settings
- weather reads and watering recommendations are scoped to garden operations
- no multiple garden management, notifications, maps, collaboration,
  onboarding, or AI features yet
