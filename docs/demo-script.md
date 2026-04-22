# Demo Script

Date: 2026-04-21

## Setup

- Use mock runtime unless demonstrating Firebase specifically.
- Start with `npm run dev`.
- Sign in with an allowlisted email and the mock password `password`.
- Open Settings and click **Load demo garden**.
- Use **Reset demo** before a meeting to restore the stable Detroit baseline;
  it should put the watering check back to 7:15 AM even if the prior demo
  changed settings.
- Never commit a demo phone number. Demo or dev phones must come only from
  `DEFAULT_ALERT_PHONE_E164`.

## Story

Secret Faede is a Garden OS for one real home food garden. The demo shows the
closed loop: Plan the plot, run Today, capture the Feed, and control trust in
Settings.

## Demo Garden

The sample garden loads **Sample Kitchen Garden** in Detroit, MI.

It includes:

- a 20 ft by 16 ft plot
- three beds, an access path, trellis, water source, compost bay, and shade tree
- anchored peas, lettuce, radishes, and spinach that represent real planted work
- movable planned tomatoes, pepper, cilantro, and carrot succession ideas
- a season board with tomatoes, cucumber, parsley, and cilantro ready for
  re-optimization
- active Review proposal-inbox items for tomato support, cucumber support,
  pepper sun mismatch, rotation history, and a narrow access path
- a summer sun layer with manual shade corrections
- a high-priority watering recommendation
- due tasks for watering, harvest, issue inspection, trellis, mulch, and
  succession review
- issue, note, photo, harvest, and notification history examples
- coherent Detroit alert settings

## Step-By-Step

1. Auth
   Open `/`, enter an allowlisted email and password, keep **Remember this
   device** on, and sign in. Mention that Firebase Email/Password auth remains
   behind `AuthService` and there is no public sign-up path.

2. First-run
   On a fresh user, show the setup flow briefly: garden name, location, timezone,
   USDA zone, editable frost dates, plot type, size, templates, and blank plan.
   Then go to Settings and load the demo garden for the main story.

3. Settings demo controls
   Click **Load demo garden**. Show the Detroit profile, 7:15 AM watering
   check, quiet hours, notification channels, consent copy, and notification
   center. Mention that carrier messaging is backend-only and remains dry-run unless
   compliance and consent are ready.

4. Plan
   Open Plan. Show the feet-based plot, beds, path, trellis, shade tree, crops,
   and saved dimensions. Switch to Optimize and show the compact Plan health
   panel separately from the Proposal inbox. Point out the small, useful issue
   set: narrow path, tomato cage, pepper shade, and rotation history. Do not
   present the demo as broken; it is a plausible draft with a few decisions to
   make.
   Open **Choose plants** and show the preloaded season board: two Roma
   tomatoes, a trellised cucumber row, parsley, and cilantro. Adjust one
   quantity or priority, then save the list. Click **Optimize**, compare the
   named candidates, and use before/after preview to show that rough
   `[auto-layout]` planned ideas can move while planted/growing crops remain
   anchored. Apply the clearest candidate and confirm the draft updates
   immediately with proposed cucumber trellis and tomato cage materials.
   Select a crop that is already planted or growing and show the anchored
   lifecycle signal, optimizer mobility copy, and explicit **Allow relocation**
   control. Explain that planned crops are still movable ideas, while
   planted/growing crops stay fixed unless the gardener chooses to treat them as
   movable.
   In Review, point out that planned-only moves and physical-move requests are
   labeled differently. Accept a planned-only proposal; avoid accepting a
   physical move unless the story is explicitly about updating the plan after a
   real-world transplant.
   Switch to Structure mode, show that paths can use accessible 4 ft defaults,
   then select the saved path or trellis and show material, continuity, working
   clearance, and footprint details in the inspector instead of a crowded main
   toolbar.
   In Plan operations, point out that the material list now derives bed
   dimensions, path surface area, trellis length, and crop cage/stake/trellis
   suggestions from the saved plan, plus completeness add-ons like mulch and
   seasonal row cover when the current crop mix and dates justify them.
   Show the draft/published badge, save the private draft, open **Publish**, and
   point out changed items, accepted Review proposals, rejected/snoozed
   decisions, and the revision history/revert path. Use **Revert** only after
   publishing or after explaining that Reset demo restores the baseline.

5. Sun/shade
   Switch to Sun/Climate mode. Show the spring, summer, and fall season
   controls, the direct-sun hour legend, and the modeled shade-source counts.
   Point out that walls/fences, trees/obstacles, and tall or trellised crops can
   influence the modeled layer. Paint one observed cell, then refresh the model
   and show that manual cells are preserved. Select a crop and show the Care tab
   language: **good fit**, **workable**, or **will likely underperform**, plus
   source-aware advice for tree, structure, or tall-crop shade and conservative
   microclimate notes such as west heat, reflected heat, cool shade pocket, or
   wind-exposed edge.

6. Watering
   In Plan operations, show the latest weather snapshot and the active
   recommendation for the roots and salad bed. Point out rationale, data quality,
   and refreshed time.

7. Today
   Open Today. Show urgent alerts, the watering card, due tasks, bed attention,
   harvest-ready radishes/lettuce, and unresolved lettuce issue. Complete or
   snooze a low-risk task only after explaining Reset demo can restore the
   baseline.

8. Feed
   Open Feed. Show the compact activity stream, pinned unresolved slug issue,
   pea trellis media update, watered-bed note, task completion, publish entry,
   and harvest card. Use the type/crop/bed/season filters to show how the feed
   narrows without becoming an admin table. Open the composer with **Post** or
   **Issue** to show the separate entry flow; log a short field note and, if
   time allows, log a partial radish harvest. Reset demo afterward.

9. Offline
   If time allows, toggle browser offline, open **Post**, save a text note in
   Feed, and show **Queued locally**. Do not claim offline photo upload.

10. Reload
    Reload the app and confirm the demo garden persists. Close with the loop:
    the plan drives today, today feeds the Feed, and the Feed improves future
    planning.

## Closing Line

Secret Faede is not another static garden planner. It is a calm operating system
for the one garden a household actually depends on.
