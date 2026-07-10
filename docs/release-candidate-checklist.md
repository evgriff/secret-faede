# Release candidate checklist

## Scope

- [ ] One shared garden; exactly two provisioned password accounts
- [ ] Plan, Today, Feed, and Settings remain the only product workspaces
- [ ] No multiple gardens, public registration/onboarding, dashboards, charts,
      maps, collaboration, lore, AI, carrier messaging, or email delivery
- [ ] Weather/tasks/journal/notifications directly support the real plot

## Data and persistence

- [ ] Active client is only `src/v2`; the removed client is not present or
      mounted, and legacy data is read only by explicit migration readers
- [ ] Workspace/profile/plan versions are 2/2/9
- [ ] Plot, structures, crop groups, and instances persist feet, never pixels
- [ ] One private draft per user; published plan/operations shared
- [ ] Expected-revision conflicts never overwrite another publish
- [ ] Firestore denies direct metadata/published/revision writes; authenticated
      callables own publish, revert, and shared climate publication
- [ ] Production migration dry run, 0600 backup, warnings, apply, and idempotent
      rerun are complete
- [ ] Rules deny all legacy/fallback paths and server-owned output writes

## Watering accuracy

- [ ] One independent balance/recommendation per active crop-group ID
- [ ] Saved crop water profile/version used; no mutable runtime catalog lookup
- [ ] Root depth, soil/depth/drainage, container, mulch, stage, area, weather,
      prior balance, applications, and efficiency are represented
- [ ] Stage/stage-source/coefficient and profile/weather provenance are explicit
- [ ] Applied/partial/skipped records are actor-attributed and revisioned;
      correction replaces prior credit without changing crop or recorder
- [ ] Skipped and unknown-amount applications receive zero invented credit
- [ ] Gallons appear only with reliable saved area
- [ ] Missing/stale evidence downgrades confidence or requests a soil check
- [ ] Null coordinates never become Detroit, `0,0`, or another fallback
- [ ] Safe mode still generates crop soil checks and non-weather tasks, without
      automatic weather/watering push
- [ ] Same inputs produce byte-stable semantic output/reason order
- [ ] Separate crop alerts cannot overwrite one another; retries do coalesce

## Complete user flows

- [ ] Sign-in, restore, sign-out, denied access, and recovery states
- [ ] Setup, plot settings, structures, crop groups/instances, drag and keyboard
      movement, inspectors, review decisions, layout preview/apply
- [ ] Save/discard/publish/history/revert/conflict states
- [ ] Today watering cards, applied/partial/skipped logs, exact task actions
- [ ] Feed note, issue, photo, harvest, and water activity
- [ ] Settings validation, thresholds, consent, quiet hours, device/delivery state
- [ ] Offline/runtime banners make no unsupported durable-queue promise; pending,
      committed, conflict, and failed outcomes are distinct
- [ ] Exact deep links and focus restoration

## Notifications

- [ ] Per-user kind, threshold, consent, timezone, and quiet hours enforced
- [ ] Quiet-hour alerts defer and retry idempotently
- [ ] Web data-only and native notification-plus-data payloads verified
- [ ] Foreground receipt creates one in-app alert without duplicate system UI
- [ ] Invalid tokens retire; private receipt records include title/body/link
- [ ] Sent push is labeled provider-accepted, not device-delivered
- [ ] Real background receipt/tap tested on each advertised platform

## Quality gate

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run quality:serena`
- [ ] `npm run test:unit`
- [ ] `npm run test:e2e`
- [ ] `npm run build`
- [ ] `npm run ci`
- [ ] Browser console/network clean on desktop and 320-pixel viewport
- [ ] Visual changes reviewed rather than blindly rebaselined

## Production

- [ ] Exact project ID and browser config verified
- [ ] Protected `FIREBASE_PROJECT_ID` equals public
      `VITE_FIREBASE_PROJECT_ID`
- [ ] Auth domains and Email/Password provider configured
- [ ] Exactly two intended users carry both access claims
- [ ] NWS identity and optional Tomorrow.io server configuration verified
- [ ] Live workflow creates the mode-0600 Functions environment file with the
      configured NWS identity before deployment
- [ ] Production VAPID key is present and web push is device-tested
- [ ] Android is not advertised while `google-services.json` is absent
- [ ] iOS is not advertised until a real FCM token path is device-tested
- [ ] Last known-good release and migration backup retained
- [ ] Quality and Hosting Live workflows both pass (not skip)
- [ ] Two-account production smoke completes

Release is no-go if any safety, migration, authorization, push, or complete-CI
item is unknown.
