# Garden Workspace Persistence

Canonical contract:

- one shared published workspace at `gardenWorkspaces/main`
- workspace schema 2, plan schema 9, and one current published revision ID
- one private draft per authenticated member
- shared journal, harvest, task, and water-application records
- server-owned weather, balance, recommendation, alert, and automation output
- legacy `gardens/{uid}` and older workspace shapes are one-way migration inputs,
  never active v2 persistence

Firestore paths:

- metadata: `gardenWorkspaces/main`
- published plan: `gardenWorkspaces/main/plans/published`
- private drafts: `gardenWorkspaces/main/drafts/{uid}`
- publish history: `gardenWorkspaces/main/revisions/{revisionId}`
- journal: `gardenWorkspaces/main/journal/{entryId}`
- harvests: `gardenWorkspaces/main/harvests/{harvestId}`
- tasks: `gardenWorkspaces/main/tasks/{taskId}`
- explicit applied/skipped water:
  `gardenWorkspaces/main/waterApplications/{applicationId}`
- per-crop balance:
  `gardenWorkspaces/main/waterBalances/{plantingGroupId}`
- per-crop recommendation:
  `gardenWorkspaces/main/wateringRecommendations/{plantingGroupId}`
- weather snapshots: `gardenWorkspaces/main/weatherSnapshots/{snapshotId}`
- shared alerts: `gardenWorkspaces/main/alerts/{alertId}`
- profiles/tokens/private receipts: `users/{uid}` plus `pushTokens` and
  `notificationDeliveries`
- photo objects:
  `gardenWorkspaces/main/journal/{entryId}/{uid}/{photoId}-{fileName}`

Repository contract:

- `GardenRepository` is the only client workspace boundary. UI modules receive
  a `GardenWorkspaceView` and never write Firestore directly.
- `UserProfileRepository` separately owns the signed-in user's profile.
- Draft save validates schema/geometry and preserves its expected published
  revision. Authenticated Functions callables own publish, revert, and shared
  location/climate publication. They verify both claims and the complete plan,
  then transactionally create a revision and update published/metadata linkage.
- Firestore rules deny clients any direct metadata, published-plan, or revision
  write. Shared-settings publication preserves unrelated published plan content
  and rebases an existing actor draft.
- A mismatch returns a conflict; the repository never silently overwrites the
  other account's publication.
- Operation records validate stable IDs/owners/targets. Active mock/Firebase
  adapters return committed only after their authoritative storage/SDK/callable
  operation succeeds, or propagate an error. The shared result type's `queued`
  variant is an unused extension seam, not an offline guarantee.
- Mock repositories mirror validation, conflicts, subscriptions, per-user
  isolation, schema normalization, and operation semantics in localStorage.

Watering persistence:

- every active `PlantingGroup.id` owns its own saved water-profile snapshot,
  balance document, recommendation document, and application ledger slice
- unrelated crops are never pooled, even when they share a structure or zone
- applied/partial water records require an explicit amount/efficiency and credit
  only that amount; skipped records require a reason and contain no credit
- every application is actor-attributed and revisioned; correction keeps the
  same ID/crop/original recorder and replaces ledger credit at revision +1
- Functions commit balances/recommendations only if the claimed published
  revision and shared application fingerprint still match
- stable model/revision/profile fingerprints and application IDs prevent
  double-credit after retries

Migration and offline behavior:

- `scripts/migrate-workspace-v2.mjs` is dry-run by default, creates a private
  backup first, produces deterministic/idempotent v2 writes, and requires
  explicit `--apply`. It preflights every published/draft/revision source,
  redacts report identities, emits zero actions while blockers remain, and
  refuses apply before the first write.
- The 2026-07-10 production dry run is `canApply: false`: 105 geometry blockers
  remain because legacy plantings have no bed/container growing areas, with
  additional instance/plot containment issues. No production write was made.
- Ambiguous legacy water notes are warned and uncredited. Invalid coordinates
  are cleared; invalid timezones become `UTC`; no city fallback is introduced.
- no active repository promises durable offline synchronization for text,
  profile, operation, publish, revert, or settings commands
- photo bytes have no durable offline queue

Primary local sources:

- `docs/architecture.md`
- `docs/firebase.md`
- `docs/data-model.md`
- `docs/deployment.md`
- `README.md`
