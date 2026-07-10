# UX Architecture

Date: 2026-07-09

The active experience lives under `src/v2`. It is one compact operational loop:
Plan defines reality, Today turns it into work, Feed preserves what happened,
and Settings makes the shared climate and private alert assumptions explicit.

## Information architecture

| Surface  | Canonical route | Legacy redirect            | Primary responsibility                            |
| -------- | --------------- | -------------------------- | ------------------------------------------------- |
| Plan     | `/app/plan`     | `/app/garden`              | Measured private draft, review, publish, history  |
| Today    | `/app/today`    | `/app/tasks`               | Crop-group watering, weather, and field tasks     |
| Feed     | `/app/feed`     | `/app/log`, `/app/journal` | Notes, issues, photos, harvests, watering history |
| Settings | `/app/settings` | none                       | Shared location/climate and private alert consent |

`/` resolves to sign-in or the remembered authenticated route. `/app`
redirects to Plan. `/sign-in` and `/access-denied` are the only dedicated auth
surfaces; there is no registration or onboarding funnel.

Recovery states distinguish loading, unavailable data, required migration,
newer unsupported data, permission denial, and not found. Private route content
never renders before authentication and membership are resolved.

## Deep-link contract

Deep links use stable IDs and focus an existing object without mutating it:

- Plan crop group: `/app/plan?plantingId=<planting-group-id>`
- Plan structure: `/app/plan?structureId=<structure-id>`
- Today watering: `/app/today?focus=watering&cropGroupId=<crop-group-id>` or
  `recommendationId=<recommendation-id>`
- Today task: `/app/today?focus=task&taskId=<task-id>`
- Today weather: `/app/today?focus=weather&snapshotId=<snapshot-id>` or
  `alertId=<alert-id>`

Notification clicks, Today task targets, and Feed target links must use these
forms. A missing/deleted ID leaves the route usable and must not select the
wrong object. There are no public, social, or multi-garden permalinks.

## Authenticated shell

`src/v2/ui/AppShell.tsx` owns:

- desktop rail and mobile bottom navigation for the same four routes
- skip-to-content link and route-focus restoration
- account identity/sign-out
- online/offline and runtime-fallback status
- foreground alert banner with exact deep link
- a single `main` landmark for route content

Only the navigation appropriate to the viewport is exposed to assistive
technology. Route transitions announce the route and focus `#main-content`.
The shell does not become a dashboard; operational counts and commands stay on
the owning route.

All routes must fit a 320 CSS-pixel viewport without horizontal page overflow.
Desktop and mobile use the same domain/actions, not separate reduced-function
products.

## Plan

Plan is the source of operational truth and the only editor for the shared
garden plan. The current surface includes:

- first-run name, plot dimensions, blank/raised-bed/container template, exact
  location/query and coordinates, valid IANA timezone, hardiness zone, and
  typical frost dates
- exact plot width/depth, north orientation, snap increment, location, climate,
  structures, crop groups, and individual plant-instance centers
- add/edit/delete structures and add/edit/duplicate/delete crop groups
- pointer drag and keyboard arrow movement, both committing feet-based values
- grid and sun-layer visibility
- a contextual inspector for lifecycle, growing area, position, size,
  arrangement, spacing, mulch/lock state, notes, structure soil/drainage, and
  crop-group water-profile snapshot
- problem review with explicit ignore/restore decisions
- one non-mutating checked layout preview followed by explicit apply
- private draft save/discard, publish confirmation, revision history, and
  two-step restore-as-new-publish

`xFt` is measured from the plot's left edge and `yFt` from its top edge. Plant
groups use center coordinates; structures use their top-left geometry; all
pixels/transforms remain rendering details. Drag preview must not change
canonical state until release. Locked objects do not move.

Publishing is blocked by invalid schema, out-of-bounds/overlapping physical
constraints classified as blocking, missing crop/structure links, and a crop
footprint that does not fit its assigned growing structure. Review decisions
never erase the underlying issue. Publish/revert must surface expected-revision
conflicts instead of overwriting another account's change.

Every crop group has an inspector section labeled as specific to that group.
It edits the saved weekly need, root depth, depletion fraction, confidence,
source/version, and stage coefficients. These are model inputs, not a global
watering preference; changing Tomato must not silently change Lettuce.

Plan intentionally uses accessible DOM controls rather than a canvas library.
This keeps objects focusable and labeled while remaining precise enough for the
current rectangular plot model.

## Today

Today is the field-work surface. It leads with action but retains evidence:

- date-aware summary
- current/forecast weather and active weather alerts
- one independent watering card per active crop group
- tasks grouped by date and target

A watering card identifies the crop group, action/status, confidence, data
quality, root-zone depletion versus trigger, optional depth/gallons, next
check, reason details, and saved calculation basis. The card must never imply
that one crop's amount applies to a bed or other crops sharing it.

When evidence is insufficient, the card says **Check soil** and explains why;
it does not relabel uncertainty as a recommendation amount. Missing coordinates
produce separate crop-group soil checks rather than an empty Today route or a
default-city forecast.

**Log watering decision** records only the selected crop group:

- applied or partial water accepts explicit inches or gallons and a method
- skipped water requires a reason and stores no amount/efficiency
- every record captures the signed-in actor and starts at revision 1
- completion feedback reports committed only after the active repository
  succeeds; failures keep the dialog usable
- a committed Firebase water record requests canonical operation refresh

Task cards support complete, reopen, snooze, and defer. Metadata such as target,
reason, priority, and due date remains visually passive. Exact deep links apply
a visible focus treatment and move focus to the matching card.

## Feed

Feed is private garden memory, not a social feed or analytics dashboard. Its
default hierarchy is:

1. route heading and one **New entry** action
2. compact counts for memories, open issues, harvests, photos, and watering
3. search/type/target/status filters
4. pinned open issues where relevant
5. chronological activity stream

The composer has explicit Note, Issue, Photo, and Harvest modes. Notes/issues
target the whole garden, a structure, or a crop group. Issues capture category,
severity, and status. Harvests require a crop group and accept optional amount,
unit, and notes. Photos are validated for count, supported type, and size before
upload; attachment metadata is written only after successful uploads.

Water applications appear as first-class activity. Applied and partial entries
report the explicit amount/method and identify **You** or **Garden member** from
their immutable recorder; skipped entries report the zero-credit decision and
reason. Filters distinguish applied, partial, and skipped watering. The
correction dialog updates the same record at revision +1, preserves its crop
group and original recorder, and allows outcome, amount, method, date, or skip
reason to be corrected before requesting an operations refresh.

Online photo selection is a form draft until upload and record persistence
finish. No active repository promises a durable offline queue for text or photo
bytes; failed or pending commands must not be labeled synced. Photo bytes are
never durable outside the open form. Closing the modal preserves a current
draft; successful creation clears it.

## Settings

Settings separates shared garden facts from private account choices.

Shared plan values:

- location label and weather query
- exact latitude/longitude pair
- valid IANA garden timezone
- hardiness zone and typical first/last frost assumptions

Private profile values:

- display identity
- watering, frost, heat, severe-weather, and task-due alert toggles
- daily operation check time
- quiet-hours start/end
- minimum watering deficit for push
- push consent and registration state
- private delivery receipt history

Both coordinates are required by the current Settings form and must stay within
geographic bounds. Location label/query, timezone, hardiness zone, and frost
dates are explicit inputs. Lower-level readers and Functions still treat a
missing pair from incomplete/migrated data as safe mode; it never triggers a
preset location.

In-app history is always available. Settings reports web/native push and
camera/local-notification capability truthfully; a browser permission prompt is
not shown as successful registration until a token is stored. Native-only
capability does not imply that the current v2 routes scheduled a local reminder.
Push history labels provider acceptance as **Sent to push service**, never as
proof that a device displayed or a user saw the message.

Saving Settings publishes shared location/climate through an authenticated
server callable and saves the private profile through its separate repository.
It reports committed only after both active boundaries succeed and keeps
invalid/failed edits in the form. The server preserves unrelated published plan
content and rebases an existing actor draft. These two authorization boundaries
are intentionally not one cross-document transaction: if the second save fails,
the already committed shared publication is not rolled back.

## Shared interaction foundation

`src/v2/ui` owns tokens, controls, fields, status banners, async/error/conflict
states, shell layout, route announcements, and modal behavior. Route folders
own product-specific layout and copy.

Required interaction properties:

- semantic landmarks/headings and native labels
- visible focus for every control and plot object
- skip link, predictable tab order, and route-focus restoration
- modal initial focus, focus trap, Escape close, and trigger restoration
- live regions for save/error/delivery outcomes without repeated noise
- color never used as the only status signal
- controls remain usable with keyboard and touch
- `prefers-reduced-motion` removes nonessential travel without hiding state
- loading, empty, offline, conflict, migration, and error states remain
  distinguishable

## Persistence and offline language

UI copy follows the repository result:

- **Saved/published** means the operation committed
- **Pending** means the command has not produced an authoritative result yet;
  it must not be described as synced or durable
- **Conflict** means the expected published revision changed and requires a
  reload/user choice
- **Not saved** retains the user's in-form edits where possible

The shared result type retains a `queued` extension variant, but the active mock
and Firebase adapters do not return it: they resolve as committed after their
authoritative storage/SDK/callable operation succeeds, or surface an error. The
UI must not promise offline sync for a text record, photo binary, profile,
publish, revert, or shared-settings command.

## Feature ownership

- `src/v2/app`: composition, providers, route guard, shell adapters, deep-link
  parsing, weather/push/media integration
- `src/v2/domain`: plan/profile/workspace/operations/time/watering contracts
- `src/v2/data`: mock/Firebase repositories, validation, normalization, and
  one-way migration readers
- `src/v2/routes/plan`: measured editor and publish workflow
- `src/v2/routes/today`: watering/weather/task field workflow
- `src/v2/routes/feed`: activity stream, filters, and composer
- `src/v2/routes/settings`: shared climate, private alerts, registration, and
  delivery history
- `src/v2/ui`: shared accessible interaction foundation

The previous `src/features/**` client has been removed. Reusable infrastructure
adapters and one-way persisted-data migration readers are not an alternate UI
architecture.

## Visual and release contract

Playwright visual baselines cover auth, first-run setup, Plan, Today, Feed,
Settings, add-crop, review, and checked-layout states on desktop/mobile.
Intentional changes require reviewed baseline updates followed by
`npm run test:visual`.

Release requires the full CI gate plus manual checks for both production
accounts, migration, real weather evidence, separate crop-group results,
web/native push where claimed, accessibility, 320-pixel containment, real touch,
and console/network health. Known platform/setup limits must stay visible in the
handoff.

Carrier messaging, dashboards, charts, maps, collaboration, lore, AI, public
onboarding, and multi-garden navigation remain explicitly excluded.
