import type { CSSProperties, ReactNode } from 'react';

export interface SvgAssetProps {
  accentColor?: string;
  animated?: boolean;
  className?: string | undefined;
  size?: number | string;
  title?: string;
}

export function joinAssetClasses(
  ...classNames: Array<string | false | null | undefined>
) {
  return classNames.filter(Boolean).join(' ');
}

export function createAssetStyle(
  accentColor: string | undefined,
  size: number | string | undefined,
): CSSProperties {
  return {
    ...(accentColor ? { ['--asset-accent' as const]: accentColor } : {}),
    ...(size
      ? {
          height: typeof size === 'number' ? `${size}px` : size,
          width: typeof size === 'number' ? `${size}px` : size,
        }
      : {}),
  };
}

export function renderAssetTitle(title: string | undefined): ReactNode {
  return title ? <title>{title}</title> : null;
}
