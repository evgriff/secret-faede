# Manual QA Checklist

Date: 2026-04-21

## sample garden

- Start `npm run dev` in mock mode.
- Sign in with an allowlisted email.
- If first-run setup appears, confirm the primary path only asks for garden
  name, plot type, plot size, and starter layout. Open **Optional location and
  climate** only to confirm Detroit defaults and editable frost dates remain
  available.
- From the shell, confirm **Real garden** is visible, then click **Enter demo**.
  Confirm the shell shows **Demo mode** with **Reset seeded demo** and
  **Exit demo** controls, then returns to the workspace where the command
  started.
- Open Settings and confirm the demo card shows active demo state and watering
  check time changes to 7:15 AM.
- Open Plan and confirm the plot reads 20 ft by 16 ft.
- Open Review mode and confirm the proposal inbox leads with waiting decision
  count, a next safe action, quiet decision metrics, and proposal payoff copy
  instead of a chip-heavy warning wall.
- On the Plan canvas, confirm default plant nodes stay quiet unless there is an
  immediate canvas-level issue; toggle **Checks** to reveal the fuller warning
  context.
- Confirm the global shell reads as passive chrome: one compact topbar status
  group, a quiet user label, low-emphasis **Sign out**, and no duplicated
  default online/cloud badges competing with the route workspace.
- In Review, Today, Feed, and the shell, confirm passive statuses such as
  Online or proposal counts do not look pressable, filters have pressed state,
  and actions such as **Water done**, **Task done**, **Accept**, **Reject**, and
  **Resolve** read as clear buttons with distinct intent.
- Open Sun/Climate mode and confirm summer shade cells near the pepper starts
  show manual correction.
- Open Plan operations and confirm weather, watering rationale, active
  recommendation, notification history, and succession suggestions are not empty.
- Open Today and confirm due tasks, active watering, harvest-ready crops,
  unresolved issue, and bed attention are populated.
- In Today, confirm **Water done**, **Task done**, and crop-stage actions finish
  in one tap. On a harvest-ready card, confirm **Log harvest** immediately logs
  a default field harvest and completes the linked harvest task, while
  opening the dismissible Add Photo sheet. Confirm **Water done** and
  **Task done** do not ask for photos. **Details** remains available for
  quantity, notes, or final-harvest detail.
- Confirm Today's Do Now and field cards are readable outdoors: each card has
  one visually dominant action, passive context does not look pressable, and
  mobile touch targets remain comfortable.
- Open **Field entry**, choose one quick action, and add a note, report an
  issue, or log a harvest. Confirm it appears in Feed.
- Open Feed and confirm Journal, Issues, Harvests, Media, and Season sections all
  have meaningful demo content.
- From Today, use an item-linked **Plan** link and confirm Plan opens with the
  relevant crop or support selected instead of only landing on the route. Use
  an issue task's **Feed** link and confirm the issue card is focused.
- From a Feed issue, watering note, task completion, or harvest memory that
  targets a crop, click the linked target label and confirm the same planting
  is selected in Plan. Whole-garden/publish memories should not show an object
  jump.
- Open **New entry** and confirm **New note**, **New issue**, **New photo
  update**, and **Log harvest** modes are available inside the composer instead
  of as four peer header buttons.
- In **New photo update** and **New issue**, choose a file or use the native
  camera action where available. Confirm the composer shows an image preview,
  file name, and size before save, and that the copy distinguishes the browser
  picker from native camera capture.
- In Feed, confirm photo updates such as **Peas caught the trellis** and
  **Radish harvest before heat** read as title, large central image, and
  caption, while watering, issue, task, publish, and harvest memories remain
  compact.
- In Feed, apply a filter or search that has no results and confirm the empty
  state is short, filter-specific, and does not replace the page with a large
  admin-style panel.
- In Today, choose a date with no watering, harvest, issue, bed-attention, or
  recent activity and confirm the secondary field panels collapse instead of
  showing a stack of empty cards.
- Open Settings and confirm Notification center active/recent counts and
  delivery reasons are populated.
- Change the watering check time, save, click Settings **Reset seeded demo**,
  and confirm the 7:15 AM baseline profile and demo data return.
- Click **Exit demo** and confirm the saved real garden draft is restored.

## Plan Workflow

- Open Plan, click **Choose plants**, search for Tomato, add it to the season
  board, set the plant count, confirm the recommended planting form is selected,
  and save the list. Confirm legacy weighting controls are not visible
  placement controls and no score-like copy appears in the board or compare
  panel.
- Open Add Plant, choose a crop, change the plant count to three, confirm the
  arrangement editor shows three individual plant nodes, adjust spacing, place
  the group, then select it and confirm the inspector can adjust the same
  arrangement without changing the shared crop identity.
- Select a plant and confirm the crop focus card appears without opening the
  full inspector, labels the selection as a preview, highlights all matching
  crop nodes, and summarizes the selected plant, crop count/lifecycle, support,
  sun, warnings, and open tasks. Use **Open details** only when you want the
  full inspector.
- Confirm Plan overlays, crop focus, and bottom sheets follow
  `docs/motion-guidelines.md`: the plot does not resize, motion is short and
  cause-driven, and reduced-motion mode keeps state changes visible without
  transform travel.
- From the crop focus card, toggle **Show influence** and confirm keep-away
  zones appear around the selected crop's individual nodes, modeled shade cells
  appear only when the crop casts shade in the active sun season, and **Hide
  influence** removes the overlay without changing plant coordinates.
- Switch to Optimize, click **Generate layouts**, confirm a guided proposal
  walkthrough opens with strategy choices, before/after preview, support and
  materials, warnings/tradeoffs, and apply/reject/snooze controls.
- Confirm optimizer labels read like practical garden choices, support
  proposals do not land on paths or reserved crop space, and explanations cite
  real constraints rather than raw scores.
- Confirm the selected generated layout paints a proposal diff overlay on the
  plot with proposed additions, movement connectors when relevant, removals,
  support elements, and any introduced warning labels; switching strategies
  should update the overlay without mutating the draft.
- Apply the selected proposal to the draft and confirm new plantings/supports
  appear on the canvas with draft state visible.
- Accept one Review proposal and reject or snooze one other proposal. Confirm
  physical moves are labeled for one-at-a-time review and low-risk support work
  stays batchable only when it does not move plants.
- Use **Show diff** on a Review proposal and confirm the same plot overlay makes
  the proposal understandable before accepting it. Physical moves should require
  this preview before the accept action is available.
- Publish the draft, confirm the publish modal summarizes changed items and
  accepted/rejected proposal decisions, including low-risk support and physical
  move counts, then publish.
- Open History, use **Review revert** on an older revision, accept the
  confirmation prompt, and confirm the app lands in the restored published
  state.

## Auth And Persistence

- Reload after loading demo and confirm Plan, Today, Feed, and Settings still show
  demo data.
- Sign out and sign back in with the same mock user; confirm the garden persists.
- Sign in as Primary Gardener on desktop and Partner Gardener on mobile; confirm both account panels show
  the expected display names and emails.
- Sign in with a non-allowlisted email and confirm access denied.

## Offline

- Toggle browser offline.
- Confirm the shell banner says Plan edits, Today actions, and text Feed entries
  can save locally, while photos need a connection.
- Add a text-only Feed entry and confirm **Queued locally** appears.
- Confirm Feed explains the memory is saved in this browser and will sync when
  connection returns.
- Reconnect and keep the tab open until queued state clears.
- Try a photo while offline and confirm the app does not claim it uploaded.
- In Feed while offline, attach a photo and confirm the preview says selected
  photos stay only in the current form, **Reconnect to upload photos** is
  disabled as the primary save, and **Save text only** records the note without
  pretending the binary was queued.
- In Today, open **Field entry** or the harvest photo follow-up while offline
  and confirm the same preview/caveat appears. Removing the photo should make
  the text field note saveable.

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
- Confirm in-app history is always on, toggle push delivery, and confirm push
  consent state updates after web push registration.
- Change quiet hours, timezone, and daily watering check time; save and reload.
- Enable web push in a supported browser and confirm a token timestamp appears.
- Deny web push in a test browser profile and confirm Settings shows denied
  without blocking the app.
- On a native build with local notifications available, use Today **Not ready**
  on a harvest card and confirm a local harvest-check reminder is scheduled for
  the selected date.

## Carrier Messaging Scope

- Confirm Settings does not present carrier messaging as an active notification
  channel.
- Confirm demo setup does not ask for or seed phone-number delivery data.
- Confirm env examples, Functions exports, Firestore rules, and seed output do
  not add carrier provider secrets, carrier webhooks, carrier event
  collections, or carrier delivery tests.

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
