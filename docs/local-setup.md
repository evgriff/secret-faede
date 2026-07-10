# Local Setup

Date: 2026-07-10

## Web And PWA

1. Use Node 22.
2. Run `npm ci`.
3. Run `npm run dev` for mock local development.
4. For Firebase emulator work, run `npm run emulators` in one terminal and
   `npm run dev:firebase:emulators` in another.
5. Keep `.env.local` uncommitted. Start from `.env.local.example` when Firebase
   or provider keys are needed.

## Capacitor Mobile Shell

The native shell wraps the same Vite app. The PWA build remains the source of
truth.

1. Install native tooling:
   - Xcode for iOS simulator/device work.
   - Android Studio plus the Android SDK for Android emulator/device work.
2. Run `npm ci`.
3. Run `npm run mobile:sync`.
4. Open the native project:
   - iOS: `npm run mobile:ios`
   - Android: `npm run mobile:android`
5. Use bundle/package id `com.secretfaeries.app` unless the Apple or Google
   account requires a different final id. If it changes, update
   `capacitor.config.ts`, `ios/App/App.xcodeproj/project.pbxproj`, and
   `android/app/build.gradle` together, then run `npm run mobile:sync`.

## Native Firebase Files

Native Firebase browser/app identifiers are public configuration, but signing
material and provider credentials are not. Current tree state:

- Android: `android/app/google-services.json` is absent; supply the correct file
  through the mobile release process before applying the Google Services plugin
  or claiming Android push.
- iOS: `ios/App/App/GoogleService-Info.plist` is present and included in the app
  target.

Native push will not deliver on real devices until platform Firebase,
FCM/APNs, entitlements, and signing setup are complete. iOS additionally needs a
native FCM-token path; the client intentionally refuses to store a raw APNs
token as though it were FCM.

## Native Features Wired

- Native network status feeds the same honest online/offline status used by the
  PWA; active repositories do not promise a durable offline write queue.
- Native camera capture can attach photos from Today and Feed while preserving
  the existing file input for web/PWA.
- Android native push registration can store a valid FCM token under
  `users/{uid}/pushTokens/{tokenId}` after platform configuration is complete;
  iOS registration is currently unavailable pending an FCM-token bridge.
- Local-notification capability can be reported by Settings, but v2 routes do
  not schedule an independent local-reminder workflow.
- Capacitor Preferences stores only non-secret session hints such as the last
  signed-in user and route.

## Quick Unlock Status

PIN or biometric quick unlock is not enabled yet. The shell is ready for it, but
the secure storage piece must be added first:

1. Choose and document an audited Keychain/Keystore storage plugin or custom
   native module in a new ADR.
2. Add biometric/PIN policy and recovery behavior.
3. Store only a short-lived unlock secret or opaque session convenience token,
   never the user's password.
4. Add tests and native QA for sign-out, account switching, failed unlock, and
   device restore/reinstall behavior.

Until then, Firebase Auth persistence remains the real session mechanism.
