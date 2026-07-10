# Auth, Profiles, And Notifications

Auth contract:

- `AuthService` is the only client identity boundary.
- There is no public registration route; exactly two provisioned accounts use
  password authentication.
- Mock mode requires exactly two addresses in the local allowlist. Firebase
  mode ignores that allowlist for authorization and requires both
  `gardenAccess: true` and `secretFaeriesMember: true` ID-token claims.
- The Firebase adapter subscribes to ID-token changes. Missing access signs the
  session out and routes to `/access-denied` before private workspace content
  renders.
- Firestore and Storage rules repeat the two-claim check; browser state never
  grants production data access.

Profile contract:

- `UserProfileRepository` exclusively owns private `users/{uid}` profile data.
- User-profile schema 2 stores identity display/email, valid IANA timezone, and
  notification preferences: five alert-kind toggles, daily check time, minimum
  watering deficit, push consent, and quiet hours.
- Firebase mode treats a missing/invalid/wrong-owner profile as an explicit
  error. The production migration/provisioning path must create valid profiles;
  Functions do not silently invent a city or profile.
- New mock profiles use the device timezone when valid, otherwise `UTC`.
- Shared garden location/climate lives in the plan; private notification
  timezone and consent live in the profile.

Notification contract:

- Canonical alerts live under `gardenWorkspaces/main/alerts/{alertId}`; private
  receipts live under `users/{uid}/notificationDeliveries/{deliveryId}`.
- FCM web/native tokens live at `users/{uid}/pushTokens/{tokenId}` and include
  platform/freshness state.
- Functions fan out only to enabled Auth users carrying both claims, always
  record in-app history, and independently apply alert-kind settings, watering
  threshold, push consent, timezone, and quiet hours.
- Quiet-hour push is deferred to the exact local end time. Stable alert and
  delivery IDs make retries idempotent; invalid tokens are removed and
  transient failures are retried with bounded attempts.
- Web push is data-only and the service worker owns background display/click;
  native push is notification-plus-data. Foreground events use one in-app
  banner path to avoid duplicate system UI.
- A push receipt with status `sent` records provider acceptance only. Settings
  says **Sent to push service** and never treats that as proof of device display
  or user receipt.
- Watering push is possible only for an actionable, due, positive crop-group
  recommendation with adequate evidence. Missing coordinates produce safe soil
  checks and no automatic weather/watering push.
- Native local-notification capability is exposed by `MobileDeviceService`,
  but current v2 routes do not create a separate local-reminder schedule.
- Production web push is blocked until the VAPID build variable is configured.
  Android lacks `google-services.json`; iOS has its plist but still needs a real
  FCM-token bridge. Native push is therefore unconfigured on both release
  targets until physical-device verification succeeds.

Removed scope:

- Carrier messaging is explicitly excluded. Never add phone/contact fields,
  carrier providers, webhooks, seed data, delivery fallbacks, or tests.

Primary local sources:

- `docs/architecture.md`
- `docs/firebase.md`
- `docs/environment.md`
- `docs/api-integrations.md`
- `AGENTS.md`
