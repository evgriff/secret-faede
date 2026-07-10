# Story: Settings Alert Trust

User story:

As one of the two provisioned gardeners, I need Settings to distinguish shared
garden facts from my private alert consent so weather, watering, and delivery
behavior is explainable and honest.

Route and ownership:

- canonical route: `/app/settings`
- active implementation: `src/v2/routes/settings` with composition in
  `src/v2/app/SettingsRoute.tsx`
- shared location/climate publishes through an authenticated server callable,
  preserves unrelated published plan content, and rebases the actor's draft
- private alert values live in user-profile schema 2 through
  `UserProfileRepository`
- `NotificationService` registers web/native push; `MobileDeviceService`
  reports platform capability; private receipts are read from the signed-in
  user's subcollection

Success criteria:

- identity and shared/private ownership are explicit
- shared values include location label/query, exact coordinate pair, valid
  IANA garden timezone, hardiness zone, and typical frost dates
- both coordinates are required by first-run and Settings; incomplete/migrated
  null coordinates remain a lower-level safe mode and never invoke a default city
- private preferences include alert-kind toggles, daily check time, quiet
  hours, minimum watering deficit, and push consent
- in-app history remains always on; delivery history is private and filterable
- web/native registration is shown active only after a current token exists
- unavailable VAPID/native capability is reported as unsupported/unconfigured,
  not as a successful permission or delivery
- `sent` push history means provider acceptance, not device display
- production VAPID is currently missing; Android lacks its Firebase file and
  iOS lacks a verified FCM-token bridge, so native push is unconfigured
- local-notification capability may be reported, but current v2 routes do not
  claim a separate device-local schedule
- validation focuses the first invalid field, failed saves retain edits, and
  committed is reported only after both active persistence boundaries succeed
- saving the shared plan and private profile does not collapse their
  authorization boundaries; they are not one transaction, so a later profile
  failure does not roll back an already committed shared publication

Trust rules:

- coordinates/timezone are deliberate user data, not environment/demo defaults
- push requires explicit consent and still respects alert kind, watering
  threshold, quiet hours, and stable delivery dedupe
- no public onboarding, notification dashboard, or phone/contact delivery

Primary local sources:

- `docs/architecture.md`
- `docs/environment.md`
- `docs/api-integrations.md`
- `docs/ux-architecture.md`
- `README.md`
