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

## Cross-Route Target Contract

- Plan accepts targeted route state with `?p=<planting-or-structure-id>`. When
  the target still exists, Plan enters select mode and highlights the relevant
  object without mutating the draft.
- Today task links use those Plan targets for planting/structure work. Manual
  issue follow-up tasks link back to `/app/feed?entry=journal-<id>` so the
  originating issue opens in context.
- Feed cards link planting target labels back to Plan, including harvests,
  watering notes, issues, and completed item-linked tasks. Whole-garden and
  published-plan entries remain normal Feed records.
- Missing or removed targets must degrade gracefully to the route shell. Do not
  add public sharing, social permalinks, or multi-garden routing behavior.

## Layout Patterns

Motion must follow `docs/motion-guidelines.md`: use CSS/native browser
capabilities first, keep Plan geometry stable, and respect reduced-motion
preferences before adding any new choreography.

Desktop:

- Authenticated shell uses a persistent left navigation rail.
- Main content stays centered and scrollable.
- Plan uses a canvas-first workspace: a stable zoomable plot, compact tool
  launcher, contextual overlays, and reopenable panels that do not resize the
  grid.
- Today uses a field-mode command surface first, followed by due work and a
  right-side context panel when the viewport allows.
- Feed uses a centered primary stream with a compact summary strip; deeper
  rollups stay out of the default route unless they directly support the feed.
- Settings remains a readable single-column control surface.

Mobile:

- Shell uses bottom navigation for Plan, Today, Feed, and Settings.
- Plan keeps the plot canvas first, exposes a compact thumb-friendly launcher,
  and moves mode-specific controls and selected-item details into route-owned
  bottom panels.
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
- Tool launcher: compact entry points for Select, Plant, Structure, Review,
  Optimize, Sun/Climate, Measure, and reopenable panel recovery. The launcher is
  subordinate to the canvas and should not read as the page's main layout.
- Canvas: foot-based plot grid, structures, plantings, north/orientation marker,
  scale legend, sun layer, warning overlays, zoom controls, layer toggles, pan,
  and an optional mini-map. The mini-map defaults off so it does not cover the
  plot.
- Context overlays and panels: appear only when the active workflow needs
  controls. They own placement controls, optimizer/review work, plan health, and
  selected-item inspection without changing the plot viewport dimensions.
- No default below-canvas control dumps. The canvas column owns the normal
  workspace height and the plot viewport is the primary pannable area.

Mobile structure:

- Canvas appears before secondary controls and uses the first viewport as the
  primary planning surface.
- Canvas controls collapse into one horizontal HUD so Pan/Fit/100%, zoom, layer
  toggles, and Overview do not push the plot down the phone viewport.
- The compact launcher keeps Crops, Review/Optimize, and editor modes reachable
  above the fixed mobile nav with thumb-sized controls.
- Mode controls, optimizer/review work, and selected-item inspection appear as
  route-owned bottom sheet panels only when invoked and should stay capped below
  roughly three-fifths of the viewport.
- Crop focus remains a compact card above the bottom rail. It may show Plant,
  Crop, Needs, and influence actions, but deeper editing moves behind the
  explicit **Open details** path.
- The Overview mini-map remains off by default and must stay subordinate when
  toggled so it never blocks normal planting work.

Editor workflows:

- Select: choose, drag, inspect, lock, duplicate, and delete garden items.
- Plant: open crop placement while preserving the central canvas.
- Structure: place beds, paths, trellises, compost areas, irrigation, and
  other planting-support context only when it materially affects crop placement
  or field operations.
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
- The board card is quantity and intent first: crop identity, desired plant
  count, recommended planting form, variety or notes, and only the review state
  needed to make a human decision.
- Planting form remains the main secondary adjustment. Support allowance appears
  only for crops where support materially changes layout. Former sow, container,
  and legacy weighting inputs are compatibility-read from old saves but are no
  longer persisted or used to weight optimizer output.
- Planning review copy uses plain reasons for sun mismatch, space pressure,
  season/climate mismatch, support, and bed/container issues. It must not use
  score-like persuasion.
- Optimize reads the season board as layout candidates before crops are placed
  on the canvas. This keeps "interested in growing" separate from saved
  planting geometry.

Auto-layout proposal flow:

- Optimize generates three editable proposals from the season board: Best sun
  exposure, Support-ready, and Keep paths clear.
- The compact Plan action bar opens Optimize. Optimize work lives in the
  contextual panel or mobile bottom sheet. Review proposals appear before
  passive health diagnostics so the user sees decisions before noise.
- Generate layouts opens a guided proposal walkthrough rather than only filling
  an inbox. The walkthrough keeps the plot visible, lets the gardener choose a
  strategy, and makes previewing clearly draft-safe.
- Each proposal shows plain-language readiness, before/after context,
  tradeoffs, and required seed/start/support materials without exposing raw
  scores as product copy.
- Proposal generation must enforce practical garden constraints before polish:
  plot bounds, saved paths and blocking structures, planted/growing anchors,
  crop spacing footprints, whole-footprint sun context, tall-crop shade
  discipline, legal support clearance, and trellis placements that are adjacent
  rather than faked through the crop footprint.
- The selected proposal also paints a non-mutating diff overlay on the real
  plot. The overlay uses feet-based ghost positions, proposed positions,
  movement connectors, support additions, removals, and introduced-warning
  labels so the generated layout is visible before it is applied.
- Choosing a proposal only selects it. The user must explicitly apply the
  selected proposal before the draft receives generated plantings and support
  structures.
- The walkthrough supports apply, reject, and snooze decisions for the selected
  candidate. Rejected or snoozed candidates are removed from the immediate apply
  path but remain recorded in the draft's proposal decisions.
- Applying a proposal replaces prior auto-layout proposal items marked
  `[auto-layout]` while preserving user-created plantings and structures.
- Generated layouts are intentionally explainable and editable. The UI must not
  present the score as a yield guarantee.

Review proposal inbox:

- Review is an active proposal inbox, not a passive warning list or raw
  diagnostic dump.
- The inbox leads with the number of waiting decisions, a human-readable next
  safe action, quiet decision metrics, and concise payoff copy so it reads like
  a decision workspace instead of a chip-heavy card stack.
- Queue cards come from optimizer proposals and self-fixing suggestions derived
  from crop, structure, sun/shade, path, and support data. Note-only diagnostics
  stay in Plan health until the app can offer a concrete draft change.
- Suggestions support accept, reject, and snooze decisions. Accepted suggestions
  mutate the private draft through explicit actions such as adding support,
  widening a path, moving a crop, converting a crop to a trellised layout,
  or applying an optimizer proposal.
- Queue cards can show their proposed change on the plot before acceptance.
  Review diff overlays use the same feet-based visual language as generated
  layouts so physical moves, support additions, and low-risk placement changes
  are inspectable without turning Review into a text-only inbox.
- Physical-move proposals require a plot diff preview before acceptance. The
  user should understand the proposed move and either have completed it in the
  garden or be deliberately updating the plan for real-world work.
- Rejected and snoozed decisions remain visible in the decided section, stay out
  of the open queue for the current draft, and are persisted so they can appear
  in publish review.
- Accepted/rejected/snoozed decisions persist a simple impact class:
  low-risk support, planned change, or physical move. This is audit metadata for
  publish review, not a new scoring surface.
- Non-controversial support/material fixes can be batch accepted. Layout
  candidates, geometry-moving fixes, and physical-move requests stay
  one-at-a-time decisions.
- Plan warnings still exist as a lighter plan-health channel for jump-to-item
  context and canvas highlighting. Review cards are the place where decisions
  happen.
- Publish confirmation separates suggestions accepted into the draft from
  rejected or snoozed proposals, summarizes low-risk support, physical moves,
  and deferred decisions, and requires explicit confirmation before accepted
  physical moves can be published.
- Revision history uses a two-step revert. Revert publishes the selected older
  garden as a new revision and resets the current user's private draft.

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
- Do Now cards should read as a professional field checklist: one clear primary
  action, passive context as text rather than action-like chips, and enough
  spacing for outdoor touch use without wasting the first viewport.
- Main field order: watering today, critical checks, harvest-ready items, task
  list, quick actions, and recent Feed highlights when there is useful content.
- Empty/low-value sections collapse to compact clear states or disappear; Today
  must not leave large empty task boxes on the page.
- Field entry launcher: one compact **Field entry** control placed after
  the selected-day task list, expanding to Add note, Add photo, Report issue,
  and Log harvest choices without leaving four peer buttons on the page.
- Quick action sheet: route-owned form for secondary detail capture. It
  preserves bed/planting context and uses the existing journal, media storage,
  task, and harvest records without becoming the default path for common field
  completion.
- Task list: selected-day work grouped by action type and bed, with task done,
  snooze, and defer actions plus the task reason. Metadata such as date, bed,
  and priority stays visually passive so it cannot be mistaken for a button.
- Context panel: selected-day task counts by bed and succession
  recommendations, shown only when useful.

Implemented command behavior:

- Water done marks the recommendation completed, completes the linked water
  task, and writes a water journal note so future watering logic can see manual
  watering evidence.
- Report issue writes a structured issue entry and creates a linked inspect
  follow-up task. Resolving the issue completes the linked follow-up task.
- Add note writes a normal journal entry against the garden, structure, or
  planting target.
- Add photo uses the existing media storage seam when online. The quick sheet
  shows the same preview and media caveats as Feed, distinguishes native camera
  capture from the browser picker, and makes clear that selected photos are only
  held in the form while offline.
- Harvest card **Log harvest** is a one-tap field action. It writes a default
  harvest event, completes the linked harvest task, and leaves the planting
  harvest-ready for repeat picking. Only harvest completion opens the optional
  Add Photo sheet; watering, task done, and crop-stage actions finish without
  media prompts. The adjacent Details action opens the harvest sheet for
  quantity, notes, or marking the crop finished.
- Crop stage buttons move plantings through planted, growing, and
  harvest-ready from the field view, complete open setup tasks when
  appropriate, refresh generated tasks, and write a linked Feed note.

Offline posture:

- Text garden-aggregate changes use the existing repository save path and show
  saved locally when offline.
- Photo uploads still require a connection because there is no durable upload
  queue yet. If the user selects or captures a photo while offline, the app may
  preview that file in the current form, but it must not label the binary as
  queued or durable.

## Feed Contract

Feed is the "what happened" surface. It should read like a compact activity
stream, not like a database editor.

Top-level structure:

- Header: compact route copy plus one **New entry** launcher. **New note**,
  **New issue**, **New photo update**, and **Log harvest** stay available
  inside the composer instead of competing as four peer header buttons.
- Summary strip: memory count, unresolved issues, harvest count, and photo
  count, presented as a compact status rail rather than large metric cards.
- Composer: route-owned centered desktop modal and full-screen mobile sheet for
  notes/posts, issues, photo updates, and harvests. The main feed never carries
  a giant inline form.
- Filters: type, crop, bed, season, search text, and issue status.
- Empty states: filtered-empty copy should tell the user to clear or loosen
  filters; true-empty copy should lightly invite the next garden memory without
  taking over the viewport.
- Activity stream: concise cards for notes, watering events, issue reports,
  harvests, publish events, task completions, and photo updates.
- Photo-update cards are image-led private memories: title first, one generous
  central image, then the caption/body and quiet metadata. Non-photo activity
  cards stay compact so Feed does not become a social stream or dashboard.
- Pinned unresolved issues: open/in-progress issue cards stay highlighted above
  the main feed when they match the current filters, but they should remain
  compact enough that the activity stream still starts quickly.
- Secondary rollups should stay collapsed, modalized, or inspector-like. They
  should not compete with the default activity stream.

Composer behavior:

- Notes and photo updates write normal journal entries through the existing
  media storage seam.
- Photo and issue composers show local attachment previews before save. PWA
  users get browser picker/camera copy, Capacitor users get a native camera
  action, and both paths use the same upload honesty when offline.
- Composer mode labels describe the object created rather than using legacy
  generic action labels, and submit buttons use save/create/log verbs that match
  the selected entry type.
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

- `src/features/plan/`: Plan page, compact launcher, top bar, mode drawer,
  operations panel, proposal walkthroughs, diff overlays, zoomable canvas,
  canvas controls, mini-map, crop focus, inspector, modal styles, and
  pointer-interaction hooks.
- `src/features/today/`: Today route orchestration, field-mode panels/cards,
  quick actions, grouped task cards, context panels, selectors, field model
  builders, lifecycle actions, and pure Today action helpers.
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
- Shell-level online/offline state is visible across all authenticated routes as
  passive status, not route content. The topbar shows one compact shell status
  group, a quiet user label, and low-emphasis account actions; route headers
  avoid duplicating default online/cloud-ready badges unless there is an
  exception such as a queued edit, error, conflict, or draft state.
- Plan, Today, and Feed use the same save-state language: **Saved** means the
  current command wrote successfully, **Saved locally** or **Queued locally**
  means the browser has the change and cloud sync is still pending, and photo
  controls explicitly say media upload needs connection.
- Media controls may keep selected photo files visible as a volatile in-form
  draft while offline. Text can still save locally; photo binaries are not
  queued and are dropped if the user saves text only or leaves the form.

Target posture:

- Keep optimistic field actions, but make "saved locally" versus cloud-saved
- more specific per command. Prompt 40 implemented this baseline for Plan
  edits, Today actions, Feed text memories, and photo caveats.
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
- Notifications: implemented through in-app history, push, local native
  reminders, and alert-type toggles. Carrier messaging is outside product scope
  and should not appear in the current product UX.

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

Visual regression is part of the current `npm run ci` gate. Update snapshots
only for intentional UI changes and review the committed baselines before
landing them.

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
