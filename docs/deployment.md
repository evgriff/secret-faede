# Deployment

Date: 2026-04-21

## Summary

The repo ships two Hosting paths:

- preview Hosting on pull requests, built in mock mode by default
- live Hosting on `main`, built in Firebase mode after the full release gate

The production runbook is the source of truth for manual steps:
`docs/deploy-runbook.md`.

## GitHub configuration

Secrets:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT`

Repository variables for live builds:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_VAPID_KEY`

Production environment secrets for live access sync:

- `APP_LOGIN_PRIMARY_EMAIL`
- `APP_LOGIN_PARTNER_EMAIL`

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
export FIREBASE_PROJECT_ID=your-project-id
npm run ci
npm run deploy:rules
npm run deploy:functions
npm run deploy:hosting
```

One-shot live deploy:

```bash
export FIREBASE_PROJECT_ID=your-project-id
npm run deploy:all
```

## Deployment notes

- preview builds are safe-by-default because they use mock runtime unless you intentionally change that policy
- live deploys must never rely on the mock defaults
- production membership emails must stay in secure `APP_LOGIN_*` environment
  values, not browser `VITE_*` variables
- live Firebase mode needs Hosting, Firestore rules/indexes, Storage rules, and
  Functions deployed together for production smoke testing
- this repo's `.firebaserc` default points at `secret-faeries`; emulator scripts
  still pass `--project demo-secret-faeries` explicitly
- preview URLs are separate Hosting URLs and can still talk to real backend resources if you point them at a live Firebase project
- PWA registration is disabled in preview and CI builds to avoid stale preview caches
- seed Primary Gardener and Partner Gardener with `npm run auth:seed-users`
  before a live demo, run `npm run auth:sync-access`, then
  run `npm run seed:dev` for a populated Detroit demo account if needed
- carrier messaging is not part of the deploy path for the current product
  chain
