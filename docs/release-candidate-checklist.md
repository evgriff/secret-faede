# Release Candidate Checklist

Date: 2026-04-22

## Scope Contract

Secret Faede is release-candidate only if it still reads as a private Garden OS
for one real home food garden:

- exactly two provisioned users behind Firebase Email/Password auth
- one shared published garden with private per-user drafts
- Plan, Today, Feed, and Settings as the working surfaces
- mock-first local and CI behavior, with Firebase and native shells additive
- geometry stored in feet with canonical `xFt` and `yFt`
- `AuthService`, `GardenRepository`, and `UserProfileRepository` as explicit
  architecture seams
- no public sign-up, multi-garden routing, social growth loops, marketplace
  behavior, maps, generic AI, dashboard-first surfaces, or carrier messaging

## Acceptance Snapshot

| Area                 | Candidate Status         | Evidence                                                                                                                                                           | Remaining Limit                                                                                     |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Plan                 | Ready for mock-mode demo | Canvas-first shell, individual plant nodes, crop focus, contextual influence, guided optimizer, Review diff, publish/revert, and visual baselines are implemented. | Real-device touch pass is still required for drag thresholds, handle size, and outdoor readability. |
| Today                | Ready for mock-mode demo | One-tap watering/task/stage actions, contextual harvest photo follow-up, compact field cards, and task cross-links are covered by unit and browser smoke.          | Water skip/dismiss/custom amount controls are not implemented.                                      |
| Feed                 | Ready for mock-mode demo | One **New entry** launcher, explicit composer modes, image-led private memory cards, offline text save copy, and photo caveats are covered by browser smoke.       | Offline photo binaries are not durably queued.                                                      |
| Review and optimizer | Ready for mock-mode demo | Generated layouts open a visual walkthrough, proposal diffs show material changes, physical moves require preview, and publish summarizes accepted decisions.      | Optimizer remains conservative and source-bound; it is not agronomic advice.                        |
| Demo controls        | Ready for mock-mode demo | Shell and Settings expose enter, reset, and exit controls; reset restores the Detroit baseline and exit restores the saved real draft.                           | Firebase-emulator stale nested document cleanup still needs broader coverage.                       |
| Notifications        | Ready for mock-mode demo | Settings and shell describe in-app history, push, local/native reminders, quiet hours, and delivery reasons only.                                                  | Live FCM delivery still needs production smoke.                                                     |
| PWA/native media     | Ready with caveats       | Browser picker/native-camera copy, previews, and offline media limitations are explicit.                                                                           | Native camera and local notification behavior still need device smoke after platform config.        |

## Automated Gate

Run and keep passing before tagging or demo handoff:

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run test:e2e`
- `npm run test:visual`
- `npm run build`
- `npm run ci`

The full `npm run ci` gate includes format check, dependency ADR guard,
documented large-file guard, lint, typecheck, unit tests, Firebase adapter
integration tests, emulator-backed rules tests, Functions build/tests,
production build, bundle analysis, bundle budget, Playwright E2E, and visual
regression.

## Manual Demo Rehearsal

1. Start `npm run dev` in mock mode and sign in with an allowlisted email.
2. Click **Enter demo** from the shell and confirm **Demo mode**, **Reset
   seeded demo**, and **Exit demo** are visible.
3. Open Plan. Confirm the 20 ft by 16 ft plot dominates, plant nodes are
   legible, structures are subordinate, and selecting a plant opens a calm crop
   focus card.
4. Add a three-plant crop, confirm quantity-first placement, adjust the
   arrangement, and verify each child node remains feet-based.
5. Open Optimize, generate layouts, inspect before/after diff, apply one safe
   candidate, and publish only after reading the summary.
6. Open Review, preview a proposal diff, accept one low-risk decision, and
   leave physical moves for deliberate one-at-a-time review unless the demo
   story needs them.
7. Open Today. Complete **Water done** or **Task done** in one tap, then log a
   harvest and confirm the optional photo follow-up is contextual.
8. Open Feed. Confirm image-led photo cards, the **New entry** launcher,
   explicit composer modes, target links back to Plan, and short empty states.
9. Toggle offline in the browser, save a text-only Feed entry, and confirm the
   app says photos need connection without claiming binary upload.
10. Open Settings, reset the seeded demo, then exit demo and confirm the saved
    real draft returns.

## Real-Device QA

Required before live tester release:

- iPhone Safari and Android Chrome PWA smoke for Plan drag, crop focus,
  bottom sheets, Today one-tap actions, Feed composer, offline text save, and
  photo picker.
- Native iOS and Android shell smoke after platform config for camera capture,
  push token registration, local reminders, notification permission states, and
  app icon/splash behavior.
- Outdoor readability pass for Plan nodes, Today actions, Feed photo cards,
  shell status copy, and touch target comfort.

## Production Setup Still Manual

- Configure Firebase project, web app, authorized domains, Firestore indexes,
  Firestore rules, Storage rules, Functions, and Hosting.
- Provision only Primary Gardener and Partner Gardener, then set `gardenAccess: true` and
  `secretFaedeMember: true` custom claims.
- Set required `VITE_*` repository variables, including the FCM web push VAPID
  key.
- Smoke live Auth, Firestore, Storage photo upload, FCM foreground/background
  delivery, and weather refresh.
- Add native Firebase config files outside the repository before native push or
  camera demos.
- Do not configure carrier-delivery providers or phone-number seed data.

## Known Limits

- `Pasted text.txt` was not present in the checkout during the final sweep, so
  local acceptance relied on the prompt-chain requirements and repo docs.
- Offline photo upload is intentionally honest rather than queued.
- Live Firebase, FCM, Storage, and weather-provider behavior are not proven by
  mock-mode Playwright alone.
- Real-device touch QA remains the biggest release-demo risk because the Plan
  redesign is interaction-heavy.
- The offline crop catalog remains a large intentional route chunk protected by
  the bundle budget.
- Paid tiers, exports, inventory planning, public sharing, and additional user
  management are outside this release candidate.

## Go / No-Go

Go for a mock-mode release demo after the automated gate passes and the manual
demo rehearsal completes once on desktop and mobile browser sizes.

No-go for production tester launch until live Firebase setup, FCM delivery,
Storage upload, weather refresh, and real-device touch QA are complete.
