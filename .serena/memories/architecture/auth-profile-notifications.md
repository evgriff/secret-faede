# Auth Profile Notifications

Auth model:

- Firebase email/password auth stays behind `AuthService`.
- There is no public sign-up route.
- Mock/local mode uses the app-level allowlist to gate the two provisioned email addresses after sign-in.
- Firebase production mode gates app access with ID token claims:
  `gardenAccess: true` and `secretFaeriesMember: true`.
- Users missing the runtime's required access signal are signed out and routed
  to `/access-denied`.
- Production membership emails live in secure `APP_LOGIN_*` environment values;
  `npm run auth:sync-access` grants those two Auth users the required custom
  claims and revokes stale member claims from other Auth users.
- Production data protection relies on Firestore and Storage rules with Firebase Auth custom claims, never the browser allowlist.

Profile model:

- `UserProfileRepository` owns alert defaults and notification preferences at `users/{uid}`.
- Settings is the user-facing surface for quiet hours, check time, thresholds, location, timezone, and consent state.
- `refreshGardenOperations` creates a default Detroit profile for a
  provisioned Firebase member if `users/{uid}` is missing, then continues the
  refresh. The production repair script also reports and creates missing
  profiles for provisioned members after backup.
- Provisioned public examples use generic primary/partner gardener identities and placeholder Firebase configuration only.

Notification model:

- `NotificationService` owns web/native push registration and foreground handling.
- FCM web and Capacitor native push tokens are stored under `users/{uid}/pushTokens/{tokenId}`.
- Scheduled delivery stays server-side in Firebase Functions.
- In-app history remains available even when push is not enabled.
- Native/local alerts are additive through `MobileDeviceService` and must not break the PWA path.
- Compatibility cleanup may reject neutral retired-delivery fixture keys in tests, but current tracked data and templates must not contain private delivery provider details or personal contact data.

Removed scope:

- Carrier messaging is removed product scope.
- Do not add phone fields, carrier provider modules, carrier webhooks, contact-delivery tests, or seeded carrier data.
- Historical carrier references in archived docs or logs are not permission to reintroduce the feature.

Primary local sources:

- `docs/architecture.md`
- `docs/firebase.md`
- `docs/environment.md`
- `AGENTS.md`
