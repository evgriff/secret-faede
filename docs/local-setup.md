# Local Setup

Date: 2026-04-21

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

Do not commit native Firebase config files. They are ignored by `.gitignore`.

- Android: place `google-services.json` at `android/app/google-services.json`.
- iOS: place `GoogleService-Info.plist` at
  `ios/App/App/GoogleService-Info.plist` and add it to the iOS app target in
  Xcode.

Native push will not deliver on real devices until those files and the Firebase
Cloud Messaging/APNs setup are complete.

## Native Features Wired

- Native network status feeds the same online/offline and queued-sync UI used
  by the PWA.
- Native camera capture can attach photos from Today and Feed while preserving
  the existing file input for web/PWA.
- Native push registration stores device tokens under
  `users/{uid}/pushTokens/{tokenId}` with a native platform label.
- Local notifications can be permissioned and test-scheduled from Settings in
  the native shell.
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
