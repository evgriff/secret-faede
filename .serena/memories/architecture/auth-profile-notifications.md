# Auth Profile Notifications

Auth model:

- Firebase email/password auth stays behind `AuthService`.
- There is no public sign-up route.
- The app-level allowlist gates the two provisioned email addresses after sign-in.
- Non-allowlisted users are signed out and routed to `/access-denied`.
- Production data protection relies on Firestore and Storage rules with Firebase Auth custom claims, not only the browser allowlist.

Profile model:

- `UserProfileRepository` owns alert defaults and notification preferences at `users/{uid}`.
- Settings is the user-facing surface for quiet hours, check time, thresholds, location, timezone, and consent state.

Notification model:

- `NotificationService` owns web/native push registration and foreground handling.
- FCM web and Capacitor native push tokens are stored under `users/{uid}/pushTokens/{tokenId}`.
- Scheduled delivery stays server-side in Firebase Functions.
- In-app history remains available even when push is not enabled.
- Native/local alerts are additive through `MobileDeviceService` and must not break the PWA path.

Removed scope:

- Carrier messaging is removed product scope.
- Do not add phone fields, carrier provider modules, carrier webhooks, contact-delivery tests, or seeded carrier data.
- Historical carrier references in archived docs or logs are not permission to reintroduce the feature.

Primary local sources:

- `docs/architecture.md`
- `docs/firebase.md`
- `docs/architecture.md`
- `AGENTS.md`
