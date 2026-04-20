# Deployment

## Summary

The repo ships two Hosting paths:

- preview Hosting on pull requests, built in mock mode by default
- live Hosting on `main`, built in Firebase mode

## GitHub configuration

Secrets:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT`

Repository variables for live builds:

- `VITE_ALLOWED_EMAILS`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`

## Local deploy commands

Preview-style build and deploy:

```bash
VITE_APP_RUNTIME=mock \
VITE_ENABLE_PWA=false \
VITE_ALLOWED_EMAILS=primary.gardener@example.com,partner.gardener@example.com \
npm run build

firebase hosting:channel:deploy preview --project your-project-id
```

Live-style build and deploy:

```bash
VITE_APP_RUNTIME=firebase \
VITE_ENABLE_PWA=true \
VITE_ALLOWED_EMAILS=primary.gardener@example.com,partner.gardener@example.com \
VITE_FIREBASE_API_KEY=... \
VITE_FIREBASE_APP_ID=... \
VITE_FIREBASE_AUTH_DOMAIN=... \
VITE_FIREBASE_MESSAGING_SENDER_ID=... \
VITE_FIREBASE_PROJECT_ID=... \
VITE_FIREBASE_STORAGE_BUCKET=... \
npm run build

firebase deploy --only hosting,firestore:rules --project your-project-id
```

Rules-only deploy for the configured live project:

```bash
firebase deploy --only firestore:rules --project secret-faeries
```

## Deployment notes

- preview builds are safe-by-default because they use mock runtime unless you intentionally change that policy
- live deploys must never rely on the mock defaults
- live Firebase mode needs both Hosting and Firestore rules deployed
- this repo's `.firebaserc` default points at `secret-faeries`; emulator scripts
  still pass `--project demo-secret-faede` explicitly
- preview URLs are separate Hosting URLs and can still talk to real backend resources if you point them at a live Firebase project
- PWA registration is disabled in preview and CI builds to avoid stale preview caches
