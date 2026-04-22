# Manual QA Checklist

Date: 2026-04-21

## sample garden

- Start `npm run dev` in mock mode.
- Sign in with an allowlisted email.
- If first-run setup appears, confirm Detroit defaults, editable frost dates,
  templates, and Blank plan all render.
- Open Settings and click **Load demo garden**.
- Confirm the success message appears and watering check time changes to 7:15
  AM.
- Open Plan and confirm the plot reads 20 ft by 16 ft.
- Open Review mode and confirm warnings include spacing, pathway, sun, trellis,
  and rotation guidance.
- Open Sun/Climate mode and confirm summer shade cells near the pepper starts
  show manual correction.
- Open Plan operations and confirm weather, watering rationale, active
  recommendation, notification history, and succession suggestions are not empty.
- Open Today and confirm due tasks, active watering, harvest-ready crops,
  unresolved issue, and bed attention are populated.
- Use one quick action: add a note, report an issue, or log a harvest. Confirm
  it appears in Feed.
- Open Feed and confirm Journal, Issues, Harvests, Media, and Season sections all
  have meaningful demo content.
- Open Settings and confirm Notification center active/recent counts and
  delivery reasons are populated.
- Change the watering check time, save, click **Reset demo**, and confirm the
  7:15 AM baseline profile and demo data return.

## Plan Workflow

- Open Plan, click **Choose plants**, search for Tomato, add it to the season
  board, edit quantity/priority, and save the list.
- Switch to Optimize, click **Generate layouts**, confirm at least three scored
  candidates appear, and select one.
- Apply the selected proposal to the draft and confirm new plantings/supports
  appear on the canvas with draft state visible.
- Accept one Review proposal and reject or snooze one other proposal.
- Publish the draft, confirm the publish modal summarizes changed items and
  accepted/rejected proposal decisions, then publish.
- Open History, revert to an older revision, and confirm the app lands in the
  restored published state.

## Auth And Persistence

- Reload after loading demo and confirm Plan, Today, Feed, and Settings still show
  demo data.
- Sign out and sign back in with the same mock user; confirm the garden persists.
- Sign in as Primary Gardener on desktop and Partner Gardener on mobile; confirm both account panels show
  the expected display names and emails.
- Sign in with a non-allowlisted email and confirm access denied.

## Offline

- Toggle browser offline.
- Add a text-only Feed entry and confirm **Queued locally** appears.
- Reconnect and keep the tab open until queued state clears.
- Try a photo while offline and confirm the app does not claim it uploaded.

## Notifications

- Open Settings and confirm Notification center shows active count, recent
  count, failed count, filters, status, and decision reason.
- Confirm active alerts are in the Active section, acknowledged/dismissed/snoozed
  alerts move to Recent, and **Open Today**, **Open Plan**, **Open Feed**, or
  **Open Settings** links land on the referenced surface.
- Snooze an active alert for one day and reload; confirm it leaves Active, shows
  snoozed state in Recent, and does not duplicate immediately.
- Acknowledge an active alert and reload; confirm acknowledged state persists.
- Dismiss an active alert and reload; confirm it leaves active alerts but remains
  in recent history.
- Complete a watering recommendation from Today, refresh operations, and confirm
  the same watering alert is not re-created for that target on the same day.
- Toggle each alert type and confirm saves persist.
- Toggle in-app and push channels and confirm consent state updates.
- Change quiet hours, timezone, and daily watering check time; save and reload.
- Enable web push in a supported browser and confirm a token timestamp appears.
- Deny web push in a test browser profile and confirm Settings shows denied
  without blocking the app.
- On a native build with local notifications available, use Today **Not ready**
  on a harvest card and confirm a local harvest-check reminder is scheduled for
  the selected date.

## carrier messaging Scope

- Confirm Settings does not present carrier messaging as an active notification channel.
- Confirm demo setup does not ask for or seed a phone number.
- Confirm no new prompt-chain work adds notification provider secrets, carrier messaging webhooks, or carrier messaging
  smoke steps.

## Regression

- Run `npm run ci`.
- Run `npm run test:visual:update` only when the UI intentionally changed, then
  review the refreshed desktop/mobile screenshots.
- Run `npm run test:visual` and inspect any failures in
  `output/playwright/visual/`.
- Only update visual baselines with `npm run test:visual:update` after manually
  reviewing changed screenshots in `e2e/__screenshots__/`.
- Run `npm run quality:bundle` and confirm
  `output/bundle-analysis/bundle-summary.md` plus the bundle-budget gate stay
  inside budget.
- Run `npm run functions:build`.
- Run `npm run functions:test`.
- Run `SEED_USER_EMAIL=demo@example.com npm run seed:dev -- --dry-run`.
- Confirm Plan and Today still show weather/watering rationale and manual
  override paths.

## Production Release

- Confirm the GitHub `Hosting Live` workflow has `FIREBASE_PROJECT_ID`,
  `FIREBASE_SERVICE_ACCOUNT`, and all required `VITE_*` variables configured.
- Run `npm run auth:seed-users -- --dry-run`, then seed Primary Gardener and Partner Gardener.
- Confirm both Firebase Auth users have `gardenAccess: true` and
  `secretFaedeMember: true`, then have each user sign out and back in so the
  token refreshes.
- Confirm FCM web push registration writes a token document for each production
  user.
- Run `npm run deploy:all` only after the manual Firebase/Auth/domain/FCM
  blockers are cleared.
- After deploy, smoke desktop web with Primary Gardener, mobile web with Partner Gardener, and native
  shell hooks only on devices where local Firebase config files are installed.
