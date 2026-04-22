# Environment

Date: 2026-04-21

## Browser Environment

- `VITE_APP_RUNTIME`: `mock` or `firebase`.
- `VITE_ALLOWED_EMAILS`: exactly two allowlisted emails.
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_VAPID_KEY`: required for web push registration.
- `VITE_USE_FIREBASE_EMULATORS=true`: routes Firebase clients to emulators.
- `VITE_FIREBASE_AUTH_EMULATOR_PORT`: default `9099`.
- `VITE_FIREBASE_FIRESTORE_EMULATOR_PORT`: default `8080`.
- `VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT`: default `5001`.
- `VITE_FIREBASE_STORAGE_EMULATOR_PORT`: default `9199`.
- `VITE_ENABLE_PWA=false`: disables PWA registration for local debugging.
- `VITE_GOOGLE_MAPS_API_KEY`: optional browser geocoding key.
- `VITE_ENABLE_TOMORROW_WEATHER=true` and `VITE_TOMORROW_API_KEY`: optional
  browser weather enhancement. Prefer server-side Tomorrow.io for production.

## Hosting Workflow Environment

GitHub `Hosting Live` needs these repository secrets or variables in addition
to the browser values above:

- `FIREBASE_PROJECT_ID`: target live project.
- `FIREBASE_SERVICE_ACCOUNT`: deploy service-account JSON for Firebase CLI.

Do not put Functions-only secrets into `VITE_*` workflow variables.

## Functions Environment

- `TOMORROW_API_KEY`: optional server-side Tomorrow.io key.
- `ENABLE_TOMORROW_WEATHER=true` or `TOMORROW_WEATHER_ENABLED=true`: enables
  Tomorrow.io in backend weather generation.
- `NWS_USER_AGENT`: optional identifying User-Agent for NWS requests.
- `NOTIFICATION_DRY_RUN`: defaults to dry-run unless explicitly set to `false`.
- `RETIRED_DELIVERY_PROVIDER_API_KEY`: Functions-only notification provider credential for live carrier messaging fallback.
- `RETIRED_DELIVERY_PROVIDER_FROM_NUMBER`: E.164 notification provider sender number.
- `RETIRED_DELIVERY_PROVIDER_PUBLIC_KEY`: notification provider webhook public key for Ed25519 verification.
- `RETIRED_DELIVERY_PROVIDER_WEBHOOK_URL`: optional per-message delivery callback URL when not
  relying on a Messaging Profile webhook.
- `RETIRED_DELIVERY_PROVIDER_MESSAGING_PROFILE_ID`: optional profile id when the sender needs one.
- `RETIRED_DELIVERY_PROVIDER_VALIDATE_WEBHOOKS=false`: local/emulator-only bypass. Do not use in
  production.
- `RETIRED_DELIVERY_PROVIDER_WEBHOOK_MAX_AGE_SECONDS`: optional replay window override; use `0`
  only for local signature tests.
- `DEFAULT_ALERT_PHONE_E164`: dev/demo phone seed value only. Never commit it.

## Auth Seed Environment

These values are used by `npm run auth:seed-users` and must stay out of browser
build env:

- `APP_LOGIN_PRIMARY_EMAIL`: Primary Gardener's Firebase Auth email.
- `APP_LOGIN_PARTNER_EMAIL`: Partner Gardener's Firebase Auth email.
- `APP_LOGIN_PRIMARY_TEMP_PASSWORD`: initial or reset password for Primary Gardener.
- `APP_LOGIN_PARTNER_TEMP_PASSWORD`: initial or reset password for Partner Gardener.
- `FIREBASE_PROJECT_ID`: target Firebase project for live seeding.

The seed script creates missing users, sets display names, verifies email,
enables the accounts, and grants `gardenAccess: true` plus
`secretFaedeMember: true`. Existing passwords are not changed unless
`-- --reset-passwords` is passed.

## Production carrier messaging Gates

Before setting `NOTIFICATION_DRY_RUN=false`:

- Complete the correct notification provider sender registration path for the production
  sender, including U.S. 10DLC or toll-free verification when required.
- Assign the sender number to a notification provider Messaging Profile.
- Configure inbound and status webhooks to `retiredDeliveryWebhook` and
  `retiredDeliveryStatusWebhook`, or set the profile webhook URL to the shared endpoint
  that routes those events.
- Set `RETIRED_DELIVERY_PROVIDER_PUBLIC_KEY` from the notification provider portal and keep webhook validation
  enabled.
- Confirm Settings consent copy is acceptable for transactional garden
- operations alerts.
- Confirm carrier messaging fallback is enabled only for high-value alerts and only after
  push registration has been tested.
- Run a dry-run seed and a live smoke test with a controlled allowlisted phone.

## Secret Handling

- Browser `VITE_*` values are public by design.
- notification provider credentials, Tomorrow.io server key, auth seed passwords, and demo
  phone belong only in Functions environment/secrets or local uncommitted env.
- The app stores redacted recipients in notification logs; raw phone numbers
  live only on the user profile and carrier messaging provider side.
- Native Firebase files stay local or in the native build secret system:
  `ios/App/App/GoogleService-Info.plist` and
  `android/app/google-services.json` are not browser env and must not be
  committed unless the project explicitly chooses to commit non-secret config.
