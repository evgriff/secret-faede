# Demo Script

Date: 2026-04-24

## Setup

- Use mock runtime unless demonstrating Firebase specifically.
- Start with `npm run dev`.
- Sign in with an allowlisted email and the mock password `password`.
- Open **Settings** and use **Open sample garden** to load the seeded Detroit
  example. While the sample is active, the shell exposes **Back to my garden**
  on every route.
- Use **Reset sample garden** before a meeting to restore the seeded Detroit
  baseline; it should put the watering check back to 7:15 AM even if the prior
  walkthrough changed settings or completed work.
- Use **Back to my garden** after the walkthrough to restore the garden draft
  saved before the sample was opened on this device and stay on the current
  route whenever possible.
- Never enter, seed, or commit off-scope contact-delivery test data.

## Story

Secret Faeries is for one real home food garden. The sample garden shows the
closed loop: place the garden in Plan, do the work in Today, remember it in
Feed, and keep the defaults trustworthy in Settings.

## Sample Garden

The sample garden loads **Sample Kitchen Garden** in Detroit, MI.

It includes:

- a 20 ft by 16 ft plot
- three beds, one main path, and one saved trellis
- active cool-season crops plus a few planned warm-season moves
- Detroit location, timezone, frost dates, and watering defaults
- one clear layout suggestion instead of a compare-many optimizer deck
- one real watering schedule entry tied to weather, crop need, and bed context
- due work in Today for watering, harvest, issue follow-up, support staging,
  mulch prep, and succession timing
- watering, issue, note, photo, harvest, publish, and alert history in Feed
- sample controls in Settings plus **Back to my garden** in the shell

## Step-By-Step

1. Auth
   Open `/`, enter an allowlisted email and password, keep **Stay signed in on
   this trusted device** on, and sign in. Mention that Firebase Email/Password
   auth remains behind `AuthService` and there is no public sign-up path.

2. First-run
   On a fresh user, show the setup flow briefly: garden name, plot type, plot
   size, starter layouts, and Blank plan. Open **Optional location and climate**
   only to show that location, timezone, USDA zone, and frost dates can still be
   refined without blocking the first entry.

3. Sample garden controls
   Open Settings and show the sample-garden card. Point out that **Open sample
   garden** loads a resettable Detroit example, **Reset sample garden**
   restores the seeded baseline, and **Back to my garden** restores the saved
   real garden from this device. Once the sample is active, point out the shell
   banner so the return path stays obvious outside Settings.

4. Plan
   Open Plan. Show the feet-based plot, beds, path, trellis, crop nodes, and
   saved dimensions. Explain that the draft is plausible already: peas and cool
   crops are anchored, while warm-season ideas are still planned and movable.
   Open **Generate layout** and show the practical review flow:
   **What needs attention**, one **Layout suggestion**, one before/after
   preview, one summary of why the suggestion helps, and **Apply this layout**
   or **Keep current layout**. The point is not planner cleverness; it is one
   checked arrangement that keeps crops reachable and support simpler.
   Open **Add plants** and show that Detroit drives the picker: search works
   normally, but the saved location and timing help surface what fits now or
   soon. Mention that tomatoes and peppers are still future transplants here,
   while cool-season crops already in the sample are planted now.

5. Today
   Open Today. Show **Watering work** first. Point out that the due card is a
   schedule entry, not a generic recommendation: it has an amount, a target,
   weather-linked reasoning, and direct field actions for **Water done**,
   **Partial watering**, **Skip for rain**, **Snooze to tonight**, **Snooze to
   tomorrow**, and **Adjust amount**. Then show the rest of the day: harvest
   work, the open slug issue, and the staged support and succession tasks.
   Mention that Today is the work surface, so alerts should bring the gardener
   back here rather than create a second dashboard.

6. Feed
   Open Feed. Show the watering history entry, the pinned slug issue, the pea
   trellis photo update, the radish harvest photo memory, and the publish/task
   entries. If time allows, log a short field note or a partial radish harvest.
   Use filters briefly to show that Feed narrows cleanly without turning into an
   admin table.

7. Settings
   Return to Settings and show that location, timezone, watering check time,
   quiet hours, and push/in-app preferences remain the single source of truth
   for alerts and schedule timing. Change the watering check time, save, then
   use **Reset sample garden** to show that the seeded baseline comes back clean.

8. Restore
   Use **Back to my garden** from the shell or Settings. Confirm the saved real
   garden draft returns and that the app stays on the current route whenever it
   can.

## Closing Line

Secret Faeries is not a planner deck. It is a calm working app for the one garden
someone actually maintains.
