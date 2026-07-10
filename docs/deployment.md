# Deployment

## Go/no-go rule

Deploy only when all of these are true:

1. the reviewed backup-first production migration has been applied and its
   follow-up dry run reports schema 2/plan 9 with zero pending writes
2. `npm run ci` passes from a clean release candidate on Node 22
3. the production build contains complete Firebase configuration
4. protected `FIREBASE_PROJECT_ID` equals public `VITE_FIREBASE_PROJECT_ID`, and
   an identifying `NWS_USER_AGENT` is configured for Functions
5. both provisioned Auth users exist and access claims are synchronized
6. Firestore/Storage rules and Functions tests pass
7. manual desktop/mobile browser checks pass with no unexplained console errors
8. the production VAPID key is configured and web push is device-tested
9. every advertised native target has complete Firebase/token/signing setup and
   a physical-device smoke result
10. rollback artifacts and the production migration backup are retained

If any condition is unknown, the app is not ready to deploy. A successful Vite
build alone is not release evidence.

## Production configuration

GitHub production secrets:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT`
- `APP_LOGIN_PRIMARY_EMAIL`
- `APP_LOGIN_PARTNER_EMAIL`

GitHub production variables:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_VAPID_KEY`
- `NWS_USER_AGENT`

The live workflow sets `VITE_APP_RUNTIME=firebase` and `VITE_ENABLE_PWA=true`
and fails validation without the VAPID variable. The current production
environment must add that value before a live run can be release evidence.
Membership emails stay in secrets and are not exposed as Vite build variables.
The workflow also requires `NWS_USER_AGENT`, asserts the secret project ID equals
the public Vite project ID, and writes a mode-`0600`
`functions/.env.<project-id>` containing the NWS identity immediately before the
Functions deploy. The production NWS variable is configured and remains a
required release check.

The deploy service account needs only the Firebase/Auth/Functions/Hosting access
used by the workflow. Store its JSON as one GitHub secret; never commit it.

## Pre-deploy migration

Migration is intentionally outside automatic deployment. With an authenticated
Firebase CLI:

```sh
node scripts/migrate-workspace-v2.mjs --project <project-id>
```

Confirm:

- the reported project is the intended live project
- the ignored backup exists under `output/production-backups` and is mode 0600
- the report is a dry run
- every ambiguity warning is understood
- the proposed published plan/drafts/profiles match the real workspace
- unassigned legacy water is not credited to an arbitrary crop group

Apply only after review:

```sh
node scripts/migrate-workspace-v2.mjs --project <project-id> --apply
```

Run the dry run again. It must report the workspace as current with zero writes.
Keep the backup off-repository until the release/rollback window closes.

Current release evidence (2026-07-10): the live dry run completed without
writes, created a mode-`0600` backup, proposed zero actions, and reported
`canApply: false` with 105 redacted geometry blockers. The legacy published
plan, two drafts, and retained revisions contain plantings with no bed/container
to assign as a growing area; some also have out-of-footprint instances or a
footprint outside the plot. Correct and review those real plan sources before
running `--apply`; the migrator will not invent a bed or discard geometry.

## Local release gate

```sh
npm ci
npm --prefix functions ci
npm run ci
```

Then build once with the exact production environment and verify that Firebase
mode is selected without a fallback notice. Do not print secret environment
values into terminal logs.

Synchronize access claims before smoke testing:

```sh
npm run auth:sync-access
```

Existing browser sessions may need sign-out/sign-in or an ID-token refresh after
claims change.

## Deploy paths

Preferred path: commit and push the reviewed release to `main`. The Hosting Live
workflow then:

1. validates required configuration
2. installs Node/Java/dependencies/Chromium
3. runs `npm run ci`
4. authenticates the Firebase CLI service account
5. synchronizes the two account claims
6. deploys Firestore rules/indexes, Storage rules, and Functions
7. deploys the Hosting live channel

Inspect the workflow to completion. A skipped workflow or a passed Quality job
without a passed Hosting Live job is not a live deploy.

For an intentional local deploy with suitable credentials:

```sh
FIREBASE_PROJECT_ID=<project-id> npm run deploy:all
```

`deploy:all` reruns the complete gate, then deploys rules/indexes/Storage,
Functions, and Hosting. It does not run migration or synchronize claims, so those
remain explicit prerequisites.

Component deploys exist for incident response:

```sh
npm run deploy:rules
npm run deploy:functions
npm run deploy:hosting
```

Do not use a component deploy to bypass a failed aggregate gate unless actively
rolling back a production incident and documenting the exception.

## Post-deploy smoke

Use the live Hosting URL in a clean browser profile:

1. confirm no mock/fallback notice and no console/network boot errors
2. sign in as the primary account, then as the partner account
3. confirm shared published Plan and shared operations match
4. create a private draft in one account and verify the other cannot see it
5. verify one crop-group watering card per active group, exact crop labels,
   stage/stage source, profile/weather provenance, confidence/reasons, and no
   pooled recommendation
6. log applied water for one crop group, partial water for another, and skipped
   water where appropriate; refresh operations and verify exact partial credit
   and structural zero credit for skip
7. complete/defer a task and verify Feed/Today agree
8. add a note and an allowed photo, then verify the shared Feed object
9. edit/save profile settings and verify they remain private to that user
10. correct a water record; verify the same ID/crop/recorder, revision +1, and
    replaced ledger credit in Feed/Today
11. inspect private notification history and exact alert deep links; treat
    `sent` as provider acceptance, not proof of device display
12. verify 320-pixel navigation/forms/modals and keyboard focus
13. test background notification receipt/tap on each advertised platform

Do not create disposable production records unless the two gardeners have agreed
to them; use reversible records and remove only those created for the smoke test.

## Rollback

For a client-only regression, redeploy the last known-good Hosting release.
For Functions/rules regressions, deploy the last known-good repository revision
of those components. Do not weaken rules as a workaround.

If the v2 migration caused a data incident:

1. stop further writes by rolling Hosting back or taking the app offline
2. retain all current documents for incident analysis
3. compare them with the mode-0600 pre-migration backup
4. prepare a reviewed restore plan; do not blindly replay JSON over newer field
   work
5. restore only with explicit owner approval and an auditable command log

Because publish, operations, and water applications may have changed after
migration, rollback is not automatically lossless. This is why migration and
deployment are separate gates.
