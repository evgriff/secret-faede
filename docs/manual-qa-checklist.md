# Manual QA checklist

Run first in deterministic mock mode, then repeat Firebase/account-isolation and
push checks against emulators or production as appropriate.

## Auth and shell

- [ ] Signed-out root redirects to `/sign-in`
- [ ] Invalid credentials return an actionable error and leave the form usable
- [ ] Valid sign-in restores the intended route
- [ ] Session check, sign-out, denied access, offline, runtime fallback, and
      migration/newer-version recovery states are distinct
- [ ] Primary navigation and account actions work by keyboard and pointer
- [ ] Foreground alert banner links/close behavior work without focus loss

## Plan

- [ ] First-run setup requires valid dimensions, location/query, exact
      coordinate pair, IANA timezone, hardiness zone, and typical frost dates
- [ ] Add/edit/delete/select structures; validate bounds and growing-area fields
- [ ] Add crop group with quantity/instances; verify crop-specific saved water
      profile and stage values
- [ ] Move unlocked objects with pointer and keyboard; feet values snap and stay
      inside the plot; locked objects do not move
- [ ] Moving a group moves its instances coherently
- [ ] Assigned crop footprint must fit its growing structure before publish
- [ ] Inspector edits, review ignore/restore, and layout preview/apply are honest
- [ ] Save/discard private draft survives reload and remains private
- [ ] Publish requires summary, clears actor draft, updates shared revision
- [ ] Direct client writes to metadata/published/revisions fail; authenticated
      publish/revert/settings callables own the server transaction
- [ ] Stale expected revision produces conflict rather than overwrite
- [ ] History/revert creates a new revision; it does not mutate old history
- [ ] Crop/structure deep links focus the exact object

## Today and watering

- [ ] Every active crop group has exactly one separately named card
- [ ] Different crop profiles/stages/structures produce independently explained
      results, never one pooled bed/garden amount
- [ ] Each card shows explicit stage, stage source, coefficient, saved profile
      source/version, and weather/reason provenance
- [ ] Card shows action/status, confidence, data quality, reasons, recheck/schedule,
      depth, and gallons only when justified
- [ ] Low-confidence/missing baseline/stale weather/unreliable area requests a
      soil check or null amount without false precision
- [ ] A prepared incomplete/migrated null-coordinate fixture shows safe-mode
      explanation and no default city/weather
- [ ] Applied inches log to only the selected crop group
- [ ] Gallons require/retain area and efficiency context
- [ ] Partial is recorded as actual applied amount, not claimed full amount
- [ ] Skipped records a reason and receives zero water credit
- [ ] After refresh, repeated processing does not double-credit an application
- [ ] Every application records the creating user and starts at revision 1
- [ ] Complete/defer/snooze updates only the exact task and survives reload
- [ ] Task/watering deep links focus the intended card

## Feed

- [ ] Create note with date/target/body validation
- [ ] Create issue with category/severity/status and resolve it
- [ ] Create harvest tied to a real crop group and selected unit
- [ ] Add valid JPEG/PNG/WebP/HEIC/HEIF photos; validate count, type, size, progress,
      failure, and retry
- [ ] Shared entries/photos appear for both members with correct author/time
- [ ] Water applications appear as field activity without changing their ledger
- [ ] Feed labels the recorder as You/Garden member and filters partial records
- [ ] Correction preserves ID/crop/original recorder, increments revision by
      exactly one, edits allowed fields, and replaces prior ledger credit
- [ ] Empty/loading/error states and long content remain readable

## Settings and notifications

- [ ] Save exact coordinates and valid garden timezone/location/climate; reject
      blank/partial coordinates and invalid climate fields
- [ ] Edit personal timezone, check time, minimum deficit, alert kinds, push
      consent, and overnight/non-overnight quiet hours
- [ ] Profile changes remain private while shared garden location changes are
      visible to both users
- [ ] Permission denied/unsupported/prompt/granted states are truthful
- [ ] Token registration/revocation state updates without claiming success early
- [ ] Notification history is private and shows exact title/body/link/outcome;
      sent push means provider accepted, not device displayed
- [ ] Below-threshold and disabled-kind watering alerts are ineligible
- [ ] Quiet-hour delivery defers to the correct local instant including DST
- [ ] Web background notification appears once and opens/focuses exact route
- [ ] Native background notification appears once and opens/focuses exact route
- [ ] Foreground message appears in-app without duplicate system notification

## Responsive and accessibility

- [ ] All routes work at 320, tablet, and desktop widths without horizontal page
      overflow, clipped controls, or unreachable actions
- [ ] 200% zoom preserves task completion and form submission
- [ ] Every input has a useful accessible name, hint/error association, and clear
      required state
- [ ] Heading order, landmarks, status/alert announcements, and nav current state
      are meaningful
- [ ] Modal focus moves in, traps, closes with Escape where safe, and returns to
      its launcher
- [ ] Visible focus, contrast, non-color status, touch targets, and reduced motion
      are adequate
- [ ] Plot editing has a keyboard alternative to drag

## Firebase security and isolation

- [ ] Non-member cannot read/write app paths
- [ ] Each member can read shared published/operations data
- [ ] One member cannot read another draft/profile/token/delivery receipt
- [ ] Direct client writes to automation/weather/balance/recommendation/alert/
      delivery data fail
- [ ] Direct client writes to workspace metadata/published/revisions fail
- [ ] Invalid operation/profile/publish shapes fail
- [ ] One member cannot overwrite/delete the other member's photo object

## Release smoke

- [ ] Live runtime has no mock/fallback/migration notice
- [ ] No unexplained console errors or failed boot requests
- [ ] Service worker update/reload behavior is coherent
- [ ] Both provisioned accounts pass the core flows
- [ ] Production watering labels/evidence match the actual saved crop groups
- [ ] VAPID is configured for web; every advertised native target has a valid
      FCM token path, platform file/signing, and physical-device result
- [ ] Push receipt/tap verified on every advertised platform
- [ ] Test records are explicitly approved and safely cleaned up
