import type { CSSProperties } from 'react';

import type { SunShadeArea } from '../../../domain/gardens/GardenRepository';
import { pixelsPerFoot } from '../../garden/gardenMath';
import type { FootRect } from '../../garden/gardenPlanning';

export function createRulerTicks(sizeFt: number) {
  const ticks = [];

  for (let tick = 0; tick <= sizeFt; tick += 2) {
    ticks.push(tick);
  }

  if (ticks.at(-1) !== sizeFt) {
    ticks.push(sizeFt);
  }

  return ticks;
}

export function footprintStyle(rect: FootRect): CSSProperties {
  return {
    height: `${rect.depthFt * pixelsPerFoot}px`,
    left: `${rect.xFt * pixelsPerFoot}px`,
    top: `${rect.yFt * pixelsPerFoot}px`,
    width: `${rect.widthFt * pixelsPerFoot}px`,
  };
}

export function sunAreaStyle(area: SunShadeArea): CSSProperties {
  return {
    height: `${area.depthFt * pixelsPerFoot}px`,
    left: `${area.xFt * pixelsPerFoot}px`,
    top: `${area.yFt * pixelsPerFoot}px`,
    width: `${area.widthFt * pixelsPerFoot}px`,
  };
}
