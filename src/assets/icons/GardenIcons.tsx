import type { ReactNode } from 'react';

import {
  createAssetStyle,
  joinAssetClasses,
  renderAssetTitle,
  type SvgAssetProps,
} from '../assetUtils';

interface IconDefinition {
  component: (props: SvgAssetProps) => ReactNode;
  label: string;
  name: string;
}

function IconFrame({
  accentColor,
  animated = false,
  children,
  className,
  size = 28,
  title,
}: SvgAssetProps & { children: ReactNode }) {
  return (
    <span
      className={joinAssetClasses(
        'asset',
        animated && 'motion-draw',
        className,
      )}
      style={createAssetStyle(accentColor, size)}
    >
      <svg
        aria-hidden={title ? undefined : true}
        fill="none"
        role={title ? 'img' : 'presentation'}
        viewBox="0 0 32 32"
      >
        {renderAssetTitle(title)}
        {children}
      </svg>
    </span>
  );
}

export function GardenGlyphIcon(props: SvgAssetProps) {
  return (
    <IconFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-icon-sm)">
        <path d="M7 24.5V11.2c3.2 0.8 5.3 2.6 6.7 5.6 1.7-2.7 4.4-4.6 8.3-5.6v13.3" />
        <path d="M6.5 24.5h18.9" />
        <path d="M13.8 16.8v7.7" />
        <path d="M19.3 14.3v10.2" />
      </g>
    </IconFrame>
  );
}

export function MapPinIcon(props: SvgAssetProps) {
  return (
    <IconFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-icon-sm)">
        <path d="M16.4 4.9c4.8 0 8.6 3.5 8.6 9 0 4-2.2 6.9-5.1 10.3-1.5 1.8-2.6 3.3-3.7 5.7-1.1-2.3-2.4-3.9-4.2-6.1-2.7-3.2-4.6-5.8-4.6-9.9 0-5.4 3.8-9 9-9Z" />
        <path d="M16.1 11.4c1.8 0 3.2 1.4 3.2 3.2s-1.4 3.1-3.2 3.1-3.2-1.3-3.2-3.1 1.4-3.2 3.2-3.2Z" />
      </g>
    </IconFrame>
  );
}

export function SproutIcon(props: SvgAssetProps) {
  return (
    <IconFrame {...props}>
      <g data-layer="glyph" strokeWidth="var(--stroke-icon-sm)">
        <path d="M16.1 24.8v-9.4" />
        <path d="M15.9 15.7c-3.9-0.2-7.1-2.7-8.3-6.7 4.7 0.2 7.5 2.1 8.3 6.7Z" />
        <path d="M16.2 15.1c0.7-4.3 3.7-7.1 8.2-8 0 4.8-2.5 7.8-8.2 8Z" />
        <path d="M12 24.7h8.4" />
      </g>
    </IconFrame>
  );
}

export function WateringCanIcon(props: SvgAssetProps) {
  return (
    <IconFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-icon-sm)">
        <path d="M9.5 21.7h11.8l-1.8-9.4h-8.1c-1 3.2-1.7 6.4-1.9 9.4Z" />
        <path d="M19.1 12.2c1.7-0.4 3.3-0.3 4.9 0.5" />
        <path d="M20.7 15.5c2.3-0.1 4.1 0.5 5.6 1.9" />
        <path d="M10.4 14.3c-0.7-2.8 0.6-4.8 3.8-5.6 1.4-0.4 3.2-0.2 5.2 0.4" />
        <path d="M23.8 18.5l2.1 1" />
      </g>
      <g data-layer="motion-lines" strokeWidth="1.7">
        <path d="M25.8 20.4c0.2 1.4-0.1 2.5-0.8 3.4" />
        <path d="M23.8 21.3c0.2 1.2 0.1 2.2-0.4 3.1" />
      </g>
    </IconFrame>
  );
}

export function DropletIcon(props: SvgAssetProps) {
  return (
    <IconFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-icon-sm)">
        <path d="M16.1 5.8c4.7 6.2 7 10.1 7 13.6 0 4.2-3 7.2-7.1 7.2-4 0-7-3-7-7.1 0-3.2 2.2-7.2 7.1-13.7Z" />
      </g>
    </IconFrame>
  );
}

export function SunIcon(props: SvgAssetProps) {
  return (
    <IconFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-icon-sm)">
        <circle cx="16" cy="16" r="5.2" />
        <path d="M16 4.9v3.3" />
        <path d="M16 23.8v3.3" />
        <path d="M4.9 16.1h3.3" />
        <path d="M23.8 16.1h3.3" />
        <path d="M8.1 8.1l2.4 2.4" />
        <path d="M21.5 21.5l2.4 2.4" />
        <path d="M8 24l2.5-2.5" />
        <path d="M21.5 10.5 24 8" />
      </g>
    </IconFrame>
  );
}

export function CloudIcon(props: SvgAssetProps) {
  return (
    <IconFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-icon-sm)">
        <path d="M10.2 23.1h11.2c3.2 0 5.6-1.9 5.6-4.7 0-2.6-2-4.5-4.9-4.6-0.7-3.6-3.4-5.6-6.7-5.6-3.5 0-6.2 2.2-6.9 5.4-2.6 0.3-4.6 2.2-4.6 4.8 0 2.8 2.3 4.7 6.3 4.7Z" />
      </g>
    </IconFrame>
  );
}

export function CalendarIcon(props: SvgAssetProps) {
  return (
    <IconFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-icon-sm)">
        <path d="M7.2 8.4h17.5v16.6H7.2Z" />
        <path d="M11.2 5.8v5" />
        <path d="M20.7 5.8v5" />
        <path d="M7.2 13.4h17.5" />
        <path d="M11 17.4h3" />
        <path d="M18 17.4h3" />
        <path d="M11 21.1h3" />
      </g>
    </IconFrame>
  );
}

export function ReminderBellIcon(props: SvgAssetProps) {
  return (
    <IconFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-icon-sm)">
        <path d="M11 21.9h10.2c-1-1.5-1.5-3.1-1.5-4.9v-3.3c0-2.7-1.5-4.8-3.7-5.6-2.4 0.8-4 2.9-4 5.7V17c0 1.9-0.4 3.5-1 4.9Z" />
        <path d="M14 23.2c0.4 1.8 1.3 2.7 2.8 2.7 1.4 0 2.3-0.8 2.7-2.7" />
      </g>
      <g data-layer="motion-lines" strokeWidth="1.7">
        <path d="M9.1 11.2c-0.9 0.7-1.5 1.7-1.9 2.9" />
        <path d="M23 11.2c0.9 0.7 1.6 1.7 2 2.9" />
      </g>
    </IconFrame>
  );
}

export function FoldedMapIcon(props: SvgAssetProps) {
  return (
    <IconFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-icon-sm)">
        <path d="M5.9 9.6 12 7.3l7.1 2.8 6.9-2.5v14.8L19 25l-7-2.7-6.1 2.2Z" />
        <path d="M12 7.5v14.8" />
        <path d="M19 10.1v14.8" />
        <path d="M16.3 12.8c2.5 0.3 4.2 1.6 5.4 4" />
      </g>
    </IconFrame>
  );
}

export function PlotBedIcon(props: SvgAssetProps) {
  return (
    <IconFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-icon-sm)">
        <rect x="7.3" y="10.4" width="17.4" height="11.4" rx="2.8" />
        <path d="M11.2 14.2h9.6" />
        <path d="M11.2 18h5.3" />
      </g>
    </IconFrame>
  );
}

export function LeafIcon(props: SvgAssetProps) {
  return (
    <IconFrame {...props}>
      <g data-layer="glyph" strokeWidth="var(--stroke-icon-sm)">
        <path d="M8.2 19.7c0-7 6.1-11.6 15.7-12.8-0.4 10.1-5.1 16-12.4 16-2.1 0-3.3-1.1-3.3-3.2Z" />
        <path d="M11.4 21.7c3.1-5.5 7.2-9.4 12.4-11.8" />
      </g>
    </IconFrame>
  );
}

export function FlowerIcon(props: SvgAssetProps) {
  return (
    <IconFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-icon-sm)">
        <path d="M16 10.6c0-1.9 1-3.4 2.4-4.6 1.7 1.2 2.7 2.8 2.7 4.8-1.2 0.7-2.6 1-4.1 1.1-0.5-0.2-0.8-0.6-1-1.3Z" />
        <path d="M16 10.8c-1.9-0.1-3.5-0.8-4.9-2.2 0.9-1.8 2.4-3 4.5-3.4 1.2 1.2 1.9 2.9 1.8 5.1Z" />
        <path d="M15.8 11.4c1.5 0.1 3 0.7 4.2 1.8-0.6 2-1.8 3.6-3.7 4.6-1.5-1.2-2.2-2.8-2.3-4.9Z" />
        <path d="M15.3 11.6c-0.4 2.1-1.5 3.8-3.5 5-1.9-0.7-3.2-2.1-3.9-4.2 1.7-1.2 3.5-1.7 5.5-1.6Z" />
        <path d="M16 17.8v8.1" />
      </g>
    </IconFrame>
  );
}

export function HarvestIcon(props: SvgAssetProps) {
  return (
    <IconFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-icon-sm)">
        <path d="M8.2 15.7h15.6l-1.4 8.4H9.5Z" />
        <path d="M11 15.8c0-2.9 2.3-5.1 5.2-5.1 2.8 0 5.1 2.2 5.1 5.1" />
        <path d="M13.2 19.1c1.1 1.3 2 2 2.8 2.3" />
        <path d="M19.3 19.1c-0.9 1.1-1.7 1.8-2.6 2.3" />
      </g>
    </IconFrame>
  );
}

export function SettingsIcon(props: SvgAssetProps) {
  return (
    <IconFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-icon-sm)">
        <path d="M16 10.2a5.9 5.9 0 1 0 0 11.8 5.9 5.9 0 0 0 0-11.8Z" />
        <path d="M16 4.9v3" />
        <path d="m21.2 7.2-1.7 2.5" />
        <path d="m25.8 12-3 0.5" />
        <path d="m24.6 19.3-2.5-1.5" />
        <path d="m19.3 24.8-1.2-2.8" />
        <path d="m12.4 24.8 1-2.8" />
        <path d="m7.4 20.5 2.4-1.7" />
        <path d="m6.2 12.7 2.9 0.3" />
        <path d="m10.2 7.2 1.6 2.5" />
      </g>
    </IconFrame>
  );
}

export const gardenIconRegistry: IconDefinition[] = [
  {
    component: GardenGlyphIcon,
    label: 'App garden glyph',
    name: 'garden-glyph',
  },
  { component: MapPinIcon, label: 'Map pin', name: 'map-pin' },
  { component: SproutIcon, label: 'Sprout / germination', name: 'sprout' },
  { component: WateringCanIcon, label: 'Watering can', name: 'watering-can' },
  { component: DropletIcon, label: 'Water droplet', name: 'droplet' },
  { component: SunIcon, label: 'Sun', name: 'sun' },
  { component: CloudIcon, label: 'Cloud', name: 'cloud' },
  { component: CalendarIcon, label: 'Calendar', name: 'calendar' },
  {
    component: ReminderBellIcon,
    label: 'Reminder bell',
    name: 'reminder-bell',
  },
  { component: FoldedMapIcon, label: 'Folded map', name: 'folded-map' },
  { component: PlotBedIcon, label: 'Garden bed', name: 'plot-bed' },
  { component: LeafIcon, label: 'Leaf', name: 'leaf' },
  { component: FlowerIcon, label: 'Flower', name: 'flower' },
  { component: HarvestIcon, label: 'Harvest marker', name: 'harvest' },
  { component: SettingsIcon, label: 'Settings utility', name: 'settings' },
];
