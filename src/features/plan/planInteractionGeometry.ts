import type {
  Garden,
  GardenPlant,
  GardenPlot,
  PlantingInstance,
  Structure,
} from '../../domain/gardens/GardenRepository';
import { getPlantingInstances } from '../../domain/gardens/plantingInstances';
import { clamp, snapFeet } from '../garden/gardenMath';
import {
  getPlantingFootprint,
  getPlantingInstanceFootprint,
  getStructureFootprint,
  type FootRect,
} from '../garden/gardenPlanning';

export const defaultPlanSnapFt = 0.125;
const smartSnapThresholdFt = 0.18;
const minimumResizeFt = 0.25;

export type PlanItemType = 'planting' | 'structure';
export type ResizeHandle =
  | 'east'
  | 'north'
  | 'northEast'
  | 'northWest'
  | 'south'
  | 'southEast'
  | 'southWest'
  | 'west';

export interface PlanItemRef {
  id: string;
  instanceId?: string;
  type: PlanItemType;
}

export interface PlanItemPositionUpdate extends PlanItemRef {
  xFt: number;
  yFt: number;
}

export interface PlanPreviewOffset {
  xPx: number;
  yPx: number;
}

export interface PlanItemRectUpdate extends PlanItemPositionUpdate {
  depthFt: number;
  widthFt: number;
}

export interface SnapGuide {
  axis: 'x' | 'y';
  valueFt: number;
}

export interface SnapPointResult {
  guides: SnapGuide[];
  point: {
    xFt: number;
    yFt: number;
  };
}

export interface SnapRectResult {
  guides: SnapGuide[];
  rect: FootRect;
}

export interface SnapTarget {
  axis: 'x' | 'y';
  valueFt: number;
}

interface SnapAnchor {
  offsetFt: number;
  role: 'center' | 'end' | 'start';
}

export function getPlanSnapUnit(plot: GardenPlot) {
  return Math.min(plot.snapUnitFt, defaultPlanSnapFt);
}

export function findItemRef(garden: Garden, item: PlanItemRef) {
  return item.type === 'planting'
    ? (garden.plantings.find((planting) => planting.id === item.id) ?? null)
    : (garden.structures.find((structure) => structure.id === item.id) ?? null);
}

export function getItemRect(
  garden: Garden,
  item: PlanItemRef,
): FootRect | null {
  const found = findItemRef(garden, item);

  if (!found) {
    return null;
  }

  if (item.type === 'structure') {
    return getStructureFootprint(found as Structure);
  }

  const planting = found as GardenPlant;
  const instance = findPlantingInstance(planting, item.instanceId);

  return instance
    ? getPlantingInstanceFootprint(planting, instance)
    : getPlantingFootprint(planting);
}

export function getItemPointFromRect(
  item: PlanItemRef,
  rect: FootRect,
): { xFt: number; yFt: number } {
  if (item.type === 'planting') {
    return {
      xFt: rect.xFt + rect.widthFt / 2,
      yFt: rect.yFt + rect.depthFt / 2,
    };
  }

  return {
    xFt: rect.xFt,
    yFt: rect.yFt,
  };
}

export function getPlanItemKey(item: PlanItemRef) {
  return item.type === 'planting'
    ? `planting:${item.id}:${item.instanceId ?? 'group'}`
    : `structure:${item.id}`;
}

export function rectFromItemPoint(
  item: PlanItemRef,
  point: { xFt: number; yFt: number },
  sourceRect: FootRect,
): FootRect {
  if (item.type === 'planting') {
    return {
      ...sourceRect,
      xFt: point.xFt - sourceRect.widthFt / 2,
      yFt: point.yFt - sourceRect.depthFt / 2,
    };
  }

  return {
    ...sourceRect,
    xFt: point.xFt,
    yFt: point.yFt,
  };
}

export function snapItemPoint({
  freeMove = false,
  garden,
  item,
  point,
  sourceRect,
  snap = true,
  snapExclusions = [],
  snapTargets,
}: {
  freeMove?: boolean;
  garden: Garden;
  item: PlanItemRef;
  point: { xFt: number; yFt: number };
  sourceRect: FootRect;
  snap?: boolean;
  snapExclusions?: PlanItemRef[];
  snapTargets?: SnapTarget[];
}): SnapPointResult {
  const normalizedPoint = clampItemPointToPlot(
    item,
    point,
    sourceRect,
    garden.plot,
  );

  if (freeMove || !snap) {
    return {
      guides: [],
      point: {
        xFt: roundFeet(normalizedPoint.xFt),
        yFt: roundFeet(normalizedPoint.yFt),
      },
    };
  }

  const snapUnitFt = getPlanSnapUnit(garden.plot);
  const finePoint = clampItemPointToPlot(
    item,
    {
      xFt: snapFeet(normalizedPoint.xFt, snapUnitFt),
      yFt: snapFeet(normalizedPoint.yFt, snapUnitFt),
    },
    sourceRect,
    garden.plot,
  );
  const movingRect = clampRectToPlot(
    rectFromItemPoint(item, finePoint, sourceRect),
    garden.plot,
  );
  const targets = snapTargets ?? buildSnapTargets(garden, snapExclusions);
  const xSnap = findBestSnap(
    buildAnchors(movingRect.xFt, movingRect.widthFt),
    targets.filter((target) => target.axis === 'x'),
  );
  const ySnap = findBestSnap(
    buildAnchors(movingRect.yFt, movingRect.depthFt),
    targets.filter((target) => target.axis === 'y'),
  );
  const snappedRect = clampRectToPlot(
    {
      ...movingRect,
      xFt: movingRect.xFt + (xSnap?.deltaFt ?? 0),
      yFt: movingRect.yFt + (ySnap?.deltaFt ?? 0),
    },
    garden.plot,
  );
  const snappedPoint = getItemPointFromRect(item, snappedRect);

  return {
    guides: [xSnap?.guide, ySnap?.guide].filter(isDefined),
    point: {
      xFt: roundFeet(snappedPoint.xFt),
      yFt: roundFeet(snappedPoint.yFt),
    },
  };
}

export function calculateResizeRect({
  currentPoint,
  garden,
  handle,
  originalRect,
}: {
  currentPoint: { xFt: number; yFt: number };
  garden: Garden;
  handle: ResizeHandle;
  originalRect: FootRect;
}): FootRect {
  const right = originalRect.xFt + originalRect.widthFt;
  const bottom = originalRect.yFt + originalRect.depthFt;
  let nextLeft = originalRect.xFt;
  let nextRight = right;
  let nextTop = originalRect.yFt;
  let nextBottom = bottom;

  if (handleIncludesWest(handle)) {
    nextLeft = clamp(currentPoint.xFt, 0, right - minimumResizeFt);
  }

  if (handleIncludesEast(handle)) {
    nextRight = clamp(
      currentPoint.xFt,
      originalRect.xFt + minimumResizeFt,
      garden.plot.widthFt,
    );
  }

  if (handleIncludesNorth(handle)) {
    nextTop = clamp(currentPoint.yFt, 0, bottom - minimumResizeFt);
  }

  if (handleIncludesSouth(handle)) {
    nextBottom = clamp(
      currentPoint.yFt,
      originalRect.yFt + minimumResizeFt,
      garden.plot.depthFt,
    );
  }

  return {
    ...originalRect,
    depthFt: roundFeet(nextBottom - nextTop),
    widthFt: roundFeet(nextRight - nextLeft),
    xFt: roundFeet(nextLeft),
    yFt: roundFeet(nextTop),
  };
}

export function snapResizeRect({
  freeMove = false,
  garden,
  handle,
  rect,
  snap = true,
  snapExclusions = [],
  snapTargets,
}: {
  freeMove?: boolean;
  garden: Garden;
  handle: ResizeHandle;
  rect: FootRect;
  snap?: boolean;
  snapExclusions?: PlanItemRef[];
  snapTargets?: SnapTarget[];
}): SnapRectResult {
  if (freeMove || !snap) {
    return { guides: [], rect: clampRectToPlot(rect, garden.plot) };
  }

  const snapUnitFt = getPlanSnapUnit(garden.plot);
  const fineRect = clampRectToPlot(
    {
      ...rect,
      depthFt: snapFeet(rect.depthFt, snapUnitFt),
      widthFt: snapFeet(rect.widthFt, snapUnitFt),
      xFt: snapFeet(rect.xFt, snapUnitFt),
      yFt: snapFeet(rect.yFt, snapUnitFt),
    },
    garden.plot,
  );
  const targets = snapTargets ?? buildSnapTargets(garden, snapExclusions);
  const activeXAnchors = buildResizeAnchors(
    fineRect.xFt,
    fineRect.widthFt,
    handle,
    'x',
  );
  const activeYAnchors = buildResizeAnchors(
    fineRect.yFt,
    fineRect.depthFt,
    handle,
    'y',
  );
  const xSnap = findBestSnap(
    activeXAnchors,
    targets.filter((target) => target.axis === 'x'),
  );
  const ySnap = findBestSnap(
    activeYAnchors,
    targets.filter((target) => target.axis === 'y'),
  );
  let snappedRect = fineRect;

  if (xSnap) {
    snappedRect = applyResizeDelta(snappedRect, handle, 'x', xSnap.deltaFt);
  }

  if (ySnap) {
    snappedRect = applyResizeDelta(snappedRect, handle, 'y', ySnap.deltaFt);
  }

  return {
    guides: [xSnap?.guide, ySnap?.guide].filter(isDefined),
    rect: clampRectToPlot(snappedRect, garden.plot),
  };
}

export function rectsIntersect(left: FootRect, right: FootRect) {
  return (
    left.xFt <= right.xFt + right.widthFt &&
    left.xFt + left.widthFt >= right.xFt &&
    left.yFt <= right.yFt + right.depthFt &&
    left.yFt + left.depthFt >= right.yFt
  );
}

export function rectFromPoints(
  start: { xFt: number; yFt: number },
  end: { xFt: number; yFt: number },
): FootRect {
  const xFt = Math.min(start.xFt, end.xFt);
  const yFt = Math.min(start.yFt, end.yFt);

  return {
    depthFt: Math.abs(end.yFt - start.yFt),
    id: 'marquee',
    itemType: 'structure',
    label: 'Selection',
    widthFt: Math.abs(end.xFt - start.xFt),
    xFt,
    yFt,
  };
}

export function getItemsInRect(garden: Garden, rect: FootRect): PlanItemRef[] {
  return [
    ...garden.structures
      .map((structure) => getStructureFootprint(structure))
      .filter((itemRect) => rectsIntersect(itemRect, rect))
      .map((itemRect) => ({ id: itemRect.id, type: 'structure' as const })),
    ...garden.plantings
      .map((planting) => getPlantingFootprint(planting))
      .filter((itemRect) => rectsIntersect(itemRect, rect))
      .map((itemRect) => ({ id: itemRect.id, type: 'planting' as const })),
  ];
}

export function areSamePlanItem(left: PlanItemRef, right: PlanItemRef) {
  return (
    left.id === right.id &&
    left.type === right.type &&
    (left.instanceId ?? null) === (right.instanceId ?? null)
  );
}

export function buildSnapTargets(
  garden: Garden,
  exclusions: PlanItemRef[],
): SnapTarget[] {
  const excludedKeys = new Set(exclusions.map(getPlanItemKey));
  const targets: SnapTarget[] = [];

  for (const structure of garden.structures) {
    if (
      excludedKeys.has(getPlanItemKey({ id: structure.id, type: 'structure' }))
    ) {
      continue;
    }

    addRectTargets(targets, getStructureFootprint(structure));
  }

  for (const planting of garden.plantings) {
    if (
      excludedKeys.has(getPlanItemKey({ id: planting.id, type: 'planting' }))
    ) {
      continue;
    }

    addRectTargets(targets, getPlantingFootprint(planting));
  }

  targets.push(
    { axis: 'x', valueFt: 0 },
    { axis: 'x', valueFt: garden.plot.widthFt / 2 },
    { axis: 'x', valueFt: garden.plot.widthFt },
    { axis: 'y', valueFt: 0 },
    { axis: 'y', valueFt: garden.plot.depthFt / 2 },
    { axis: 'y', valueFt: garden.plot.depthFt },
  );

  return targets;
}

function addRectTargets(targets: SnapTarget[], rect: FootRect) {
  const right = rect.xFt + rect.widthFt;
  const bottom = rect.yFt + rect.depthFt;

  targets.push(
    { axis: 'x', valueFt: rect.xFt },
    { axis: 'x', valueFt: rect.xFt + rect.widthFt / 2 },
    { axis: 'x', valueFt: right },
    { axis: 'y', valueFt: rect.yFt },
    { axis: 'y', valueFt: rect.yFt + rect.depthFt / 2 },
    { axis: 'y', valueFt: bottom },
  );
}

function buildAnchors(startFt: number, sizeFt: number): SnapAnchor[] {
  return [
    { offsetFt: startFt, role: 'start' },
    { offsetFt: startFt + sizeFt / 2, role: 'center' },
    { offsetFt: startFt + sizeFt, role: 'end' },
  ];
}

function buildResizeAnchors(
  startFt: number,
  sizeFt: number,
  handle: ResizeHandle,
  axis: 'x' | 'y',
): SnapAnchor[] {
  const anchors = buildAnchors(startFt, sizeFt);

  if (
    (axis === 'x' && handleIncludesWest(handle)) ||
    (axis === 'y' && handleIncludesNorth(handle))
  ) {
    return anchors.filter((anchor) => anchor.role === 'start');
  }

  if (
    (axis === 'x' && handleIncludesEast(handle)) ||
    (axis === 'y' && handleIncludesSouth(handle))
  ) {
    return anchors.filter((anchor) => anchor.role === 'end');
  }

  return [];
}

function findBestSnap(anchors: SnapAnchor[], targets: SnapTarget[]) {
  let best: {
    deltaFt: number;
    distanceFt: number;
    guide: SnapGuide;
  } | null = null;

  for (const anchor of anchors) {
    for (const target of targets) {
      const deltaFt = target.valueFt - anchor.offsetFt;
      const distanceFt = Math.abs(deltaFt);

      if (distanceFt > smartSnapThresholdFt) {
        continue;
      }

      if (!best || distanceFt < best.distanceFt) {
        best = {
          deltaFt,
          distanceFt,
          guide: {
            axis: target.axis,
            valueFt: target.valueFt,
          },
        };
      }
    }
  }

  return best;
}

function applyResizeDelta(
  rect: FootRect,
  handle: ResizeHandle,
  axis: 'x' | 'y',
  deltaFt: number,
): FootRect {
  if (axis === 'x' && handleIncludesWest(handle)) {
    return {
      ...rect,
      widthFt: roundFeet(rect.widthFt - deltaFt),
      xFt: roundFeet(rect.xFt + deltaFt),
    };
  }

  if (axis === 'x' && handleIncludesEast(handle)) {
    return { ...rect, widthFt: roundFeet(rect.widthFt + deltaFt) };
  }

  if (axis === 'y' && handleIncludesNorth(handle)) {
    return {
      ...rect,
      depthFt: roundFeet(rect.depthFt - deltaFt),
      yFt: roundFeet(rect.yFt + deltaFt),
    };
  }

  if (axis === 'y' && handleIncludesSouth(handle)) {
    return { ...rect, depthFt: roundFeet(rect.depthFt + deltaFt) };
  }

  return rect;
}

function clampRectToPlot(rect: FootRect, plot: GardenPlot): FootRect {
  const widthFt = clamp(rect.widthFt, minimumResizeFt, plot.widthFt);
  const depthFt = clamp(rect.depthFt, minimumResizeFt, plot.depthFt);

  return {
    ...rect,
    depthFt: roundFeet(depthFt),
    widthFt: roundFeet(widthFt),
    xFt: roundFeet(clamp(rect.xFt, 0, Math.max(plot.widthFt - widthFt, 0))),
    yFt: roundFeet(clamp(rect.yFt, 0, Math.max(plot.depthFt - depthFt, 0))),
  };
}

function clampItemPointToPlot(
  item: PlanItemRef,
  point: { xFt: number; yFt: number },
  sourceRect: FootRect,
  plot: GardenPlot,
) {
  return getItemPointFromRect(
    item,
    clampRectToPlot(rectFromItemPoint(item, point, sourceRect), plot),
  );
}

function handleIncludesWest(handle: ResizeHandle) {
  return handle === 'west' || handle === 'northWest' || handle === 'southWest';
}

function handleIncludesEast(handle: ResizeHandle) {
  return handle === 'east' || handle === 'northEast' || handle === 'southEast';
}

function handleIncludesNorth(handle: ResizeHandle) {
  return handle === 'north' || handle === 'northEast' || handle === 'northWest';
}

function handleIncludesSouth(handle: ResizeHandle) {
  return handle === 'south' || handle === 'southEast' || handle === 'southWest';
}

function findPlantingInstance(
  planting: GardenPlant,
  instanceId: string | undefined,
): PlantingInstance | null {
  if (!instanceId) {
    return null;
  }

  return (
    getPlantingInstances(planting).find(
      (instance) => instance.id === instanceId,
    ) ?? null
  );
}

function roundFeet(value: number) {
  return Number(value.toFixed(3));
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
