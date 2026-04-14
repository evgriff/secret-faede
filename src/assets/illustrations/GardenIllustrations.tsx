import type { ReactNode } from 'react';

import {
  createAssetStyle,
  joinAssetClasses,
  renderAssetTitle,
  type SvgAssetProps,
} from '../assetUtils';

function IllustrationFrame({
  accentColor,
  animated = false,
  children,
  className,
  size = '100%',
  title,
}: SvgAssetProps & { children: ReactNode }) {
  return (
    <span
      className={joinAssetClasses(
        'asset',
        'assetTintGreen',
        animated && 'motion-draw',
        animated && 'motion-bloom',
        className,
      )}
      style={createAssetStyle(accentColor, size)}
    >
      <svg
        aria-hidden={title ? undefined : true}
        fill="none"
        role={title ? 'img' : 'presentation'}
        viewBox="0 0 160 80"
      >
        {renderAssetTitle(title)}
        {children}
      </svg>
    </span>
  );
}

export function BotanicalDivider(props: SvgAssetProps) {
  return (
    <IllustrationFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-illustration)">
        <path d="M5 54c18-1 31-4.5 39-10 8-5.7 12.9-11.7 14.4-18.8C61 32 63 38.5 69 44c6.2 5.7 16 9 29.4 10.4 7.4-11.1 14.8-19 24.8-23.4-1 9.8 2 17.6 8.7 23.6 6.1-2.3 13.8-2.8 23.1-1.3" />
        <path d="M28.4 47.4c3.8-5.5 8.7-8.7 14.9-9.6" />
        <path d="M40.4 39.7c-4.9-0.7-8.7-3.3-11.5-7.7" />
        <path d="M77.2 46.1c4.2-5.6 9.4-8.8 15.7-9.7" />
        <path d="M91.1 35.7c-5.4-0.2-9.7-2.4-13.1-6.6" />
        <path d="M127.7 46.9c4.8-5.9 9.9-9.5 15.2-10.8" />
      </g>
      <g data-layer="accent">
        <circle cx="43.4" cy="37.8" r="3.5" />
        <circle cx="92.4" cy="34.5" r="3" />
        <path d="M127.8 43.2c3.3 0 6 2.5 6 5.6 0 3.5-2.6 5.8-5.9 5.8-3.1 0-5.7-2.3-5.7-5.4 0-3.2 2.3-6 5.6-6Z" />
      </g>
    </IllustrationFrame>
  );
}

export function FoldedMapIllustration(props: SvgAssetProps) {
  return (
    <IllustrationFrame {...props}>
      <g data-layer="accent">
        <path d="M22 18.6 52.2 10 83 21.2l33.4-10.8v43.2L83 64.2 52 53.4 22 62.2Z" />
      </g>
      <g data-layer="hatch" strokeWidth="2">
        <path d="M82.6 22.9c11.5 5.4 19.9 13.4 25.2 24.1" />
        <path d="M76.8 31.6c10.2 4.6 17.6 11 22.3 18.9" />
      </g>
      <g data-layer="outline" strokeWidth="var(--stroke-illustration)">
        <path d="M22 18.6 52.2 10 83 21.2l33.4-10.8v43.2L83 64.2 52 53.4 22 62.2Z" />
        <path d="M52 10.7v42.7" />
        <path d="M83.2 21.4v42.8" />
        <path d="M66.7 28.4c8.5 1.5 15.1 5.7 20 12.6" />
      </g>
      <g data-layer="glyph" strokeWidth="3">
        <path d="M66.2 29.7c8.4 0 15 6.1 15 14.7 0 6.9-4.2 11.6-9.1 17.1-1.5 1.7-2.7 3.5-4 5.8-1.5-2.7-3.2-4.8-5.1-6.9-4.3-4.8-8.3-8.9-8.3-16 0-8.6 5.3-14.7 11.5-14.7Z" />
        <path d="M66.4 35.2c2.5 0 4.3 1.8 4.3 4.1 0 2.2-1.8 3.9-4.3 3.9-2.3 0-4.2-1.7-4.2-3.9 0-2.3 1.9-4.1 4.2-4.1Z" />
      </g>
    </IllustrationFrame>
  );
}

export function SproutSceneIllustration(props: SvgAssetProps) {
  return (
    <IllustrationFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-illustration)">
        <path d="M10 58.8c24.8-4.9 45.6-5.3 62.5-1.4 11.4 2.7 23.3 2.7 35.7 0.1 12.4-2.7 26.4-2.6 41.8 0.1" />
        <path d="M54.8 57.4c0-10.1 4.8-18.3 13.7-23.9 0.1 9.6-4.5 17.8-13.7 23.9Z" />
        <path d="M54.6 57.2c-8.5-2.7-13.8-8.2-16.4-16.9 9.4-0.4 14.9 4.8 16.4 16.9Z" />
        <path d="M101.3 56.3c0-6.8 3-12.4 8.8-16.8 0.4 7.2-2.5 12.8-8.8 16.8Z" />
        <path d="M101.2 56.4c-6.3-1.6-10.6-5.8-12.8-12.6 6.8 0.3 11 4.5 12.8 12.6Z" />
        <path d="M55 57.4v7.8" />
        <path d="M101.5 56.4v6.8" />
      </g>
      <g data-layer="accent">
        <path d="M53.8 56.8c0-6.9 3.5-12.8 10.1-17.4-0.5 8-3.9 13.8-10.1 17.4Z" />
        <path d="M100.8 56c0-4.7 2.3-8.8 6.7-12-0.2 5.2-2.5 9.2-6.7 12Z" />
      </g>
    </IllustrationFrame>
  );
}

export function RouteLineIllustration(props: SvgAssetProps) {
  return (
    <IllustrationFrame {...props}>
      <g data-layer="outline" strokeWidth="var(--stroke-illustration)">
        <path d="M9.8 49.7c11.5-0.3 20.2-5.2 26.2-14.6 4.6-7.4 10.2-11.8 16.8-13.2 0.8 5.5 4.3 10.2 10.2 14.1 5.9 3.8 10.5 7.6 13.6 11.5 4.5-5.8 10.3-9.8 17.6-12.1 7.4-2.3 14.6-2.6 21.7-1 7.1 1.7 13.2 5.5 18.5 11.6" />
        <path d="M35.7 35.8c1.6 2.4 3.8 4.2 6.8 5.4" />
        <path d="M75.1 48.1c2.1-2.7 4.7-4.7 7.7-5.9" />
        <path d="M117.9 37.6c2.8 0.6 5.3 1.8 7.6 3.6" />
      </g>
      <g data-layer="motion-lines" strokeWidth="2">
        <path d="M11.6 44.1c2.2-1 3.7-2.5 4.7-4.5" />
        <path d="M143.2 40.8c1.8 0.7 3.5 1.8 5 3.2" />
      </g>
      <g data-layer="accent">
        <circle cx="51.8" cy="22.9" r="4" />
        <circle cx="93.4" cy="31.8" r="3.5" />
        <circle cx="126.1" cy="35.9" r="3.3" />
      </g>
    </IllustrationFrame>
  );
}

export const illustrationRegistry = [
  {
    component: BotanicalDivider,
    id: 'botanical-divider',
    label: 'Botanical divider',
  },
  {
    component: FoldedMapIllustration,
    id: 'folded-map-illustration',
    label: 'Folded map illustration',
  },
  {
    component: SproutSceneIllustration,
    id: 'sprout-scene-illustration',
    label: 'Sprout scene illustration',
  },
  {
    component: RouteLineIllustration,
    id: 'route-line-illustration',
    label: 'Route line illustration',
  },
] as const;
