# UX Architecture

Date: 2026-04-21

## Canonical IA

| Surface  | Canonical route | Legacy redirect            | Responsibility                                                                  |
| -------- | --------------- | -------------------------- | ------------------------------------------------------------------------------- |
| Plan     | `/app/plan`     | `/app/garden`              | Draft editing, publish confirmation, revision history, geometry, warnings       |
| Today    | `/app/today`    | `/app/tasks`               | Field mode for urgent alerts, watering, due tasks, issues, and harvests         |
| Feed     | `/app/feed`     | `/app/log`, `/app/journal` | Notes, issues, photos, harvests, and season memory                              |
| Settings | `/app/settings` | none                       | Account, alert defaults, climate assumptions, push/in-app notification controls |

`/app` redirects to `/app/plan`. Auth stays deliberately small: email,
password, sign in, optional show-password, and default-on remember-device.

## Layout Patterns

Desktop:

- Authenticated shell uses a persistent left navigation rail.
- Main content stays centered and scrollable.
- Plan uses a tool workspace: left mode rail, central zoomable plot canvas, and
  right contextual inspector.
- Today uses a field-mode command surface first, followed by due work and a
  right-side context panel when the viewport allows.
- Feed uses a centered primary stream with a compact summary strip; analytics
  rollups stay out of the default route unless they directly support the feed.
- Settings remains a readable single-column control surface.

Mobile:

- Shell uses bottom navigation for Plan, Today, Feed, and Settings.
- Plan keeps the plot canvas first, exposes large floating mode actions, and
  moves mode-specific controls and selected-item details into route-owned bottom
  panels.
- Today is thumb-first: sticky quick action rail, compact field cards, crop
  stage buttons, and a route-owned quick-action sheet for note/photo/issue/
  harvest capture.
- Feed keeps the activity stream first and opens entry creation in a route-owned
  composer modal.
- Bottom sheet/drawer primitives exist for mobile contextual controls, but
  additional feature-specific drawers should stay small and route-owned.

## Plan Workspace Contract

Plan is the canonical garden design surface. It should feel like an editor, not
like one long form.

Desktop structure:

- Top bar: route title, plot dimensions, online/offline state,
  saved/queued/error state, published/draft state, Choose Plants, Optimize,
  plot settings, history, save, and publish. It stays global and compact;
  selection coordinates, warning counts, undo/redo, sun tools, and placement
  controls do not live in this bar.
- Left rail: compact entry points for explicit editor modes only.
- Canvas: foot-based plot grid, structures, plantings, north/orientation marker,
  scale legend, sun layer, warning overlays, zoom controls, layer toggles, pan,
  and an optional mini-map. The mini-map defaults off so it does not cover the
  plot.
- Context panel: appears only when the active mode needs controls or a garden
  item is selected. It owns placement controls, optimizer/review work, plan
  health, and selected-item inspection.
- No default below-canvas control dumps. The canvas column owns the normal
  workspace height and the plot viewport is the primary pannable area.

Mobile structure:

- Canvas appears before secondary controls and uses the first viewport as the
  primary planning surface.
- The compact Plan action bar carries save, publish, history, plot settings, and
  status after the canvas. The bottom action rail keeps Crops, Optimize, and
  editor modes reachable above the fixed mobile nav.
- Mode controls, optimizer/review work, and selected-item inspection appear as
  route-owned bottom sheet panels only when invoked.
- Mobile layer controls stay compact; the mini-map toggle is hidden on mobile
  because the overlay competes with the plot.

Editor modes:

- Select: choose, drag, inspect, lock, duplicate, and delete garden items.
- Plant: open crop placement while preserving the central canvas.
- Structure: place beds, paths, trellises, compost areas, irrigation, and
  obstacles.
- Optimize: review spacing, trellis, shade, rotation, succession, weather, and
  material guidance without keeping those panels always visible.
- Sun/Climate: show, recalculate, and manually paint sun exposure when the model
  is uncertain.
- Measure: emphasize dimensions, one-foot grid, snap increment, and orientation.

Plot settings flow:

- Plot settings are a route-owned modal, not a spread of controls on the main
  Plan surface.
- The modal groups plot size, north orientation, location search/geocoding,
  manual coordinates, and a Settings entry point for climate and alert defaults.
- Plot type remains a first-run/template concern until the persisted garden
  model has a durable plot-type field.

Choose Plants flow:

- The compact Plan action bar opens **Choose Plants** without crowding the
  canvas.
- The flow is a route-owned modal/sheet pattern: searchable/filterable library
  on one side, compact season board on the other, and persistent footer actions
  that remain reachable on small screens.
- Each wanted crop stores target quantity, planting mode preference,
  must-grow/nice-to-have, direct-sow/transplant preference, container allowance,
  support allowance, priority, variety, notes, and rank.
- Quick fit signals stay compact: likely good fit, caution, or hard to fit, with
  plain reasons for sun mismatch, space pressure, season/climate mismatch, and
  support requirements.
- Optimize reads the season board as layout candidates before crops are placed
  on the canvas. This keeps "interested in growing" separate from saved
  planting geometry.

Auto-layout proposal flow:

- Optimize generates three editable proposals from the season board: Sun fit,
  Support disciplined, and Access balanced.
- The compact Plan action bar opens Optimize. Optimize work lives in the
  contextual panel or mobile bottom sheet. Review proposals appear before
  passive health diagnostics so the user sees decisions before noise.
- Each proposal shows a score, score components, plain-language explanations,
  tradeoffs, and required seed/start/support materials.
- Choosing a proposal only selects it. The user must explicitly apply the
  selected proposal before the draft receives generated plantings and support
  structures.
- Applying a proposal replaces prior auto-layout proposal items marked
  `[auto-layout]` while preserving user-created plantings and structures.
- Generated layouts are intentionally explainable and editable. The UI must not
  present the score as a yield guarantee.

Review proposal inbox:

- Review is an active proposal inbox, not a passive warning list or raw
  diagnostic dump.
- Queue cards come from optimizer proposals and self-fixing suggestions derived
  from crop, structure, sun/shade, path, and support data. Note-only diagnostics
  stay in Plan health until the app can offer a concrete draft change.
- Suggestions support accept, reject, and snooze decisions. Accepted suggestions
  mutate the private draft through explicit actions such as adding support,
  widening a path, moving a crop, converting a crop to a trellised layout,
  or applying an optimizer proposal.
- Rejected and snoozed decisions remain visible in the decided section, stay out
  of the open queue for the current draft, and are persisted so they can appear
  in publish review.
- Non-controversial support/material fixes can be batch accepted. Layout
  candidates, geometry-moving fixes, and physical-move requests stay
  one-at-a-time decisions.
- Plan warnings still exist as a lighter plan-health channel for jump-to-item
  context and canvas highlighting. Review cards are the place where decisions
  happen.
- Publish confirmation separates suggestions accepted into the draft from
  rejected or snoozed proposals.

Selection model:

- Plantings and structures can be selected, edited, duplicated, deleted, locked,
  and unlocked.
- Plantings have lifecycle states: planned, planted, growing, harvest-ready,
  harvested, and removed.
- Feet remain the canonical stored unit for positions and dimensions. Pixels,
  CSS transforms, zoom, and pan are only rendering details.

Inspector tabs:

- Details: names, notes, immutable crop/type context, position, footprint, and
  destructive actions.
- Care: lifecycle, mulch state, sizing, sun fit, and structure shade inputs.
- Schedule: open and completed item-linked work.
- Warnings: item-linked warnings with plain explanations.
- History: linked log entries and harvest records.

Rendering choice:

- Plan intentionally keeps the existing lightweight DOM scene instead of moving
  to SVG or a canvas library. The current item model is rectangular, form-heavy,
  and accessibility-friendly, so absolute DOM elements plus a transformed scene
  provide enough precision without a new dependency.
- Pointer math compensates for the transformed scene by deriving effective
  pixels-per-foot from the measured plot width. Stored `xFt` and `yFt` remain
  unchanged.
- Reconsider SVG only if future resize handles, shape editing, or dense hit
  testing become hard to keep precise with DOM elements.

## Design Foundation

Shared primitives now live in `src/features/shared/design/`:

- spacing and typography tokens in global CSS
- radius tokens for cards, controls, and pills
- color roles for paper, surface, text, border, accent, warning, and status
- `Panel` for framed content
- `RouteHeader` for route title, summary, and action alignment
- `Banner` for offline, fallback, and command feedback
- `StatusBadge` and `Chip` for save/sync, filters, and operational state
- `Button` for primary, secondary, and danger actions
- `IconButton` for compact icon-sized actions
- `SegmentedControl` for mode switching
- `FormField` for label, hint, error, and input spacing standards
- `ListCard` for repeated list/feed cards
- `Modal` for publish confirmation and revision history
- `Drawer`, `Sheet`, `BottomSheet`, and `Popover` shells for contextual UI
- `EmptyState`, `ErrorState`, and `SkeletonBlock` for loading, error, and
  no-data states

Design styles are intentionally split:

- `DesignPrimitives.module.css`: base panels, buttons, badges, fields, cards,
  route headers, and state primitives
- `DesignOverlays.module.css`: modal, drawer, sheet, bottom-sheet, and popover
  overlay patterns

Global shell surfaces:

- online/offline state in desktop and mobile shell chrome
- offline banner when the browser is disconnected
- fallback-runtime banner when Firebase config falls back to mock mode
- polished loading and error boundary surfaces

## Today Field Mode Contract

Today is the operational surface for using the app outside. A user should be
able to complete the day without opening Plan.

Top-level structure:

- Header: selected-day task count, active watering count, unresolved issue
  count, schedule sync, and save/sync state.
- Calendar strip: fixed at the top of Today and drives the content below. The
  current-day cell includes overdue tasks; future cells show work dated exactly
  for that day.
- First-viewport overview: premium weather surface plus a "Do now" priority
  queue for watering, high-severity issues, harvests, crop-stage changes, and
  high-priority tasks.
- Main field order: watering today, critical checks, harvest-ready items, task
  list, quick actions, and recent Feed highlights when there is useful content.
- Empty/low-value sections collapse to compact clear states or disappear; Today
  must not leave large empty task boxes on the page.
- Quick action rail: Add note, Add photo, Report issue, and Log harvest, placed
  after the selected-day task list while remaining thumb-friendly on mobile.
- Quick action sheet: route-owned form that preserves bed/planting context and
  uses the existing journal, media storage, task, and harvest records.
- Task list: selected-day work grouped by action type and bed, with task done,
  snooze, and defer actions plus the task reason.
- Context sidebar: selected-day task counts by bed and succession
  recommendations, shown only when useful.

Implemented command behavior:

- Water done marks the recommendation completed, completes the linked water
  task, and writes a water journal note so future watering logic can see manual
  watering evidence.
- Report issue writes a structured issue entry and creates a linked inspect
  follow-up task. Resolving the issue completes the linked follow-up task.
- Add note writes a normal journal entry against the garden, structure, or
  planting target.
- Add photo uses the existing media storage seam when online and makes the
  network requirement explicit when offline.
- Log harvest writes a harvest event and moves the planting to harvest-ready or
  harvested depending on whether the user marks the crop finished.
- Crop stage buttons move plantings through planted, growing, and
  harvest-ready from the field view, complete open setup tasks when
  appropriate, refresh generated tasks, and write a linked Feed note.

Offline posture:

- Text garden-aggregate changes use the existing repository save path and show
  saved locally when offline.
- Photo uploads still require a connection because there is no durable upload
  queue yet.

## Feed Contract

Feed is the "what happened" surface. It should read like a compact activity
stream, not like a database editor.

Top-level structure:

- Header: compact route copy plus Post, Issue, Photo, and Harvest composer
  actions.
- Summary strip: memory count, unresolved issues, harvest count, and photo
  count.
- Composer: route-owned centered desktop modal and full-screen mobile sheet for
  notes/posts, issues, photo updates, and harvests. The main feed never carries
  a giant inline form.
- Filters: type, crop, bed, season, search text, and issue status.
- Activity stream: concise cards for notes, watering events, issue reports,
  harvests, publish events, task completions, and photo updates.
- Pinned unresolved issues: open/in-progress issue cards stay highlighted above
  the main feed when they match the current filters.
- Secondary rollups should stay collapsed, modalized, or inspector-like. They
  should not compete with the default activity stream.

Composer behavior:

- Notes and photo updates write normal journal entries through the existing
  media storage seam.
- Notes, issues, and photo updates use one grouped target selector for the
  whole garden, saved beds/structures, and saved plantings.
- Issues capture issue type, severity, status, linked target, photos, and create
  the same follow-up task as Today.
- Harvests write harvest events without forcing the user away from the current
  feed position.
- Closing the Feed composer does not wipe the active text/photo draft; a
  successful save clears the entry fields and returns to browsing.

## Feature Structure

Current feature ownership:

- `src/features/plan/`: Plan page, mode rail, top bar, mode drawer, operations
  panel, zoomable canvas, canvas controls, mini-map, inspector, modal styles,
  and pointer-interaction hooks.
- `src/features/today/`: Today route orchestration, field-mode panels/cards,
  quick actions, grouped task cards, sidebar, selectors, field model builders,
  lifecycle actions, and pure Today action helpers.
- `src/features/log/`: Feed route implementation, compact activity cards,
  composer modal, entry form, harvest form, feed item builders, filters,
  summary strip, save state, and formatting helpers. Feed route styles are
  split into route layout, form, filter, and card modules instead of one large
  CSS module.
- `src/features/settings/`: settings page, notification/defaults form sections,
  and consent helpers.
- `src/features/garden/`, `src/features/tasks/`, and `src/features/journal/`:
  retained for compatibility exports and existing domain engines/helpers.

## Offline And Sync UX

Current posture:

- Firestore mode initializes persistent local cache.
- Garden aggregate saves queue in browser local storage when offline.
- Tasks, Today text actions, feed notes, issues, and harvest records use the same
  garden save path.
- Firebase Storage photo upload is not queued offline.
- Shell-level online/offline state is visible across all authenticated routes.

Target posture:

- Keep optimistic field actions, but make "saved locally" versus cloud-saved
  more specific per command.
- Add conflict copy before adding multi-device expectations.
- Treat offline photo queueing as a later feature because it requires a
  dedicated upload queue.

## Manual Override UX

Manual override paths are required where model certainty is limited:

- Sun/shade: implemented through manual cell painting in Plan; still needs a
  clearer reset flow.
- Water: implemented for "water done" through recommendation completion, linked
  task completion, and a journal water note. Skip/dismiss and custom amount
  controls remain future work.
- Climate defaults: implemented in Settings, but copy should make assumptions
  more explicit.
- Notifications: implemented through in-app, push, and alert-type toggles. carrier messaging
  is de-scoped and should not appear in the current product UX.

## Remaining UX Debt

- Plan now has the right editor shape, but drag/resize still needs more real
  device touch QA.
- Undo/redo is local editor history only; it does not resolve multi-device
  conflicts.
- Today now has a field-mode structure, but water skip/dismiss and custom water
  amounts are still missing.
- Save and sync state exists globally and locally, but command-specific progress
  is still inconsistent outside Today quick actions.
- Bottom sheet/drawer primitives exist, and Plan/Today use route-owned mobile
  panels. Feed has smaller route-owned style modules now, but secondary details
  can still move into sheet/inspector flows when the Feed workflow grows.
- Legacy feature folders remain because persistence engines and compatibility
  exports still live there.

## Visual QA Harness

First-viewport visual baselines now exist for Plan, Today, Feed, and Settings at
desktop and mobile sizes.

- Baseline screenshots: `e2e/__screenshots__/`
- Playwright visual artifacts and diffs: `output/playwright/visual/`
- Update baselines after intentional layout changes:
  `npm run test:visual:update`
- Compare current UI against baselines:
  `npm run test:visual`

Visual regression is intentionally separate from `npm run ci` until the
committed baselines are reviewed and stabilized across developer machines.

## Release Readiness Contract

- Release candidates must pass lint, typecheck, unit, e2e, build, and `ci`
  after the final docs/log update.
- Visual baselines should be refreshed only for intentional UI changes and then
  checked with `npm run test:visual`.
- release-demo readiness requires mock demo load/reset, Plan Choose Plants to
  Optimize to Review/Publish, Today task work, and Feed composer flows to pass
  before a production deploy.
- Live deploy remains blocked until Firebase Auth users/claims, FCM keys, and
  native config files when applicable are verified outside source control.
