# Garden Workspace Persistence

Canonical model:

- one shared published garden workspace
- one private draft per authenticated user
- shared operations stream for Feed and Today
- legacy `gardens/{uid}` remains a migration source only where documented

Current Firebase paths:

- published workspace: `gardenWorkspaces/main`
- per-user drafts: `gardenWorkspaces/main/drafts/{uid}`
- published revisions: `gardenWorkspaces/main/revisions/{revisionId}`
- journal entries: `gardenWorkspaces/main/journal/{entryId}`
- harvests: `gardenWorkspaces/main/harvests/{harvestId}`
- tasks: `gardenWorkspaces/main/tasks/{taskId}`
- watering schedule: `gardenWorkspaces/main/wateringSchedule/{entryId}`
- weather snapshots: `gardenWorkspaces/main/weatherSnapshots/{snapshotId}`
- notifications: `gardenWorkspaces/main/notifications/{notificationId}`
- user profiles and push tokens: `users/{uid}` and `users/{uid}/pushTokens/{tokenId}`
- Firebase Storage journal photos: `gardenWorkspaces/main/journal/{entryId}/{photoId}-{fileName}`

Repository rules:

- `GardenRepository` owns garden persistence and publish/discard/revert operations.
- `GardenOperationsService` can build higher-level operations on repository data.
- UI code should not bypass the repository for garden workspace writes.
- Mock mode must remain functional with localStorage-backed adapters.
- Seed/sample fixtures should stay public-safe: generic user identities, Detroit sample climate/location defaults, and no private project, address, provider, or archived-planning artifacts.

Verification:

- `GardenEditorScreen.test.tsx` covers the full Choose Plants optimizer input
  path; that longer UI-path unit test has an explicit 30s timeout for GitHub CI
  parity.

Offline behavior:

- Firestore persistent local cache is enabled when available.
- Firebase garden saves also queue a pending aggregate save in localStorage while offline.
- Reconnect compares draft base revision metadata before syncing so stale offline drafts do not silently overwrite newer published state.

Primary local sources:

- `docs/architecture.md`
- `docs/firebase.md`
- `docs/data-model.md`
- `README.md`
