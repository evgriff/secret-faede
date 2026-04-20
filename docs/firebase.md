# Firebase

## What this milestone uses

- Firebase Authentication
- Firestore
- Firebase Hosting
- Firebase Local Emulator Suite

Not included now:

- Cloud Functions
- blocking triggers

## Required web-app setup

1. Create or choose a Firebase project.
2. Register a web app in that project.
3. Copy the Firebase web config values into `.env.local` or GitHub repository variables.
4. Enable Authentication.
5. Enable `Email/Password`.
6. Enable `Email link (passwordless sign-in)`.
7. Add authorized domains for every environment that will complete the sign-in link.

Important:

- email-link auth for web requires `handleCodeInApp: true`
- the app completes the sign-in flow at `/auth/complete`
- do not put the user email in URL params
- in Firebase projects created after April 28, 2025, `localhost` is not added automatically; add it yourself

## Authorized domains checklist

Add these as needed:

- `localhost`
- `127.0.0.1`
- your Firebase Hosting domain: `your-project.firebaseapp.com`
- your Firebase Hosting site domain: `your-project.web.app`
- any custom production domain

Preview caution:

- Firebase Hosting preview channels use separate preview URLs
- those preview deployments still talk to real backend resources if you point them at a live Firebase project
- this repo keeps preview builds mock-first by default, so preview auth should not be assumed to work unless you intentionally reconfigure it

## Environment variables

Required runtime variables:

```bash
VITE_ALLOWED_EMAILS=primary.gardener@example.com,partner.gardener@example.com
VITE_APP_RUNTIME=mock|firebase
VITE_ENABLE_PWA=true|false
VITE_USE_FIREBASE_EMULATORS=true|false
```

Firebase web config values for `firebase` runtime:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_EMULATOR_HOST=127.0.0.1
VITE_FIREBASE_AUTH_EMULATOR_PORT=9099
VITE_FIREBASE_FIRESTORE_EMULATOR_PORT=8080
```

`VITE_ALLOWED_EMAILS` rules:

- exactly two entries
- normalized to lowercase and trimmed before comparison
- duplicates after normalization are invalid
- invalid allowlist config fails closed with a visible UI error

## Runtime switching

Mock mode:

- `npm run dev`
- no Firebase config required

Firebase emulator mode:

- copy `.env.local.example` to `.env.local`
- keep `VITE_APP_RUNTIME=firebase`
- keep `VITE_USE_FIREBASE_EMULATORS=true`
- run `npm run emulators`
- run `npm run dev:firebase:emulators`

Firebase live mode:

- set `VITE_APP_RUNTIME=firebase`
- set `VITE_USE_FIREBASE_EMULATORS=false`
- provide all `VITE_FIREBASE_*` values
- run `npm run dev`

If Firebase mode is requested without complete web config, the app falls back to mock mode and tells the user why.

## Firestore garden document

Firebase mode stores one garden per authenticated user:

```text
gardens/{uid}
```

Document shape:

```ts
{
  userId: string,
  updatedAt: serverTimestamp(),
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

Rules allow only `primary.gardener@example.com` and `partner.gardener@example.com` to read and write their own `gardens/{uid}` document.

## Live setup helper

`npm run setup:firebase:live`

This script does one thing only:

- enables Email/Password plus Email link sign-in
- patches authorized domains for the supplied `FIREBASE_PROJECT_ID`

Optional:

- set `FIREBASE_AUTH_DOMAINS=example.com,preview.example.com` to append additional domains

## Allowlist limitation

The two-email allowlist is enough for the MVP, but it is not a hard pre-auth restriction. Unauthorized users can still complete Firebase sign-in and are then immediately signed out by the app.

Future hard enforcement option:

- Firebase Auth blocking triggers with Identity Platform

That option is intentionally not implemented in this milestone.
