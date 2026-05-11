# Testing Plan

Date: 2026-04-21

## Required Verification

Run before finishing implementation prompts:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run test:rules`
- `npm run functions:build`
- `npm run functions:test`
- `npm run test:e2e`
- `npm run test:visual`
- `npm run build`
- `node scripts/analyze-bundle.mjs`
- `npm run quality:bundle-budget`
- `npm run ci`

Run when Functions, notifications, or scheduled behavior changes:

- `npm run functions:build`
- `npm run functions:test`

Run when Firestore or Storage rules change:

- `npm run test:rules`

Run when seed data, crop catalog, or demo defaults change:

- `SEED_USER_EMAIL=<allowlisted email> npm run seed:dev -- --dry-run`

Run when shared motion, overlay choreography, or reduced-motion behavior
changes:

- `npm run test:e2e`
- `npm run test:visual`
- a reduced-motion browser smoke for the affected overlay/selection flow; the
  current redesign regression suite covers a Today quick-action sheet and Feed
  composer under `prefers-reduced-motion: reduce`

## Current Coverage

- Unit tests explicitly cover geometry conversion, eighth-foot snap logic,
  optimizer fixtures, footprint-wide sun scoring, path/support clearance, review
  suggestion generation, watering recommendations, and draft/publish/revert
  behavior.
- Unit tests cover env parsing, allowlist, auth, repositories, pending offline
  saves, pending-sync conflict metadata, schema migration helpers, validation,
  garden math, precision Plan interaction geometry, planning warnings,
  sun/shade, watering, weather cache, notifications, tasks, journal summaries,
  routing, and page behavior.
- Plan page tests cover crop placement, arrangement plantings rendered as
  individual selectable nodes, quantity-first Add Plant creation, arrangement
  editor node-count and spacing updates, crop focus Plant/Crop/Needs summaries,
  structure placement, Review-mode warning visibility, Review accept/reject
  decisions in the publish confirmation, Choose Plants save/clear/search
  behavior, planning-tradeoff comparison without metric copy, absence of
  visible legacy weighting placement controls, sun
  recalculation/manual override, weather watering recommendations, plot
  resizing, selected saved plants, duplicate/delete/lock flows, lifecycle state
  changes, shift multi-select, group nudge, group duplicate/delete, undo/redo,
  and first-run blank setup.
- Domain tests cover starter template generation, crop suitability scoring, and
  crop catalog completeness/provenance flags.
- Sample garden tests cover the Detroit demo builder, active warning content,
  operations data, Feed examples, notification history, and no seeded phone.
- Planning-domain tests cover spacing, pathway conflicts, sun mismatch,
  container fit, trellis warnings, timeline-aware succession occupancy,
  saved-history rotation cautions, warning taxonomy, and decision-category
  summaries.
- Task-domain tests cover approving a succession recommendation into a real
  future planned planting.
- Today-domain tests cover water done, issue follow-up task creation, issue
  resolution, harvest not-ready delays, native/local harvest reminders,
  one-tap harvest logging with linked task completion, harvest lifecycle
  updates, and crop stage changes from the field view.
- Today route tests cover manual task entry, issue-to-task creation from the
  field quick action sheet, one-tap harvest logging from a harvest-ready card,
  contextual harvest-photo prompting, Do Now action semantics without duplicate
  action badges, no photo prompt after watering, crop stage updates that
  record recent activity, and task/feed cross-links that open Plan with the
  relevant planting selected.
- Feed-domain tests cover journal filtering, target scoping, issue-status
  filtering, photo-entry selection, linked issue tasks, issue timeline
  derivation, harvest filtering, season harvest totals, yield by crop and bed,
  starts-versus-harvest signals, rough value proxy math, issue lifecycle counts,
  water alert acknowledgement, and media attachment counts.
- Feed browser smoke coverage verifies the demo photo update keeps title-first
  hierarchy and renders the attached image as a large central memory.
- Backend operations tests cover per-user local watering check windows,
  backend-generated watering recommendations, soil/drainage/manual-log inputs,
  heat tasks, succession review tasks, and preservation of completed
  recommendation state.
- Playwright smoke tests cover mock sign-in, allowlist denial, Plan add/save,
  first-run setup, plot sizing, large-plot scroll containment, stable canvas
  controls while the plot viewport scrolls, explicit Fit/100% zoom states,
  mini-map expand/collapse, eighth-foot drag settling, multi-select, corner
  snapping, persistence across reload, sample garden loading across
  Plan/Today/Feed/Settings, sample garden reset back to the canonical profile,
  and Feed composer draft safety plus offline text-save queued state.
- Critical Playwright smoke now also covers the Plan workflow from Choose
  Plants through optimizer proposal generation, walkthrough snooze/reject/apply
  decisions, publishing, opening revision history, and reverting to the initial
  published revision.
- Plan interaction smoke includes a reduced-motion path for Add Plant, crop
  focus, influence overlay, and inspector entry while asserting the plot viewport
  width stays stable; mobile Plan smoke now asserts the plot viewport remains
  first-screen dominant, the HUD stays compact, touch launchers remain large
  enough, and bottom sheets do not cover too much of the phone viewport.
- Redesign regression smoke covers Prompt 42 guardrails directly: Add Plant stays
  quantity-first, creates individual plant nodes, and keeps the desktop plot
  width stable; generated layouts open the walkthrough and plot diff without
  removed scoring copy; Feed uses one **New entry** launcher with explicit
  private memory modes; and shell demo controls stay discoverable without
  carrier-message scope.
- Firebase adapter integration tests cover email/password auth persistence,
  password reset/sign-out calls, user-profile notification preference
  persistence, push-first channel preferences, scoped Storage photo uploads,
  and mockable FCM web token registration.
- Functions tests cover notification logic, quiet hours, and consent checks.
- Rules tests run against the Firebase emulators and cover custom-claim
  authorization, owner-only garden/user access, read-only catalog access, scoped
  garden subcollections, journal image-only Storage writes, and cross-user
  denial.
- Visual regression baselines cover `auth`, `plan`, `today`, `feed`,
  `settings`, `choose-plants`, `optimize-results`, and `review-queue` on
  desktop and mobile. Baselines live in `e2e/__screenshots__/`; generated
  traces and diffs live under `output/playwright/visual/`.
- Plan desktop/mobile visual baselines now assert the contained plot viewport,
  stable overlay controls, default-hidden mini-map affordance, and fully visible
  mobile bottom toolbar.

## Anti-Slop Gates

- `npm run quality:deps` fails when a new production dependency is added without
  a matching ADR entry.
- `npm run quality:files` reports oversized source files and requires an
  architecture note for intentionally large files.
- `node scripts/analyze-bundle.mjs` writes
  `output/bundle-analysis/bundle-summary.{json,md}` after each production
  build.
- `npm run quality:bundle-budget` fails if total gzip, initial JavaScript,
  app-entry JavaScript, or the Plan route exceed the current budgets. It also
  fails if Firebase, Capacitor, or the offline crop catalog are accidentally
  preloaded by `index.html`.
- `npm run ci` now runs format check, dependency ADR guard, oversized-file
  guard, lint, typecheck, unit tests, Firebase adapter integration tests,
  emulator-backed rules tests, Functions syntax/tests, build, bundle analysis,
  bundle budget, critical Playwright E2E, and visual regression.

## P0 Test Gaps

- Canonical IA labels are covered by the critical route smoke path; add a
  smaller shell-only unit assertion if the navigation component is split again.
- Plan editor now has direct geometry coverage for snap/resize and browser
  coverage for drag settling plus mobile Plan panel ergonomics, but still needs
  real-device touch QA for handle size, pan/drag thresholds, and outdoor
  readability.
- First-run setup needs Firebase-mode coverage for profile sync and live
  geocoding behavior when `VITE_GOOGLE_MAPS_API_KEY` is present.
- Suitability scoring needs broader fixtures by climate region and date window
  before it can be treated as agronomic advice.
- Rotation guidance is based only on saved planting and harvest history; it
  needs multi-season fixtures before being positioned as disease prediction.
- Companion/antagonist rules are intentionally not enforced yet because the
  current curated data is too weak to avoid folklore-like advice.
- Delete/duplicate controls need repository tests or emulator coverage that
  prove stale Firestore nested documents are removed or reconciled after save.
- Today still needs broader e2e coverage for issue reporting, crop stage
  buttons, and offline saved-locally state on a mobile viewport. One-tap
  harvest logging now has browser smoke coverage.
- Feed now has browser-level e2e coverage for selecting a photo while offline,
  previewing it as a volatile form draft, disabling the upload save path, and
  saving text only. Online photo upload success/failure, issue status changes,
  and mobile filter ergonomics still need broader browser coverage.
- Water skip/dismiss/custom amount controls are not implemented and need unit
  tests once added.
- Notification production readiness still needs live or emulator smoke coverage
  for actual push delivery. Mockable FCM token persistence is now covered by
  Firebase adapter integration tests.
- Backend operations still need Firestore emulator coverage for the scheduled
  hourly scan, callable auth rejection, task subcollection writes, and
  duplicate notification suppression across multiple generated snapshots.
- Authorization claim assignment still needs an admin workflow; current rules
  tests prove enforcement, not tester provisioning.
- Demo mode has mock-browser enter/reset/exit coverage; it still needs
  Firebase-emulator coverage for stale nested document cleanup after loading or
  resetting the canonical demo garden.
- Weather provider adapters need contract tests with captured NWS/Tomorrow.io
  payload fixtures before they should be treated as fully regression-proof.
- Offline behavior needs mobile-sized e2e coverage for queued saves, visible
  "saved locally" state, and stale-base conflict resolution from the Plan
  publish flow.
- Bundle budget enforcement exists, but the offline crop catalog remains a large
  intentional route chunk and should be split only when it can stay offline.

## Manual QA Checklist

- Sign in with an allowlisted mock email.
- On a fresh user, complete first-run setup from the slim primary path with a
  template, then repeat with Blank plan.
- Open **Optional location and climate**, edit USDA zone and frost dates during
  setup, and confirm Today reflects those editable climate defaults.
- Confirm the shell uses Plan, Today, Feed, Settings labels once relabeled.
- Confirm shell sync badges, Review proposal badges, Today task metadata, Feed
  issue metadata, and Feed filters use distinct status/info/filter/action
  semantics rather than the same pill treatment.
- Open Review and confirm the proposal inbox shows waiting decision count, next
  safe action, quiet decision metrics, payoff copy, and physical-move versus
  low-risk batch semantics.
- Confirm physical-move Review proposals require a visible plot diff preview
  before acceptance, and that publish review records the accepted decision as
  physical work rather than low-risk support.
- Generate layouts and confirm the optimizer opens the guided walkthrough with
  strategy choice, before/after preview, support/materials, warnings/tradeoffs,
  and apply/reject/snooze actions before anything mutates the draft.
- Confirm optimizer proposal copy uses practical strategy labels and explains
  real constraints/tradeoffs rather than raw scores or certainty language.
- Confirm generated layouts and Review proposals expose the plot-level proposal
  diff overlay before acceptance. Unit coverage should verify feet-based
  before/after geometry and connectors; Playwright visual coverage should keep
  the overlay visible in the Optimize baseline.
- Add a crop planting, move it, save, reload, and confirm feet coordinates are
  preserved.
- Add or load a multi-plant row/block/cluster and confirm each plant appears as
  its own selectable node with shared crop identity and feet-based coordinates.
- Open Choose Plants, add several crops, and confirm Season Board cards lead
  with crop, quantity, recommended form, and variety/notes while legacy
  weighting controls and score-like language stay out of the primary card.
- Select a plant and confirm the crop focus card highlights all matching plant
  nodes, exposes Plant/Crop/Needs views, labels the interaction as a selected
  plant preview, and opens the full inspector only when **Open details** is
  clicked.
- Toggle **Show influence** from the crop focus card and confirm the contextual
  overlay shows feet-based keep-away zones plus any modeled shade cells for the
  focused crop, then hides cleanly without changing saved `xFt`/`yFt`.
- Select a multi-plant group, adjust arrangement spacing in the inspector, and
  confirm the individual nodes update in place without changing crop identity or
  leaving the saved plot.
- Confirm plant nodes show readable crop labels, lifecycle state, anchored or
  locked state when relevant, and support/warning signals without colliding with
  labels on desktop or mobile.
- Confirm normal drag settles on eighth-foot increments and that temporary
  free-move keeps sub-snap precision until released.
- Drag near a bed corner, path edge/center, trellis line, and plot centerline;
  confirm the guide appears and the item lands exactly on the intended edge or
  center.
- Duplicate a planting, change lifecycle to harvest-ready, lock it, then delete
  it and confirm the original remains.
- Add a bed or trellis, resize it, save, reload, and confirm geometry is
  preserved.
- Resize beds from each corner and edge handle, including on a touch-sized
  viewport, and confirm neighboring edges snap cleanly.
- Shift-select multiple items, drag a marquee around a small group, nudge with
  arrow keys, duplicate the group, align it, distribute it, delete it, then
  undo/redo the edits.
- Use Undo and Redo after a plant placement, structure placement, and inspector
  edit.
- Generate or paint sun/shade and confirm manual overrides survive recalculation.
- Switch spring, summer, and fall sun views; confirm direct-sun hour labels and
  manual override markers are understandable.
- Open Review mode, jump from a warning to the affected item, and acknowledge an
  informational caution.
- Resize the browser to desktop and mobile widths, scroll a large plot inside
  the Plan viewport, and confirm the app header, rail, zoom controls, and bottom
  toolbar do not move with the plot.
- Confirm global shell chrome stays subordinate on desktop and mobile: side nav
  and bottom nav remain usable, the topbar exposes one passive sync status group
  plus a quiet user label, and Plan avoids duplicating default online/cloud-ready
  badges when there is no queued edit, error, or conflict.
- On a phone-sized viewport, confirm the Plan canvas fills the first screen, the
  canvas controls are a compact horizontal row, the Tools launcher and selected
  item controls are thumb-sized above the mobile nav, and mode/inspector bottom
  sheets leave the plot visible behind them.
- Use Fit, 100%, zoom in, and zoom out on a large plot and confirm item hit
  testing still lands on the intended feet-based cells.
- Toggle the Overview layer open and closed and confirm it never blocks the
  primary planting work by default.
- Confirm motion follows `docs/motion-guidelines.md`: overlays have clear
  trigger-to-surface causality, Plan geometry stays stable, Today/Feed/Settings
  confirmations use the same short tokenized choreography, and reduced-motion
  mode removes transform travel without hiding state changes.
- Approve a succession suggestion in Plan and confirm it appears as a planned
  future planting with generated schedule work.
- Update weather when online and confirm watering rationale is visible.
- Trigger backend operation refresh in Firebase mode and confirm the saved
  recommendation shows source, data quality, and refreshed time.
- Complete or snooze a task in Today and confirm the change persists.
- In Today, mark water done and confirm the water recommendation disappears,
  the linked water task is done, and Feed shows the water note.
- In Today, report an issue, confirm a follow-up inspect task appears, then
  resolve the issue and confirm the follow-up task completes.
- In Today, use harvest schedule **Log harvest** and confirm a default field
  harvest is written, the planting remains harvest-ready, and no photo-note
  prompt appears automatically. Use **View details** to log a finished harvest
  and confirm the planting becomes harvested.
- Confirm Today Do Now cards and task cards use clear semantic actions while
  date, bed, priority, crop, and reason copy remains passive supporting text.
- Confirm Today and Feed stay compact on desktop and mobile: empty secondary
  Today panels collapse, Feed uses the compact summary rail, filtered-empty Feed
  states explain how to return to the full stream, and photo memories still keep
  the title-image-caption hierarchy. On mobile Today, field priorities should
  appear before weather so the first screen leads with action.
- In Today, mark a planned crop planted, then growing and confirm setup tasks,
  generated tasks, Feed notes, recent activity, and harvest timing update.
- In Feed, add a garden-scoped note, bed-scoped note, planting-scoped issue,
  photo attachment, and harvest.
- In Feed, open **New entry**, then filter by search text, target, issue
  status, Journal, Issues, Harvests, Media, and Season.
- Move a Feed issue from Open to In progress to Resolved and confirm the linked
  follow-up task status changes when resolved.
- Confirm Harvests aggregate by crop and bed, and Season shows starts versus
  harvests, issue counts, water alert acknowledgements, best performers, watch
  list, attached photos, and rough value disclosure.
- Toggle offline mode and confirm text changes queue locally.
- Confirm the app shell shows queued local change state with a queued timestamp
  and clears after reconnect/sync.
- With one browser queued offline and another browser publishing first, confirm
  reconnecting marks a sync conflict instead of silently overwriting the newer
  published plan.
- In Feed while offline, attach a photo and confirm the UI previews it as a
  volatile form draft, offers reconnect or text-only save, and never claims the
  photo uploaded or queued.
- In Firebase mode, sign in with a user missing `gardenAccess: true` or
  `secretFaeriesMember: true` and confirm Firestore/Storage access fails even if
  the email is in the client allowlist.

## Release Evidence

Each verification handoff note should include:

- files or surfaces changed
- schema decisions
- commands run
- live integrations not exercised
- known blockers or residual risks
