# Deploy runbook

Use this runbook for a v2 production release. `docs/deployment.md` explains the
policy and rollback model; this file is the operator sequence.

## 1. Freeze and identify the release

- Confirm `git status --short --branch` is on `main` and every release change is
  understood.
- Record the current production commit and Firebase project ID.
- Use Node 22, npm 11, Java 21, and a current authenticated Firebase CLI.
- Confirm the two account emails and project/service credentials are available
  through secret environment values; do not print them.

## 2. Verify project configuration

- Run `FIREBASE_PROJECT_ID=<id> npm run setup:firebase:live` when project Auth or
  authorized-domain setup has changed.
- Confirm Email/Password Auth is enabled.
- Confirm Hosting/custom domains appear in authorized domains.
- Confirm the Web app values match the same project and storage bucket.
- Confirm protected `FIREBASE_PROJECT_ID` exactly matches public
  `VITE_FIREBASE_PROJECT_ID`.
- Confirm a Web Push certificate and production VAPID public key exist; the live
  workflow requires the build variable.
- Confirm Android is not advertised while `google-services.json` is absent and
  iOS is not advertised until its shell supplies a real FCM token.
- Confirm the configured production `NWS_USER_AGENT`; the live workflow writes
  it to a mode-`0600` `functions/.env.<project-id>` immediately before deploy.
  Confirm Tomorrow.io server key/enable flag only if that optional provider is
  intentionally active.
- Confirm the deploy service account can deploy Auth claims, Firestore rules and
  indexes, Storage rules, Functions, and Hosting.

## 3. Provision and synchronize access

For first setup, provide both account emails/temp passwords and run:

```sh
FIREBASE_PROJECT_ID=<id> npm run auth:seed-users
```

For every release, provide both account emails and run:

```sh
FIREBASE_PROJECT_ID=<id> npm run auth:sync-access
```

Verify exactly the intended two enabled Auth users carry both
`gardenAccess: true` and `secretFaeriesMember: true`.

## 4. Back up and migrate the workspace

Dry-run first:

```sh
node scripts/migrate-workspace-v2.mjs --project <id>
```

- Verify the 0600 backup under ignored `output/production-backups/`.
- Review proposed writes and all warnings.
- Inspect the migrated plan's dimensions, timezone, coordinates, structures,
  crop groups, instances, water profiles, drafts, profiles, and field history.
- Confirm ambiguous legacy water is not credited.

If the workspace is already current, continue. Otherwise apply explicitly:

```sh
node scripts/migrate-workspace-v2.mjs --project <id> --apply
node scripts/migrate-workspace-v2.mjs --project <id>
```

The second command must report current/idempotent state and no pending writes.

## 5. Run the full release gate

```sh
npm ci
npm --prefix functions ci
npm run ci
```

Do not skip a suite. Resolve formatting, Serena memory, rules, Functions,
browser, visual, and bundle failures before proceeding.

Build once with the exact production `VITE_*` configuration. Open the build and
verify Firebase mode is active with no fallback/migration banner and no console
errors. Check desktop and 320-pixel viewport behavior.

## 6. Publish

Commit only the reviewed release files, push `main`, and monitor both Actions:

- Quality
- Hosting Live

Hosting Live must run (not skip), pass its full CI gate, sync claims, deploy
rules/indexes/Storage/Functions, and finish the live Hosting deployment.

If an explicitly authorized local deploy is required instead:

```sh
FIREBASE_PROJECT_ID=<id> npm run deploy:all
```

Local deployment does not replace the earlier migration or access-claim steps.

## 7. Smoke the live app

In a clean browser session:

- verify the live URL, Firebase runtime, service worker, and console/network
- sign in/out with both accounts; verify denied users cannot enter
- compare shared published Plan/Today/Feed state in both accounts
- verify a private draft and private delivery history remain account-scoped
- verify every active crop group has its own correctly named watering card
- inspect confidence, data quality, reasons, amount/null amount, and deep link
- log applied, partial, and skipped water to separate crop groups; confirm
  partial credits only its explicit amount and skipped gives zero credit after
  operations refresh
- correct a water record and verify the same ID/crop/original recorder,
  revision +1, and replacement rather than duplicated credit
- exercise task completion/defer/snooze, note/issue/harvest/photo, and settings
- verify an alert tap focuses the exact task/crop group
- verify background push on every advertised web/native platform; a provider-
  accepted `sent` receipt alone is not a device-display result
- verify keyboard focus, modals, and 320-pixel navigation

Record the released commit, workflow URLs, Hosting URL, Functions revision,
migration backup path, and smoke result.

## 8. Rollback trigger

Rollback immediately for authorization leakage, corrupt/overwritten plans,
incorrect crop-group water credit, duplicated or unsafe watering alerts,
unusable auth/navigation, or widespread startup failure.

Redeploy the last known-good component versions. Preserve current live data and
the pre-migration backup. Do not weaken rules or blindly restore old JSON over
new field work. Prepare any data restore as a separate reviewed operation.
