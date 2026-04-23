import type {
  Garden,
  Planting,
  Structure,
  SunExposure,
  SunShadeArea,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import {
  getPlantingFootprint,
  getStructureFootprint,
  rectsOverlap,
} from './gardenPlanning';
import {
  isRectInsidePlot,
  isRectInsideStructure,
} from './gardenPlanningGeometry';
import { cropSunRequirementMet } from './sunShadeEngine';
import {
  appendNote,
  type ReviewSuggestionAction,
} from './reviewSuggestionModel';

export function findSunFitPoint(
  garden: Garden,
  planting: Planting,
  required: SunExposure,
  sunLayer: SunShadeLayer,
) {
  const exposures = preferredExposures(required);
  const candidates = [...sunLayer.areas]
    .filter((area) => exposures.includes(area.exposure))
    .sort((left, right) => {
      const exposureDelta =
        exposures.indexOf(left.exposure) - exposures.indexOf(right.exposure);

      if (exposureDelta !== 0) {
        return exposureDelta;
      }

      return (
        distanceSquared(centerOfArea(left), planting) -
        distanceSquared(centerOfArea(right), planting)
      );
    });

  for (const area of candidates) {
    const point = centerOfArea(area);

    if (
      cropSunRequirementMet(required, area.exposure) &&
      isPlantingPositionLegal(garden, planting, point)
    ) {
      return point;
    }
  }

  return null;
}

export function findNorthLegalPoint(garden: Garden, planting: Planting) {
  const step = garden.plot.snapUnitFt * 2;
  const desired = {
    xFt: planting.xFt,
    yFt: Math.max(getPlantingFootprint(planting).depthFt / 2, planting.yFt - 2),
  };

  return findNearestLegalPoint(
    garden,
    planting,
    desired,
    (candidate) => candidate.yFt <= planting.yFt - step,
  );
}

export function findNearestLegalPoint(
  garden: Garden,
  planting: Planting,
  desired: { xFt: number; yFt: number },
  predicate: (point: { xFt: number; yFt: number }) => boolean = () => true,
) {
  const footprint = getPlantingFootprint(planting);
  const step = garden.plot.snapUnitFt * 2;
  const candidates: Array<{ xFt: number; yFt: number }> = [];

  for (
    let yFt = footprint.depthFt / 2;
    yFt <= garden.plot.depthFt - footprint.depthFt / 2 + 0.001;
    yFt += step
  ) {
    for (
      let xFt = footprint.widthFt / 2;
      xFt <= garden.plot.widthFt - footprint.widthFt / 2 + 0.001;
      xFt += step
    ) {
      const point = {
        xFt: snap(xFt, garden.plot.snapUnitFt),
        yFt: snap(yFt, garden.plot.snapUnitFt),
      };

      if (
        predicate(point) &&
        isPlantingPositionLegal(garden, planting, point)
      ) {
        candidates.push(point);
      }
    }
  }

  return (
    candidates.sort(
      (left, right) =>
        distanceSquared(left, desired) - distanceSquared(right, desired),
    )[0] ?? null
  );
}

export function findBedPlacement(
  garden: Garden,
  planting: Planting,
  preferNonContainer: boolean,
) {
  const beds = garden.structures
    .filter(isBedLike)
    .filter((bed) => !preferNonContainer || bed.type !== 'container')
    .sort((left, right) => left.yFt - right.yFt || left.xFt - right.xFt);

  for (const bed of beds) {
    const point = findPointInsideBed(garden, planting, bed);

    if (point) {
      return { bed, point };
    }
  }

  return null;
}

export function createReviewNoteAction(
  garden: Garden,
  itemId: string,
  note: string,
): ReviewSuggestionAction | null {
  const planting = garden.plantings.find(
    (candidate) => candidate.id === itemId,
  );

  if (planting) {
    if (planting.notes.includes(note)) {
      return null;
    }

    return {
      id: planting.id,
      kind: 'updatePlanting',
      values: {
        notes: appendNote(planting.notes, note),
      },
    };
  }

  const structure = garden.structures.find(
    (candidate) => candidate.id === itemId,
  );

  if (structure) {
    if (structure.notes.includes(note)) {
      return null;
    }

    return {
      id: structure.id,
      kind: 'updateStructure',
      values: {
        notes: appendNote(structure.notes, note),
      },
    };
  }

  return null;
}

export function findFirstPlanting(garden: Garden, itemIds: string[]) {
  return itemIds
    .map((id) => garden.plantings.find((planting) => planting.id === id))
    .find((planting): planting is Planting => Boolean(planting));
}

export function findFirstStructure(garden: Garden, itemIds: string[]) {
  return itemIds
    .map((id) => garden.structures.find((structure) => structure.id === id))
    .find((structure): structure is Structure => Boolean(structure));
}

export function isBedLike(structure: Structure) {
  return ['bed', 'container', 'inGroundBed', 'raisedBed'].includes(
    structure.type,
  );
}

export function isPath(structure: Structure) {
  return structure.type === 'path' || structure.type === 'pathway';
}

export function pointInsideStructure(
  point: { xFt: number; yFt: number },
  structure: Structure,
) {
  return (
    point.xFt >= structure.xFt &&
    point.xFt <= structure.xFt + structure.widthFt &&
    point.yFt >= structure.yFt &&
    point.yFt <= structure.yFt + structure.depthFt
  );
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function findPointInsideBed(
  garden: Garden,
  planting: Planting,
  bed: Structure,
) {
  const footprint = getPlantingFootprint(planting);
  const step = garden.plot.snapUnitFt * 2;

  for (
    let yFt = bed.yFt + footprint.depthFt / 2;
    yFt <= bed.yFt + bed.depthFt - footprint.depthFt / 2 + 0.001;
    yFt += step
  ) {
    for (
      let xFt = bed.xFt + footprint.widthFt / 2;
      xFt <= bed.xFt + bed.widthFt - footprint.widthFt / 2 + 0.001;
      xFt += step
    ) {
      const point = {
        xFt: snap(xFt, garden.plot.snapUnitFt),
        yFt: snap(yFt, garden.plot.snapUnitFt),
      };
      const moved = {
        ...planting,
        xFt: point.xFt,
        yFt: point.yFt,
      };

      if (
        isRectInsideStructure(getPlantingFootprint(moved), bed) &&
        isPlantingPositionLegal(garden, planting, point)
      ) {
        return point;
      }
    }
  }

  return null;
}

function isPlantingPositionLegal(
  garden: Garden,
  planting: Planting,
  point: { xFt: number; yFt: number },
) {
  const movedPlanting = {
    ...planting,
    xFt: point.xFt,
    yFt: point.yFt,
  };
  const rect = getPlantingFootprint(movedPlanting);
  const blockingRects = [
    ...garden.structures.filter(isBlockingStructure).map(getStructureFootprint),
    ...garden.plantings
      .filter(
        (other) =>
          other.id !== planting.id &&
          other.status !== 'removed' &&
          other.status !== 'harvested',
      )
      .map(getPlantingFootprint),
  ];

  return (
    isRectInsidePlot(rect, garden.plot) &&
    !blockingRects.some((blockingRect) => rectsOverlap(rect, blockingRect))
  );
}

function isBlockingStructure(structure: Structure) {
  return structure.type === 'path' || structure.type === 'pathway';
}

function preferredExposures(required: SunExposure): SunExposure[] {
  switch (required) {
    case 'fullShade':
      return ['fullShade', 'partShade'];
    case 'fullSun':
      return ['fullSun'];
    case 'partShade':
      return ['partShade', 'partSun'];
    case 'partSun':
      return ['partSun', 'partShade'];
  }
}

function centerOfArea(
  area: Pick<SunShadeArea, 'depthFt' | 'widthFt' | 'xFt' | 'yFt'>,
) {
  return {
    xFt: area.xFt + area.widthFt / 2,
    yFt: area.yFt + area.depthFt / 2,
  };
}

function distanceSquared(
  left: { xFt: number; yFt: number },
  right: { xFt: number; yFt: number },
) {
  return (left.xFt - right.xFt) ** 2 + (left.yFt - right.yFt) ** 2;
}

function snap(value: number, unit: number) {
  return Number((Math.round(value / unit) * unit).toFixed(3));
}
