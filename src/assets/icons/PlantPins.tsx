import {
  createAssetStyle,
  joinAssetClasses,
  renderAssetTitle,
  type SvgAssetProps,
} from '../assetUtils';

export type PlantPinTone =
  | 'berry'
  | 'green'
  | 'lavender'
  | 'marigold'
  | 'neutral'
  | 'sky'
  | 'tomato';
export type PlantPinState =
  | 'completed'
  | 'default'
  | 'dragging'
  | 'ghost'
  | 'needs-attention'
  | 'selected';

interface PlantPinProps extends SvgAssetProps {
  state?: PlantPinState;
  tone?: PlantPinTone;
}

const toneClassByVariant = {
  berry: 'assetTintBerry',
  green: 'assetTintGreen',
  lavender: 'assetTintLavender',
  marigold: 'assetTintMarigold',
  neutral: 'assetMonochrome',
  sky: 'assetTintSky',
  tomato: 'assetTintTomato',
} as const;

const stateClassByVariant = {
  completed: 'plantPinCompleted',
  default: '',
  dragging: 'plantPinDragging',
  ghost: 'plantPinGhost',
  'needs-attention': 'plantPinNeedsAttention',
  selected: 'plantPinSelected',
} as const;

export function PlantPin({
  accentColor,
  animated = false,
  className,
  size = 40,
  state = 'default',
  title,
  tone = 'green',
}: PlantPinProps) {
  const motionClass =
    state === 'selected'
      ? 'motion-pulse-ring'
      : animated
        ? 'motion-settle'
        : undefined;

  return (
    <span
      className={joinAssetClasses(
        'asset',
        'plantPin',
        toneClassByVariant[tone],
        stateClassByVariant[state],
        motionClass,
        className,
      )}
      style={createAssetStyle(accentColor, size)}
    >
      <svg
        aria-hidden={title ? undefined : true}
        fill="none"
        role={title ? 'img' : 'presentation'}
        viewBox="0 0 40 50"
      >
        {renderAssetTitle(title)}
        <g data-layer="halo" strokeWidth="2.25">
          <path d="M9.5 19.2C9.5 12 14.5 7 21.3 7c6.7 0 11.2 5.1 11.2 11.7 0 7.3-4.9 10.6-11.2 10.6-6.5 0-11.8-3.7-11.8-10.1Z" />
        </g>
        <g data-layer="shadow">
          <ellipse cx="20" cy="46.5" rx="7.8" ry="1.9" />
        </g>
        <g data-layer="accent">
          <path d="M20.5 5.6c6.8 0 12.8 4.9 12.8 13.4 0 6.1-3.3 10.6-7.6 15.6-2.1 2.5-3.8 4.6-5.5 7.8-1.4-3.2-3.3-5.5-5.9-8.4-4-4.6-7.1-8.3-7.1-14.5 0-8.1 5.5-13.9 13.3-13.9Z" />
        </g>
        <g data-layer="hatch" strokeWidth="1.35">
          <path d="M14.6 16.8c2.7 1.6 5.7 2.7 8.4 4.5" />
          <path d="M13.9 20.8c3 1.7 6.2 2.9 9.2 4.8" />
          <path d="M15.5 25.2c2.4 1.3 4.6 2.5 7.2 4" />
        </g>
        <g data-layer="outline" strokeWidth="var(--stroke-icon-md)">
          <path d="M20.7 5.2c6.5 0 12.3 4.9 12.3 13.3 0 6-3.2 10.2-7.4 15-2.1 2.4-3.7 4.6-5.4 8.4-1.5-3.4-3.4-5.8-6-8.8-3.8-4.4-6.8-8-6.8-14.1 0-8.2 5.7-13.8 13.3-13.8Z" />
        </g>
        <g data-layer="glyph" strokeWidth="2.15">
          <path d="M18.7 25.9c0-2.4 1.6-4.7 4.1-5.7-0.1 2.8-1.6 4.7-4.1 5.7Z" />
          <path d="M18.7 26.2c-2.2-0.6-3.9-2.4-4.9-4.7 2.7-0.1 4.5 1.5 4.9 4.7Z" />
          <path d="M18.9 27.2v2.8" />
        </g>
        {(state === 'selected' || state === 'needs-attention') && (
          <g data-layer="motion-lines" strokeWidth="1.7">
            <path d="M29.8 13.5c1.5-0.7 2.7-1.6 3.7-2.8" />
            <path d="M31.4 18.3h4" />
          </g>
        )}
      </svg>
    </span>
  );
}
