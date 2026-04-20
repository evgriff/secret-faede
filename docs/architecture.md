# Architecture

## Summary

Secret Faede ships a small authenticated garden editor. It proves routing, runtime selection, Firebase email-link auth, allowlist gating, Firestore garden persistence, emulator support, and Hosting deployment without adding broader product scope.

Route map:

- `/`: redirect based on auth and authorization state
- `/sign-in`: request an email sign-in link
- `/auth/complete`: finish same-device or different-device email-link sign-in
- `/access-denied`: show access-denied handling after allowlist rejection
- `/app`: authenticated garden editor
- `*`: not-found fallback

## Runtime and seams

`resolveAppEnvironment()`

- parses `VITE_APP_RUNTIME`
- parses `VITE_USE_FIREBASE_EMULATORS`
- parses `VITE_ENABLE_PWA`
- parses `VITE_ALLOWED_EMAILS`
- parses Firebase web config
- falls back from requested Firebase mode to mock mode when web config is incomplete

`AuthService`

- seam for email-link auth
- implemented by `MockAuthService` and `FirebaseAuthService`
- owns send-link, same-device stored email, completion, current user lookup, subscription, and sign-out

`GardenRepository`

- seam for one garden per user
- implemented by `MockGardenRepository` and `FirebaseGardenRepository`
- exposes `getGarden(userId)` and `saveGarden(garden)`
- uses localStorage in mock mode and Firestore path `gardens/{uid}` in Firebase mode

## Auth and editor flow

1. The sign-in page collects one email address.
2. The service sends a Firebase email-link request or returns a mock completion link.
3. Same-device completion stores the normalized email locally.
4. `/auth/complete` completes sign-in immediately when stored email is available, or prompts for email re-entry on a different device.
5. The auth provider normalizes the signed-in email and compares it against the two-email allowlist from config.
6. Allowed users enter `/app`.
7. Non-allowlisted users are immediately signed out and redirected to `/access-denied`.
8. The garden editor loads `gardens/{uid}` or creates an unsaved default garden in memory.
9. User edits mark the garden dirty; Save writes plot dimensions and plant positions.

Important note:

- the allowlist is an application-level gate
- it is not a true pre-auth hard block
- a future hard-enforcement option is Firebase Auth blocking triggers with Identity Platform

## Garden model

Canonical garden data:

```ts
{
  userId: string,
  plot: {
    widthFt: number,
    depthFt: number,
    gridUnitFt: 1,
    snapUnitFt: 0.5
  },
  plants: [
    {
      id: string,
      type: "plant",
      xFt: number,
      yFt: number
    }
  ]
}
```

- `xFt` is distance from the left plot edge.
- `yFt` is distance from the top plot edge.
- plant position is the plant center.
- pixels are rendering-only and are never saved as source-of-truth position.

## Directory shape

```text
src/
  app/
  features/
    auth/
    garden/
  infrastructure/
    firebase/
    mock/
    runtime/
  shared/
    auth/
    config/
    lib/
    ui/
  styles/
  test/
```

## Styling posture

- CSS Modules for component styles
- CSS custom properties for shared app tokens
- light theme only
- stable pixels-per-foot plot scale with a scrollable viewport
