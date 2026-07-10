# Environment

Date: 2026-07-09

Secret Faeries has two browser runtimes: mock for local development and tests,
and Firebase for the shared production workspace. Environment values select
adapters; they must never contain garden data, persisted recommendations, or a
fallback location.

## Browser runtime

`VITE_APP_RUNTIME` accepts `mock` or `firebase`.

- `mock` uses the two-address `VITE_ALLOWED_EMAILS` allowlist, password
  `password`, and localStorage-backed v2 repositories.
- `firebase` uses Firebase Email/Password Auth and the
  `gardenAccess: true` plus `secretFaeriesMember: true` ID-token claims. The
  browser allowlist does not grant production access.
- requesting Firebase without every required web-app value visibly falls back
  to mock mode; an unsupported or corrupt production workspace never does.

Required for Firebase browser mode:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`

Optional browser settings for local or non-push builds:

- `VITE_ALLOWED_EMAILS`: exactly two distinct valid addresses for mock mode.
- `VITE_FIREBASE_MESSAGING_VAPID_KEY`: public VAPID key. Firebase mode can run
  without it, but web push registration remains unavailable. The production
  Hosting workflow requires it because production advertises web push.
- `VITE_ENABLE_PWA`: service-worker registration is enabled unless set to
  `false`.
- `VITE_USE_FIREBASE_EMULATORS`: set to `true` to connect Firebase adapters to
  the local emulators.
- `VITE_FIREBASE_EMULATOR_HOST`: defaults to `127.0.0.1`.
- `VITE_FIREBASE_AUTH_EMULATOR_PORT`: defaults to `9099`.
- `VITE_FIREBASE_FIRESTORE_EMULATOR_PORT`: defaults to `8080`.
- `VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT`: defaults to `5001`.
- `VITE_FIREBASE_STORAGE_EMULATOR_PORT`: defaults to `9199`.
- `VITE_ENABLE_TOMORROW_WEATHER` and `VITE_TOMORROW_API_KEY`: optional browser
  weather-adapter enhancement. Production operation output remains canonical
  in Functions.

Use `.env.local.example` only as a local template. All `VITE_*` values are
public browser configuration; do not put account passwords, service-account
JSON, private provider secrets, or production membership addresses in them.

## Garden location and time

Location is application data, not environment configuration. New plan storage
starts incomplete with no coordinates and `UTC`, but first-run setup cannot be
completed until the gardener supplies a location label/query, exact valid
latitude/longitude, an IANA timezone, hardiness zone, and typical frost dates.
Settings applies the same coordinate requirement. New profiles use the device
timezone when it is valid, otherwise `UTC`.

There is deliberately no default-city fallback. Without valid saved
coordinates, Functions still generate non-weather tasks and a separate safe
soil-check recommendation for every active crop group, but they do not invent
weather-derived amounts or send watering/weather push.

## Functions runtime

The canonical operations worker requires in production:

- `NWS_USER_AGENT`: identifying User-Agent for National Weather Service calls.

Optional Functions configuration:

- `ENABLE_TOMORROW_WEATHER=true` or `TOMORROW_WEATHER_ENABLED=true`: opt into
  Tomorrow.io enhancement.
- `TOMORROW_API_KEY`: server-only Tomorrow.io credential required by that
  opt-in.

Do not expose the server Tomorrow.io key as `VITE_TOMORROW_API_KEY` in a
production build unless a separately restricted public browser key is
intentionally configured.

## Provisioning, migration, and deployment

Administrative scripts use non-browser environment values:

- `FIREBASE_PROJECT_ID`: target project for Auth provisioning, migration, and
  deploy commands.
- `APP_LOGIN_PRIMARY_EMAIL` and `APP_LOGIN_PARTNER_EMAIL`: the two provisioned
  production identities.
- `APP_LOGIN_PRIMARY_TEMP_PASSWORD` and
  `APP_LOGIN_PARTNER_TEMP_PASSWORD`: initial/reset credentials used only by the
  explicit Auth seed workflow.
- `GOOGLE_APPLICATION_CREDENTIALS`, ADC, or Firebase CLI login as required by
  the selected administrative command.

The live GitHub workflow requires `FIREBASE_PROJECT_ID` and
`FIREBASE_SERVICE_ACCOUNT`, the six required Firebase browser variables, and
the two secure `APP_LOGIN_*_EMAIL` values. It also requires
`VITE_FIREBASE_MESSAGING_VAPID_KEY` and `NWS_USER_AGENT`. The NWS identity is
configured; the VAPID value remains missing. The workflow fails if protected
`FIREBASE_PROJECT_ID` differs from public `VITE_FIREBASE_PROJECT_ID`. Before
Functions deploy, it writes a mode-`0600` `functions/.env.<project-id>`
containing only the NWS identity. Functions-only secrets must not be copied into
`VITE_*` workflow variables.

## Native configuration

Native Firebase configuration is supplied by the native build system:

- `ios/App/App/GoogleService-Info.plist`
- `android/app/google-services.json`

The iOS plist is present in the current app target; the Android
`google-services.json` is absent. APNs credentials and release signing material
stay outside the repository. iOS push also remains unconfigured until the shell
can expose an FCM token rather than a raw APNs token. The v2 client reports
native camera, network, local-notification, and push capabilities only when the
Capacitor shell exposes them.

## Excluded integration

Carrier messaging is removed product scope. Do not add phone fields,
carrier-provider secrets, webhooks, seed data, test fixtures, or delivery
fallbacks. Supported alert surfaces are in-app history and web/native push;
device-local notification capability remains a native-only adapter concern.
