# Style Pack Asset Inventory

## Asset files

### Brand

File:

- [src/assets/brand/BrandMarks.tsx](<repo-path>/src/assets/brand/BrandMarks.tsx)

Assets:

- `SeedPinLogo`
- `PlotMapLogo`
- `BloomMarkerLogo`
- `PrimaryLogoLockup`

Recommended usage:

- `SeedPinLogo`: app mark, header glyph, compact launcher contexts
- `PrimaryLogoLockup`: dev showcase, docs, settings/about surfaces if needed later
- `PlotMapLogo`: larger section art or onboarding-style moments
- `BloomMarkerLogo`: decorative secondary brand usage only

Animation hooks:

- `outline`
- `accent`
- `glyph`
- `halo`
- `motion-lines`

### Icon system

File:

- [src/assets/icons/GardenIcons.tsx](<repo-path>/src/assets/icons/GardenIcons.tsx)

Assets:

- `GardenGlyphIcon`
- `MapPinIcon`
- `SproutIcon`
- `WateringCanIcon`
- `DropletIcon`
- `SunIcon`
- `CloudIcon`
- `CalendarIcon`
- `ReminderBellIcon`
- `FoldedMapIcon`
- `PlotBedIcon`
- `LeafIcon`
- `FlowerIcon`
- `HarvestIcon`
- `SettingsIcon`

Recommended usage:

- app shell and navigation
- cards, badges, metadata rows
- reminders, care states, plot controls
- weather and schedule summaries

Animation hooks:

- `outline`
- `glyph`
- `motion-lines`

### Plant pins

File:

- [src/assets/icons/PlantPins.tsx](<repo-path>/src/assets/icons/PlantPins.tsx)

Assets:

- `PlantPin` component with tone variants
- supported tones: `neutral`, `green`, `tomato`, `marigold`, `sky`, `lavender`, `berry`
- supported states: `default`, `selected`, `dragging`, `ghost`, `completed`, `needs-attention`

Recommended usage:

- plot placement
- garden map markers
- plant state indicators
- future planting lists and schedule references

Animation hooks:

- `outline`
- `accent`
- `glyph`
- `hatch`
- `halo`
- `motion-lines`

### Illustrations

File:

- [src/assets/illustrations/GardenIllustrations.tsx](<repo-path>/src/assets/illustrations/GardenIllustrations.tsx)

Assets:

- `BotanicalDivider`
- `FoldedMapIllustration`
- `SproutSceneIllustration`
- `RouteLineIllustration`

Recommended usage:

- section dividers
- empty states
- onboarding or guidance panels
- map-adjacent helper visuals

Animation hooks:

- `outline`
- `accent`
- `hatch`
- `motion-lines`

## Asset naming conventions

Rules:

- components use PascalCase
- component files group one visual family
- IDs are descriptive and functional, not ornamental
- SVG groups use stable `data-layer` names instead of opaque flattened paths

Layer names in use:

- `outline`
- `accent`
- `glyph`
- `halo`
- `hatch`
- `motion-lines`
- `shadow`

These names are part of the animation contract. Future assets should reuse them where the layer meaning matches.

## Wrapper contract

All current asset components support a small shared prop surface:

- `className`
- `title`
- `size`
- `accentColor`
- `animated`

The pin family additionally supports:

- `tone`
- `state`

## Styling files

Supporting files:

- [src/styles/tokens.css](<repo-path>/src/styles/tokens.css)
- [src/styles/motion.css](<repo-path>/src/styles/motion.css)
- [src/styles/illustration.css](<repo-path>/src/styles/illustration.css)

Responsibilities:

- `tokens.css`: color, spacing, stroke, motion, radius, and base typography tokens
- `motion.css`: motion primitives and reduced-motion behavior
- `illustration.css`: layer styling, tint classes, pin states, and SVG-specific rules

## Showcase route

The live inventory and usage examples are rendered at:

- `/dev/style-pack`

Implementation:

- [src/features/style-pack/pages/StylePackShowcasePage.tsx](<repo-path>/src/features/style-pack/pages/StylePackShowcasePage.tsx)
- [src/features/style-pack/pages/StylePackShowcasePage.module.css](<repo-path>/src/features/style-pack/pages/StylePackShowcasePage.module.css)

## Future additions

When adding new assets:

1. reuse existing stroke and color logic
2. keep `data-layer` naming consistent
3. document the asset in this file
4. add it to the showcase route if it is intended for active use
5. avoid creating alternate styles that drift away from paper-plus-ink restraint
