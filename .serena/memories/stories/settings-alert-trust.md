# Story: Settings Alert Trust

User story:

As one of the two provisioned users, I need Settings to make identity, location, climate defaults, notification consent, quiet hours, and provider behavior explicit so alerts and recommendations stay trustworthy.

Route and workflow:

- primary route: `/app/settings`
- Settings owns alert defaults, delivery preferences, location/timezone edits, provider toggles, and sample garden controls

Success criteria:

- notification consent and delivery channels are explicit
- in-app history is always available
- web/native push registration and native/local support stay behind platform capability checks
- location, timezone, frost dates, watering check time, quiet hours, and thresholds are editable
- sample garden controls are tucked into Settings and do not dominate shell chrome
- sample reset restores the seeded Detroit baseline without damaging the user's saved real garden

Implementation ownership:

- `src/features/settings`: preferences UI, notification center, demo/sample controls
- `UserProfileRepository`: alert defaults and notification preferences
- `NotificationService`: push registration and foreground handling
- `MobileDeviceService`: native network, camera, and local notification support

Off-scope traps:

- no public onboarding funnel
- no phone carrier messaging
- no dashboard-style notification command center

Primary local sources:

- `docs/architecture.md`
- `docs/demo-script.md`
- `docs/manual-qa-checklist.md`
- `docs/architecture.md`
