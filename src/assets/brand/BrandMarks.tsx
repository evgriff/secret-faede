import type { ReactNode } from 'react';

import {
  createAssetStyle,
  joinAssetClasses,
  renderAssetTitle,
  type SvgAssetProps,
} from '../assetUtils';

function BrandFrame({
  accentColor,
  animated = false,
  children,
  className,
  size = 72,
  title,
}: SvgAssetProps & { children: ReactNode }) {
  return (
    <span
      className={joinAssetClasses(
        'asset',
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
        viewBox="0 0 96 96"
      >
        {renderAssetTitle(title)}
        {children}
      </svg>
    </span>
  );
}

export function SeedPinLogo(props: SvgAssetProps) {
  return (
    <BrandFrame {...props}>
      <g data-layer="halo" strokeWidth="3">
        <path d="M24 39c0-12.2 8.6-21.4 21.6-21.4 12.3 0 20.6 9 20.6 20.5 0 12-8 17.4-18.6 17.4C36.1 55.5 24 49.1 24 39Z" />
      </g>
      <g data-layer="accent">
        <path d="M47.6 13.6c12.1 0 22.4 8.8 22.4 24.1 0 10.1-5.4 17.2-12.6 25-3.4 3.7-5.9 7-8.7 12.6-2.6-5.3-5.4-8.8-9.4-13.2-6.7-7.4-11.5-13.3-11.5-23.7 0-15 10.1-24.8 19.8-24.8Z" />
      </g>
      <g data-layer="hatch" strokeWidth="1.8">
        <path d="M37.6 35c4.9 2.7 9.7 5.2 14.6 8.1" />
        <path d="M36.8 42c5.3 2.9 10.2 5.7 15.4 8.7" />
      </g>
      <g data-layer="outline" strokeWidth="var(--stroke-logo)">
        <path d="M48 13.2c11.5 0 21.9 8.7 21.9 23.9 0 10.3-5.5 16.8-12.5 24.7-3.3 3.8-5.9 7.1-8.5 13.1-2.7-5.5-5.8-9.3-10-14.1-6.4-7.2-10.8-12.8-10.8-23 0-14.8 10-24.6 19.9-24.6Z" />
      </g>
      <g data-layer="glyph" strokeWidth="3">
        <path d="M45.8 44.8c0-4.6 2.8-8.7 7.2-10.7-0.2 5.3-2.7 8.9-7.2 10.7Z" />
        <path d="M45.8 45.2c-4.4-0.8-7.5-3.8-9.2-8.3 5.2 0 8.6 2.7 9.2 8.3Z" />
        <path d="M46.4 47.1v5.1" />
      </g>
      <g data-layer="motion-lines" strokeWidth="2">
        <path d="M66.4 26.6c3.1-1.5 5.5-3.4 7.4-5.7" />
        <path d="M70 34.4h7.2" />
      </g>
    </BrandFrame>
  );
}

export function PlotMapLogo(props: SvgAssetProps) {
  return (
    <BrandFrame {...props}>
      <g data-layer="accent">
        <path d="M20.8 27.8 38 21l18.2 7 19-6.2v33.8l-19 7-18.2-7-17.2 6Z" />
      </g>
      <g data-layer="hatch" strokeWidth="1.7">
        <path d="M52.3 29.4c5 2.3 9 5.7 11.8 10.4" />
        <path d="M49.2 35.4c4.3 2.1 7.8 4.8 10.5 8.3" />
      </g>
      <g data-layer="outline" strokeWidth="var(--stroke-logo)">
        <path d="M20.5 27.8 37.8 21l18.5 7 19-6.3v34l-19 7-18.6-7-17 5.9Z" />
        <path d="M37.9 21.5v34.1" />
        <path d="M56.1 28.1v34.2" />
      </g>
      <g data-layer="glyph" strokeWidth="3">
        <path d="M47.7 35.8c5.8 0 10.1 4.2 10.1 9.6 0 5-3.3 8.2-6.8 12.2-1 1.1-1.8 2.4-2.6 3.9-1.1-1.9-2.1-3.3-3.5-4.8-3.2-3.7-5.2-6.3-5.2-10.9 0-6.1 3.8-10 8-10Z" />
        <path d="M47.8 40.7c1.8 0 3.1 1.3 3.1 3s-1.3 2.8-3.1 2.8c-1.7 0-3-1.2-3-2.8s1.3-3 3-3Z" />
      </g>
    </BrandFrame>
  );
}

export function BloomMarkerLogo(props: SvgAssetProps) {
  return (
    <BrandFrame {...props}>
      <g data-layer="halo" strokeWidth="2.6">
        <path d="M33.7 42.3c0-9.2 6.2-15.5 14.9-15.5 8 0 14.5 6 14.5 14.8 0 7.7-5.1 12.5-13.4 12.5-9.5 0-16-4.1-16-11.8Z" />
      </g>
      <g data-layer="accent">
        <path d="M48.7 26.7c7.9 0 14.8 6 14.8 14.8 0 6.8-4.1 11.9-9.8 16.6-1.8 1.5-3.4 3.6-4.8 6.5-1.8-3.2-3.5-5.4-5.4-7.2-5-4.7-9.3-8.5-9.3-15.8 0-8.4 6.1-15 14.5-15Z" />
      </g>
      <g data-layer="outline" strokeWidth="var(--stroke-logo)">
        <path d="M48.4 26.6c7.8 0 14.8 6 14.8 14.9 0 6.8-4 11.7-9.7 16.4-1.7 1.4-3.2 3.5-4.7 6.4-1.8-3.1-3.7-5.5-5.9-7.5-4.7-4.4-8.9-8-8.9-15.4 0-8.6 6.1-14.8 14.4-14.8Z" />
        <path d="M48.5 64.1V78" />
      </g>
      <g data-layer="glyph" strokeWidth="3">
        <path d="M48.2 43.8c-3.4-0.2-6.3-1.8-8.4-4.8 1.6-3.4 4.2-5.5 8-6.2 1.8 1.8 2.4 5 0.4 11Z" />
        <path d="M48.8 43.8c0.2-5 2.3-8.3 6.8-10.5 3.3 1.2 5.3 3.7 6.1 7.4-2.6 2.2-6.2 3.1-12.9 3.1Z" />
        <path d="M48.8 43.9c0.8 3.8 0.2 6.8-2 9.3-3.5 0.1-6.1-1.4-8.2-4.4 1.4-2.7 4.7-4.3 10.2-4.9Z" />
      </g>
    </BrandFrame>
  );
}

export function PrimaryLogoLockup({
  accentColor,
  animated = false,
  className,
  title = 'Secret Faede',
}: SvgAssetProps) {
  return (
    <span
      className={joinAssetClasses(
        'asset',
        animated && 'motion-settle',
        className,
      )}
      style={createAssetStyle(accentColor, undefined)}
    >
      <svg
        aria-hidden={title ? undefined : true}
        fill="none"
        role={title ? 'img' : 'presentation'}
        viewBox="0 0 248 92"
        width="248"
      >
        {renderAssetTitle(title)}
        <g transform="translate(0 2)">
          <g data-layer="halo" stroke="currentColor" strokeWidth="3">
            <path d="M30 37c0-9.4 6.6-16.5 16.7-16.5 9.5 0 16 6.9 16 15.8 0 9.3-6 13.5-14.4 13.5C39.3 49.8 30 44.9 30 37Z" />
          </g>
          <g data-layer="accent">
            <path d="M48 17.4c9.6 0 17.5 6.9 17.5 19 0 8.1-4.2 13.8-9.7 20-2.5 2.7-4.4 5.4-6.3 9.5-2.1-4.1-4.2-6.8-7.2-10.1-5.1-5.7-8.8-10.4-8.8-18.5 0-11.7 7.8-19.9 14.5-19.9Z" />
          </g>
          <g data-layer="outline" stroke="currentColor" strokeWidth="3.5">
            <path d="M48 17.2c9.3 0 17.3 6.8 17.3 19 0 8.1-4.1 13.4-9.6 19.7-2.3 2.6-4.3 5.3-6.2 10-2.2-4.2-4.5-7.1-7.7-10.7-5-5.6-8.5-9.9-8.5-18.1 0-11.8 7.9-19.9 14.7-19.9Z" />
          </g>
          <g data-layer="glyph" stroke="currentColor" strokeWidth="3">
            <path d="M46.4 42.1c0-3.4 2-6.6 5.6-8.1-0.2 4-2 6.7-5.6 8.1Z" />
            <path d="M46.4 42.4c-3.4-0.6-5.8-2.8-7.1-6.3 4 0 6.6 2 7.1 6.3Z" />
            <path d="M46.8 43.7v3.8" />
          </g>
        </g>
        <text
          fill="currentColor"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontSize="26"
          fontWeight="650"
          letterSpacing="-0.04em"
          x="92"
          y="36"
        >
          Secret Faede
        </text>
        <text
          fill="currentColor"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontSize="12"
          opacity="0.76"
          x="92"
          y="58"
        >
          hand-drawn garden plot utility
        </text>
        <g
          data-layer="motion-lines"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="2"
        >
          <path d="M92 70c15 4 28 4.5 41 0" />
        </g>
      </svg>
    </span>
  );
}

export const logoDirections = [
  {
    component: SeedPinLogo,
    id: 'seed-pin',
    label: 'Direction A — Seed Pin',
    recommendation: 'Primary recommendation',
  },
  {
    component: PlotMapLogo,
    id: 'plot-map',
    label: 'Direction B — Plot Map Mark',
    recommendation: 'Strong alternate',
  },
  {
    component: BloomMarkerLogo,
    id: 'bloom-marker',
    label: 'Direction C — Bloom Marker',
    recommendation: 'Decorative alternate',
  },
] as const;
