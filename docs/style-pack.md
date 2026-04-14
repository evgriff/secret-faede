# Style Pack

## Purpose

This style pack is the single source of truth for the app’s visual language. It is designed for a personal garden-plot PWA that should feel hand-drawn, quiet, tactile, and useful.

The visual thesis is simple:

- the interface stays restrained
- personality comes from custom line art and motion
- most surfaces read as paper plus ink
- color is reserved for living things, pins, and meaningful state accents

This is not a cheerful marketing layer pasted over a utility app. It is a calm field-guide aesthetic with selective whimsy.

## Mood translation

The source inspiration resolves into four visual principles:

1. Botanical line art
   - loose stems
   - open petals
   - negative space
   - thin to medium stroke variation
2. Continuous-line map energy
   - route-like motion
   - travel-sketch rhythm
   - asymmetrical path flow
3. Chunky hand-drawn marker shapes
   - imperfect outlines
   - slightly uneven geometry
   - confident silhouettes
4. Sketch-map paper logic
   - folded-map shapes
   - selective hatch
   - marker-like borders

The output should feel like one person drew the art, then used color sparingly where the garden feels alive.

## Design principles

1. Keep the interface mostly neutral.
2. Let line work carry the identity.
3. Use accent color as a signal, not wallpaper.
4. Favor breathing room over decoration.
5. Animate once to clarify state, then stop.
6. Keep the art editable and understandable by future contributors.

## Token table

Core palette:

| Token                 | Value     | Role                             |
| --------------------- | --------- | -------------------------------- |
| `--color-paper`       | `#F7F4EE` | main background                  |
| `--color-paper-soft`  | `#EFEAE2` | secondary paper surface          |
| `--color-paper-muted` | `#E6E0D7` | muted paper panel or badge       |
| `--color-ink`         | `#1F1B18` | primary strokes and headings     |
| `--color-ink-soft`    | `#4E473F` | body copy                        |
| `--color-line-soft`   | `#6D655D` | dividers, hatch, secondary lines |

Accent palette:

| Token                    | Value     | Use                                       |
| ------------------------ | --------- | ----------------------------------------- |
| `--color-plant-green`    | `#73A36B` | healthy, active, established plant states |
| `--color-plant-tomato`   | `#D96C5B` | friendly urgency, intervention needed     |
| `--color-plant-marigold` | `#E4B64D` | timing, warmth, notable attention         |
| `--color-plant-sky`      | `#79AFC9` | water, weather, cooling signals           |
| `--color-plant-lavender` | `#A78BC6` | category differentiation                  |
| `--color-plant-berry`    | `#C66A88` | category differentiation                  |

Stroke tokens:

| Token                   | Use                       |
| ----------------------- | ------------------------- |
| `--stroke-icon-sm`      | small icons at 20–24      |
| `--stroke-icon-md`      | medium icons and pins     |
| `--stroke-illustration` | dividers and empty states |
| `--stroke-logo`         | logo glyphs               |

Motion tokens:

| Token               | Use                          |
| ------------------- | ---------------------------- |
| `--motion-micro`    | 120–180 ms control feedback  |
| `--motion-standard` | 200–320 ms state transitions |
| `--motion-draw`     | line reveals                 |
| `--motion-bloom`    | accent/petal/pulse entry     |

Implementation files:

- [src/styles/tokens.css](<repo-path>/src/styles/tokens.css)
- [src/styles/motion.css](<repo-path>/src/styles/motion.css)
- [src/styles/illustration.css](<repo-path>/src/styles/illustration.css)

## Color usage rules

Do:

- keep backgrounds and cards neutral
- use one accent per local interaction zone when possible
- use accent color in pins, badges, tiny details, and status moments
- make sure the UI still works in grayscale

Do not:

- fill large panels with accent colors
- create rainbow UI chrome
- use accent color as default card background
- turn neutral navigation into colorful tabs unless there is semantic need

Screen-area guidance:

- maps and plot surfaces: neutral
- plant pins: accent-friendly
- reminder states: marigold or tomato in small doses
- weather/watering cues: sky
- selected states: mostly line treatment and subtle halo, not full fills

## Stroke and line rules

All custom assets should use:

- rounded line caps
- rounded joins
- visible but controlled asymmetry
- simple editable path data

Rules:

- do not over-smooth everything into geometric perfection
- do not build overly dense path data
- avoid tiny ornamental lines that disappear on mobile
- keep the same stroke DNA across logos, pins, icons, and illustrations

The app should feel hand-drawn, not wobbly. Imperfection belongs in silhouette choices and path rhythm, not in unreadable controls.

## Surface rules

Containers stay calm:

- warm paper backgrounds
- restrained border treatment
- minimal shadow
- no glass, gloss, or theatrical elevation

The supporting rule is:

- UI containers are clean
- art assets are expressive

## Typography

Typography stays utilitarian:

- system UI sans stack only
- no handwriting font for body or labels
- calm editorial headings
- small labels remain highly legible

Brand character comes from the custom glyph system, not from decorative body typography.

## Icon construction rules

The icon family lives in [src/assets/icons/GardenIcons.tsx](<repo-path>/src/assets/icons/GardenIcons.tsx).

Rules:

- generous negative space
- mostly line art
- occasional fill only when it carries semantic meaning
- 24–32 scale thinking
- same rounded stroke behavior across the set
- avoid imported icon libraries in shipped UI

Icons included:

- garden glyph
- map pin
- sprout
- watering can
- droplet
- sun
- cloud
- calendar
- reminder bell
- folded map
- garden bed
- leaf
- flower
- harvest marker
- settings

## Illustration construction rules

Illustrations live in [src/assets/illustrations/GardenIllustrations.tsx](<repo-path>/src/assets/illustrations/GardenIllustrations.tsx).

Rules:

- line-first composition
- accent fills only in a few focal spots
- hatch stays sparse
- plenty of paper showing through
- illustrations should support the interface, not dominate it

Current motifs:

- botanical divider
- folded map scene
- sprout cluster
- route-line flourish

## Plant pin system

The plant pin family lives in [src/assets/icons/PlantPins.tsx](<repo-path>/src/assets/icons/PlantPins.tsx).

Core rules:

- one shared silhouette
- hand-touched teardrop form
- internal accent fill and sparse hatch
- small inner sprout glyph
- rough halo reserved for selected or attention states

Available tones:

- neutral
- green
- tomato
- marigold
- sky
- lavender
- berry

Available states:

- default
- selected
- dragging
- ghost
- completed
- needs-attention

Interaction guidance:

- selected: rough halo expands once
- dragging: tiny lift and 2–4 degree tilt
- ghost: low opacity and dashed outline
- completed: quieter fill and reduced visual urgency
- needs-attention: stronger warm/coral accent

## Logo directions

Logo assets live in [src/assets/brand/BrandMarks.tsx](<repo-path>/src/assets/brand/BrandMarks.tsx).

Direction A: Seed Pin

- pin silhouette with inner seed/sprout logic
- best small-size recognizability
- primary recommendation

Direction B: Plot Map Mark

- folded map panels plus embedded pin logic
- best for documentation and section art

Direction C: Bloom Marker

- pin logic blended with floral energy
- best as a secondary expressive mark

Primary recommendation:

- use Direction A as the app glyph and primary lockup

Why:

- reads clearly at small size
- works in one color
- connects location and plant meaning immediately
- supports the motion system without requiring animation

## Motion vocabulary

Motion must feel quiet and organic, never slick or game-like.

Vocabulary:

- `draw`: line reveal for dividers, maps, and glyph outlines
- `bloom`: accent or inner-shape appearance
- `settle`: small pop and settle for pin entry
- `nudge`: reminder or activation gesture
- `drift`: extremely rare and mostly demo-only
- `pulse-ring`: selection halo

Timing guidance:

- micro interaction: 120–180 ms
- standard interaction: 200–320 ms
- decorative reveal: 350–600 ms

Rules:

- one short gesture beats a loop
- perpetual motion should be rare
- motion should clarify state, not entertain

## Reduced motion rules

Every animated asset must remain meaningful when motion is reduced.

Fallback strategy:

- disable looping motion
- disable line-draw and bloom animations
- keep final visual state visible
- rely on opacity, contrast, or static halo rather than movement

`prefers-reduced-motion` support is implemented in:

- [src/styles/motion.css](<repo-path>/src/styles/motion.css)
- [src/styles/illustration.css](<repo-path>/src/styles/illustration.css)

## Usage recommendations by screen area

Bottom navigation:

- neutral container
- active state can use a tiny accent mark or underline
- icons stay monochrome unless meaning requires otherwise

Garden cards:

- neutral surface
- optional mini glyph or botanical divider
- accent color only for useful metadata or selection

Plot and map areas:

- neutral base field
- bed outlines can feel slightly hand-touched
- plant pins are the main accent focal point

Task and reminder cards:

- neutral card
- one custom icon
- small accent badge or icon tint only

Empty states:

- airy, line-first illustration
- no mascot energy
- illustration supports the prompt instead of competing with it

Badges:

- quiet paper chips
- occasional accent tint
- avoid multicolor pill systems

## Do / don’t

Do:

- keep the interface mostly neutral
- let line art provide the personality
- use color as a selective signal
- preserve stroke consistency
- preserve whitespace
- keep motion restrained and meaningful
- favor SVG and CSS over new dependencies
- make assets editable and animation-ready

Do not:

- import icon packs into the shipped visual system
- add decorative libraries for style alone
- make every card whimsical
- overuse color
- overuse hatch
- overuse looping motion
- create cute cartoon plants
- make the app feel juvenile
- let aesthetics overpower usability

## Future contributor guardrails

Future contributors must not:

- replace custom assets with Lucide, Heroicons, Material icons, or similar packs
- introduce animation libraries just to imitate hand-drawn motion
- add gradients, glass, gloss, heavy shadows, or 3D treatments
- convert neutral screens into accent-heavy surfaces
- use handwriting fonts for interface copy
- create more decorative assets than the product actually needs

When in doubt:

- simplify the UI container
- keep the custom line art
- remove color before removing whitespace
