import type { Garden } from '../../domain/gardens/GardenRepository';
import { getPlantingInstances } from '../../domain/gardens/plantingInstances';
import {
  areSamePlanItem,
  getItemPointFromRect,
  getItemRect,
  type PlanItemPositionUpdate,
  type PlanItemRef,
} from './planInteractionGeometry';
import type { PlanMode } from './planModes';

export type PlanAlignment = 'bottom' | 'center' | 'left' | 'right' | 'top';

export function filterExistingSelection(
  garden: Garden,
  selection: PlanItemRef[],
) {
  return selection.filter((item) => Boolean(getItemRect(garden, item)));
}

export function toggleSelection(selection: PlanItemRef[], item: PlanItemRef) {
  return selection.some((selected) => areSamePlanItem(selected, item))
    ? selection.filter((selected) => !areSamePlanItem(selected, item))
    : [...selection, item];
}

export function mergeSelection(
  selection: PlanItemRef[],
  additions: PlanItemRef[],
) {
  const next = [...selection];

  for (const item of additions) {
    if (!next.some((selected) => areSamePlanItem(selected, item))) {
      next.push(item);
    }
  }

  return next;
}

export function selectAllForMode(garden: Garden, mode: PlanMode) {
  if (mode === 'plant') {
    return garden.plantings.flatMap((planting) =>
      getPlantingInstances(planting).map((instance) => ({
        id: planting.id,
        instanceId: instance.id,
        type: 'planting' as const,
      })),
    );
  }

  if (mode === 'structure') {
    return garden.structures.map((structure) => ({
      id: structure.id,
      type: 'structure' as const,
    }));
  }

  return [
    ...garden.structures.map((structure) => ({
      id: structure.id,
      type: 'structure' as const,
    })),
    ...garden.plantings.flatMap((planting) =>
      getPlantingInstances(planting).map((instance) => ({
        id: planting.id,
        instanceId: instance.id,
        type: 'planting' as const,
      })),
    ),
  ];
}

export function buildNudgeUpdates(
  garden: Garden,
  selection: PlanItemRef[],
  deltaXFt: number,
  deltaYFt: number,
): PlanItemPositionUpdate[] {
  return selection.flatMap((item) => {
    const rect = getItemRect(garden, item);

    if (!rect) {
      return [];
    }

    const point = getItemPointFromRect(item, rect);

    return [
      {
        ...item,
        xFt: roundFeet(point.xFt + deltaXFt),
        yFt: roundFeet(point.yFt + deltaYFt),
      },
    ];
  });
}

export function buildAlignUpdates(
  garden: Garden,
  selection: PlanItemRef[],
  alignment: PlanAlignment,
): PlanItemPositionUpdate[] {
  const entries = getSelectionEntries(garden, selection);

  if (entries.length < 2) {
    return [];
  }

  const target =
    alignment === 'left'
      ? Math.min(...entries.map((entry) => entry.rect.xFt))
      : alignment === 'right'
        ? Math.max(...entries.map((entry) => rightEdge(entry.rect)))
        : alignment === 'top'
          ? Math.min(...entries.map((entry) => entry.rect.yFt))
          : alignment === 'bottom'
            ? Math.max(...entries.map((entry) => bottomEdge(entry.rect)))
            : average(
                entries.map((entry) => entry.rect.xFt + entry.rect.widthFt / 2),
              );

  return entries.map(({ item, rect }) => {
    if (alignment === 'left') {
      return pointUpdateFromRect(item, rect, target, rect.yFt);
    }

    if (alignment === 'top') {
      return pointUpdateFromRect(item, rect, rect.xFt, target);
    }

    if (alignment === 'right') {
      return pointUpdateFromRect(item, rect, target - rect.widthFt, rect.yFt);
    }

    if (alignment === 'bottom') {
      return pointUpdateFromRect(item, rect, rect.xFt, target - rect.depthFt);
    }

    return pointUpdateFromRect(item, rect, target - rect.widthFt / 2, rect.yFt);
  });
}

export function buildDistributeHorizontalUpdates(
  garden: Garden,
  selection: PlanItemRef[],
): PlanItemPositionUpdate[] {
  const entries = getSelectionEntries(garden, selection).sort(
    (left, right) =>
      left.rect.xFt +
      left.rect.widthFt / 2 -
      (right.rect.xFt + right.rect.widthFt / 2),
  );

  if (entries.length < 3) {
    return [];
  }

  const firstEntry = entries[0];
  const lastEntry = entries.at(-1);

  if (!firstEntry || !lastEntry) {
    return [];
  }

  const firstCenter = centerX(firstEntry.rect);
  const lastCenter = centerX(lastEntry.rect);
  const step = (lastCenter - firstCenter) / (entries.length - 1);

  return entries.map(({ item, rect }, index) =>
    pointUpdateFromRect(
      item,
      rect,
      firstCenter + step * index - rect.widthFt / 2,
      rect.yFt,
    ),
  );
}

function getSelectionEntries(garden: Garden, selection: PlanItemRef[]) {
  return selection.flatMap((item) => {
    const rect = getItemRect(garden, item);

    return rect ? [{ item, rect }] : [];
  });
}

function pointUpdateFromRect(
  item: PlanItemRef,
  rect: NonNullable<ReturnType<typeof getItemRect>>,
  xFt: number,
  yFt: number,
): PlanItemPositionUpdate {
  if (item.type === 'planting') {
    return {
      ...item,
      xFt: roundFeet(xFt + rect.widthFt / 2),
      yFt: roundFeet(yFt + rect.depthFt / 2),
    };
  }

  return {
    ...item,
    xFt: roundFeet(xFt),
    yFt: roundFeet(yFt),
  };
}

function centerX(rect: NonNullable<ReturnType<typeof getItemRect>>) {
  return rect.xFt + rect.widthFt / 2;
}

function rightEdge(rect: NonNullable<ReturnType<typeof getItemRect>>) {
  return rect.xFt + rect.widthFt;
}

function bottomEdge(rect: NonNullable<ReturnType<typeof getItemRect>>) {
  return rect.yFt + rect.depthFt;
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function roundFeet(value: number) {
  return Number(value.toFixed(3));
}
