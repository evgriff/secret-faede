# Runtime And Persistence

Environment selection starts in `resolveAppEnvironment()` and service composition happens in `src/infrastructure/runtime/services.ts`. The runtime builds explicit app services for auth, gardens, garden operations, users, weather, notifications, media, telemetry, and mobile device support.

Important seams:

- `AuthService`: email/password sign-in, password reset, persistence preference, session lookup, and sign-out
- `GardenRepository`: shared workspace reads and writes, publish, discard, revert, and compatibility draft helpers
- `GardenOperationsService`: higher-level garden operations built on repository data
- `UserProfileRepository`: alert defaults and notification preferences
- `WeatherProvider`: NWS by default, optional Tomorrow.io behind config
- `NotificationService`: FCM web/native token registration and foreground handling
- `MediaStorageService`: journal photo upload
- `MobileDeviceService`: Capacitor-only network, camera, and local-notification behavior through a lazy adapter

Firebase persistence model:

- published workspace: `gardenWorkspaces/main`
- per-user drafts: `gardenWorkspaces/main/drafts/{uid}`
- published history: `gardenWorkspaces/main/revisions/{revisionId}`
- legacy migration source and operations subcollections: `gardens/{uid}`
- user profile and push tokens: `users/{uid}` and `users/{uid}/pushTokens/{tokenId}`
- journal photos: Firebase Storage under `users/{uid}/journal/{entryId}/...`

Offline behavior:

- Firestore uses persistent local cache when available
- Firebase garden saves also keep a pending aggregate save in localStorage while offline
- reconnect compares the draft base revision before cloud sync so stale offline drafts do not silently overwrite newer published state
