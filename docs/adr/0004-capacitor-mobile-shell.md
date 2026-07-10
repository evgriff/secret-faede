# ADR 0004: Capacitor Mobile Shell

Date: 2026-04-21

## Status

Accepted

## Context

Secret Faeries is already a field-oriented PWA, but browser APIs alone do not
cover the native phone behaviors needed for real garden use: app-store shells,
native push registration, local notifications, native camera capture, native
network status, and platform storage hooks for future quick unlock.

The existing web/PWA must keep working. Native support should land as a thin
shell around the current React app, not as a second product architecture.

## Decision

Adopt Capacitor as the mobile shell layer and keep domain persistence in the
existing seams:

- `@capacitor/core` and `@capacitor/cli` provide the shell runtime and sync
  workflow.
- `@capacitor/ios` and `@capacitor/android` generate native project shells.
- `@capacitor/push-notifications` adds native push registration hooks.
- `@capacitor/local-notifications` adds device-local reminder hooks.
- `@capacitor/camera` adds native camera/photo capture for field entries.
- `@capacitor/network` adds native network status for sync state.
- `@capacitor/preferences` stores non-secret session convenience hints only.

Firebase Auth remains the real session owner. Secret Faeries will not store
passwords, refresh tokens, or Firebase credentials in Capacitor Preferences.
Full PIN/biometric quick unlock still requires an audited Keychain/Keystore
plugin or custom native code before secrets can be stored locally.

## Consequences

- The app can ship native iOS and Android shells while preserving the PWA build.
- Native integrations stay behind service seams, so desktop web does not import
  platform-only behavior directly.
- Native push still needs Apple/Google/Firebase entitlements and config files
  before real device delivery works.
- Current implementation status is deliberately unconfigured: Android lacks
  `google-services.json`, while iOS has its plist but still needs a native FCM-
  token bridge because an APNs token is not registered as FCM.
- The generated native directories become part of the repository and must be
  synced after web build changes with `npm run mobile:sync`.
- If Capacitor is removed later, delete the native directories, Capacitor config,
  mobile scripts, and the native service implementations without touching the
  garden data model.
