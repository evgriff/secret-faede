# Motion Guidelines

Date: 2026-04-22

## Purpose

Motion in Secret Faeries should make the private garden workspace feel calm,
stable, and understandable. It is not decoration. It should explain where a
surface came from, what changed after an action, and how to recover from that
state without making the plot editor feel slippery.

This spec is written for the current app motion pass. It should guide
implementation before broad animation work starts.

## Current Implementation

- Prompt 18 wires the shared duration and easing tokens into the app style
  layer.
- Plan uses CSS/native browser motion for context panels, launcher popovers,
  crop focus, selected plant emphasis, contextual influence overlays, proposal
  previews, and shared modal/drawer/sheet surfaces.
- Prompt 50 extends the same tokenized choreography to the rest of the product:
  shared buttons and badges, shell status/demo controls, Today field-action
  confirmations and sheets, Feed composer mode switches and memory cards,
  Settings demo state changes, and Review proposal cards.
- Reduced-motion paths remove transform travel and keep state changes visible.
- No animation dependency has been added; a future dependency still requires an
  ADR before landing.

## Scope Guardrails

- Keep the app PWA-first and mock-first.
- Do not add a motion dependency by default.
- Prefer CSS transitions, CSS keyframes, the Web Animations API only where CSS
  cannot express the interaction cleanly, and small React state machines.
- If a library becomes necessary, add an ADR before the package lands. The ADR
  must prove that CSS/native browser APIs cannot keep the implementation small.
- Do not animate plot geometry as raw pixels. Saved positions remain canonical
  feet using `xFt` and `yFt`; motion may only interpolate rendered transforms.
- Do not use motion to imply collaboration, live social presence, maps, AI, or
  multi-garden behavior.

## Principles

1. **Cause and effect first.** A panel opens from the control that invoked it. A
   selected plant receives focus before details appear. An accepted task briefly
   confirms completion before leaving the active list.
2. **Keep the plot stable.** Plan canvas dimensions should not resize because a
   drawer, modal, or crop focus overlay appears. Secondary surfaces move over or
   beside the grid without making plant coordinates drift.
3. **Small distance, short time.** Most movement should be 4-12px. Bigger travel
   is allowed for sheets/drawers because their origin is spatial.
4. **One primary motion at a time.** If a panel slides, its contents should fade
   subtly, not also scale, bounce, and stagger.
5. **State beats flourish.** Completion, queued, saved, rejected, and applied
   states can use a short acknowledgement. Avoid celebratory effects.
6. **Outdoor readability.** Motion must not rely on subtle color shifts alone.
   Maintain clear pressed, selected, disabled, and completed states.
7. **Interruptible by design.** Users may tap quickly while outside. Animations
   should tolerate rapid open/close and not block core actions.

## Timing Tokens

Use shared CSS tokens before adding component-specific values:

| Token              | Duration | Use                                               |
| ------------------ | -------: | ------------------------------------------------- |
| `--motion-instant` |   `80ms` | Pressed feedback, tiny opacity shifts             |
| `--motion-micro`   |  `120ms` | Buttons, chips, selected states, warning emphasis |
| `--motion-short`   |  `160ms` | Popovers, crop focus, confirmation chips          |
| `--motion-medium`  |  `220ms` | Modals, drawers, bottom sheets                    |
| `--motion-long`    |  `320ms` | Rare full-screen composer/proposal transitions    |

Do not exceed `320ms` for normal UI. A longer transition needs a specific
reason in code review because the app is used while doing physical garden work.

## Easing

Use a small set of curves:

| Token             | Curve                            | Use                                     |
| ----------------- | -------------------------------- | --------------------------------------- |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)`     | Default enter/exit and transform motion |
| `--ease-out`      | `cubic-bezier(0.16, 1, 0.3, 1)`  | Surfaces entering or settling           |
| `--ease-in`       | `cubic-bezier(0.4, 0, 1, 1)`     | Surfaces leaving                        |
| `--ease-emphasis` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Selection focus or apply confirmation   |

Avoid bounce, spring, elastic, back-out, or physics curves unless an ADR
justifies the dependency and the interaction needs physical continuity.

## Property Rules

Prefer:

- `opacity` for reveal/hide and scrims.
- `transform: translate(...)` for sheets, drawers, crop focus cards, popovers,
  proposal previews, and small confirmation movement.
- `transform: scale(...)` only for tiny focus emphasis from `0.98` to `1`, never
  for the plot itself.
- `box-shadow` and border changes for selected, pressed, and active states.

Use carefully:

- `height`, `width`, `grid-template-*`, or other layout properties only when
  the user explicitly requested resizing that surface.
- `clip-path` only for contained reveal effects where overflow would otherwise
  look broken.

Do not animate:

- Saved plot dimensions, grid cell size, or canonical feet coordinates.
- Whole-route layout shifts around the Plan canvas.
- Scroll position, unless the browser is doing native focus management.
- Large color-only state changes without text or shape support.
- Background patterns, decorative blobs, bokeh, gradients, confetti, or idle
  loops.

## Surface Specs

### Plan Overlays

- Plot viewport remains fixed while overlays open.
- Desktop overlays should fade in and translate 6-10px from their anchor.
- Mobile bottom sheets should translate from the bottom by 100 percent to 0 with
  a scrim fade, using `--motion-medium`.
- Overlay exit should be slightly faster than enter: `120-180ms`.
- Opening an overlay must not reset zoom, pan, selection, or `xFt`/`yFt`.

### Plant Selection

- A tap or click changes selected node state immediately within
  `--motion-micro`.
- The selected node may use border, shadow, and a tiny scale up to `1.015`.
- Do not animate the node's saved position after selection.
- If details are available, show a small preview/crop focus overlay before any
  full inspector. The overlay should feel connected to the selected plant, not
  like a route change.

### Crop Focus Mode

- Crop focus enters with opacity plus 6px vertical movement, `--motion-short`,
  `--ease-out`.
- Matching plants should highlight together without stagger. Staggered crops
  read as decoration.
- Influence zones should fade in, not grow from zero. Their footprint is data,
  not a flourish.
- Closing crop focus should remove highlight and overlay together in under
  `160ms`.

### Panels, Drawers, And Bottom Sheets

- Desktop drawers slide only on their own axis and should not resize the canvas.
- Bottom sheets use transform-based entry. Contents should not animate
  separately except for a subtle opacity settle.
- Dismiss buttons, escape, outside click, and route changes should all share the
  same exit timing.
- A closed panel must leave a clear launcher or selected state behind.

### Compose Flows

- Feed and Today compose surfaces should open from the Compose or Plus trigger.
- Full-screen mobile composer entry can use `--motion-long` if it covers the
  whole route, but the text/photo draft must remain stable while closing.
- Switching composer modes uses instant content replacement or a short opacity
  transition. Do not slide mode forms horizontally like a carousel.
- Composer mode controls should use the same selected-state emphasis as
  segmented controls elsewhere: short scale/opacity feedback, no stagger, and
  no animation of the text/photo draft content itself.

### Review Proposal Previews

- Selecting a proposal should emphasize the chosen card and fade/translate the
  preview into place.
- Before/after plot previews should crossfade or swap with a subtle transform;
  do not animate every plant from old to new positions unless the proposal is a
  dedicated walkthrough and reduced motion is handled.
- Applying a proposal should show a brief "applied to draft" confirmation and
  then settle into the normal draft state.
- Review cards and generated-layout strategy cards share one motion model:
  selected cards emphasize in place, decided text appears as a confirmation,
  and before/after preview surfaces fade/translate into the existing review
  space rather than feeling like a separate product.

### Task Action Confirmations

- **Water done**, **Task done**, **Resolve**, **Accept**, and **Reject** use a
  short pressed state followed by a confirmation state.
- Removing a completed task from a list can fade/contract the row over
  `120-180ms`, but only after the completion state is visible long enough to be
  understood.
- Optional follow-up prompts, such as a photo after harvest, should appear as a
  calm sheet/popover. Routine watering and maintenance completions should not
  open media prompts.

### Shell, Settings, And Demo State

- Passive shell sync badges can remount with short status motion when the label
  changes, but they should remain visibly passive and never read like a button.
- Demo state changes use calm status motion on the existing shell/Settings
  controls. Entering, resetting, and exiting demo should be legible without a
  route-scale flourish or public-demo-funnel treatment.
- Settings panels may fade/translate into place on load, but form field values
  and notification preferences should not animate as if the app is changing
  them without user intent.

## Reduced Motion

Every new animation must include a `prefers-reduced-motion: reduce` path.

Reduced motion behavior:

- Disable transform travel.
- Keep opacity changes at or below `80ms`, or remove them entirely.
- Preserve state changes, focus outlines, selected styling, and status text.
- Do not replace motion with a jarring instant layout shift.
- Tests should include at least one reduced-motion smoke path when an
  implementation prompt changes shared overlays or Plan selection choreography.

CSS pattern:

```css
@media (prefers-reduced-motion: reduce) {
  .surface {
    animation: none;
    transition-duration: 1ms;
    transform: none;
  }
}
```

## Implementation Pattern

1. Start with CSS custom properties in the shared style layer.
2. Use data attributes for state when multiple components share one motion rule,
   such as `data-state="opening|open|closing"`.
3. Keep animation ownership local to the component that owns the state.
4. Avoid timers where possible. Prefer CSS transitions plus state that changes
   after the action completes.
5. If exit animation requires delayed unmount, use a small local hook and test
   the unmount behavior.
6. Keep visual tests stable by disabling animation in Playwright screenshots.
   Add interaction tests for state changes rather than snapshotting mid-motion.

## Acceptance Checklist

Before merging motion implementation work:

- The motion has a functional reason tied to orientation, causality, or state
  confirmation.
- The Plan canvas does not resize or drift because the motion runs.
- `prefers-reduced-motion` is respected.
- Keyboard and screen-reader flows do not depend on animation.
- The implementation uses CSS/native browser APIs, or an ADR justifies a
  dependency.
- Visual snapshots cover the settled state. Playwright or unit tests cover the
  transition-triggering interaction when behavior could regress.

## Dependency Policy

Do not add Framer Motion, React Spring, GSAP, Lottie, or similar libraries by
default. A future ADR may justify a focused dependency only if all of these are
true:

- The app needs interruptible enter/exit choreography across many mounted and
  unmounted React surfaces.
- CSS plus local hooks would create more code than the dependency removes.
- The dependency does not threaten bundle budgets, PWA startup, or reduced
  motion support.
- The need is part of the private garden editor, not a decorative marketing
  layer.
