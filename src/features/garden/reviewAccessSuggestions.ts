import {
  createDefaultStructure,
  type Garden,
  type Planting,
  type Structure,
} from '../../domain/gardens/GardenRepository';
import {
  getPlantingFootprint,
  getStructureFootprint,
  rectsOverlap,
  type PlanWarning,
} from './gardenPlanning';
import { isRectInsidePlot } from './gardenPlanningGeometry';
import {
  getPathRequiredWidthFt,
  isBedLikeStructure,
  isPathStructure,
} from './gardenStructureRules';
import {
  clamp,
  findFirstPlanting,
  findFirstStructure,
  findNearestLegalPoint,
} from './reviewSuggestionGeometry';
import {
  appendNote,
  formatPoint,
  reviewMarker,
  type ReviewSuggestion,
} from './reviewSuggestionModel';

export function buildAddAccessPathSuggestion(
  garden: Garden,
  warning: PlanWarning,
): ReviewSuggestion | null {
  if (
    warning.id !== 'pathway-missing-access' &&
    !warning.id.startsWith('path-clearance-')
  ) {
    return null;
  }

  const bed = findFirstStructure(garden, warning.itemIds);

  if (!bed || !isBedLikeStructure(bed)) {
    return null;
  }

  const path = createAccessPathForBed(garden, bed);

  if (!path) {
    return null;
  }

  return {
    actions: [{ kind: 'addStructure', structure: path }],
    canBatchAccept: false,
    id: `review:add-access-path:${warning.id}`,
    itemIds: [bed.id],
    preview: {
      after: `${path.label} beside ${bed.label}`,
      before: 'No saved access route',
    },
    rationale: warning.message,
    severity: warning.severity,
    source: 'selfFix',
    sourceWarningId: warning.id,
    title: 'Add access path',
    type: 'addAccessPath',
  };
}

export function buildClearPathSuggestion(
  garden: Garden,
  warning: PlanWarning,
): ReviewSuggestion | null {
  if (!warning.id.startsWith('pathway-')) {
    return null;
  }

  const planting = findFirstPlanting(garden, warning.itemIds);

  if (planting) {
    return buildMovePlantingOffPathSuggestion(garden, warning, planting);
  }

  const structure = findFirstStructure(garden, warning.itemIds);

  if (!structure || structure.type !== 'trellis' || structure.locked) {
    return null;
  }

  const point = findNearestStructurePoint(garden, structure, {
    xFt: structure.xFt + 1.5,
    yFt: structure.yFt + 1.5,
  });

  if (!point) {
    return null;
  }

  return {
    actions: [
      {
        id: structure.id,
        kind: 'updateStructure',
        values: {
          notes: appendNote(
            structure.notes,
            `${reviewMarker} Moved off a saved access path from Review.`,
          ),
          xFt: point.xFt,
          yFt: point.yFt,
        },
      },
    ],
    canBatchAccept: false,
    id: `review:clear-path:${warning.id}`,
    itemIds: warning.itemIds,
    preview: {
      after: `${structure.label} at ${formatPoint(point)}`,
      before: `${structure.label} overlaps a path`,
    },
    rationale: warning.message,
    severity: warning.severity,
    source: 'selfFix',
    sourceWarningId: warning.id,
    title: 'Clear access path',
    type: 'clearPathway',
  };
}

function buildMovePlantingOffPathSuggestion(
  garden: Garden,
  warning: PlanWarning,
  planting: Planting,
): ReviewSuggestion | null {
  if (planting.locked) {
    return null;
  }

  const point = findNearestLegalPoint(garden, planting, {
    xFt: planting.xFt + 1.5,
    yFt: planting.yFt + 1.5,
  });

  if (!point) {
    return null;
  }

  return {
    actions: [
      {
        id: planting.id,
        kind: 'updatePlanting',
        values: {
          notes: appendNote(
            planting.notes,
            `${reviewMarker} Moved off a saved access path from Review.`,
          ),
          xFt: point.xFt,
          yFt: point.yFt,
        },
      },
    ],
    canBatchAccept: false,
    id: `review:clear-path:${warning.id}`,
    itemIds: warning.itemIds,
    preview: {
      after: `${planting.label} at ${formatPoint(point)}`,
      before: `${planting.label} at ${formatPoint(planting)}`,
    },
    rationale: warning.message,
    severity: warning.severity,
    source: 'selfFix',
    sourceWarningId: warning.id,
    title: 'Clear access path',
    type: 'clearPathway',
  };
}

function createAccessPathForBed(garden: Garden, bed: Structure) {
  const pathWidthFt = getPathRequiredWidthFt(
    createDefaultStructure({
      id: 'path-standard-preview',
      type: 'pathway',
      xFt: 0,
      yFt: 0,
    }),
  );
  const horizontalWidthFt = Math.min(
    garden.plot.widthFt,
    Math.max(bed.widthFt, pathWidthFt),
  );
  const verticalDepthFt = Math.min(
    garden.plot.depthFt,
    Math.max(bed.depthFt, pathWidthFt),
  );
  const options = [
    {
      depthFt: pathWidthFt,
      widthFt: horizontalWidthFt,
      xFt: clamp(bed.xFt, 0, garden.plot.widthFt - horizontalWidthFt),
      yFt: bed.yFt + bed.depthFt,
    },
    {
      depthFt: pathWidthFt,
      widthFt: horizontalWidthFt,
      xFt: clamp(bed.xFt, 0, garden.plot.widthFt - horizontalWidthFt),
      yFt: bed.yFt - pathWidthFt,
    },
    {
      depthFt: verticalDepthFt,
      widthFt: pathWidthFt,
      xFt: bed.xFt + bed.widthFt,
      yFt: clamp(bed.yFt, 0, garden.plot.depthFt - verticalDepthFt),
    },
    {
      depthFt: verticalDepthFt,
      widthFt: pathWidthFt,
      xFt: bed.xFt - pathWidthFt,
      yFt: clamp(bed.yFt, 0, garden.plot.depthFt - verticalDepthFt),
    },
  ];

  for (const option of options) {
    const candidate = {
      ...createDefaultStructure({
        id: `${reviewMarker}-add-access-path-${bed.id}`,
        type: 'pathway',
        xFt: snap(option.xFt, garden.plot.snapUnitFt),
        yFt: snap(option.yFt, garden.plot.snapUnitFt),
      }),
      continuousPath: true,
      depthFt: option.depthFt,
      label: `${bed.label} access path`,
      notes: `${reviewMarker} Added from Review to keep ${bed.label} reachable.`,
      widthFt: option.widthFt,
    };

    if (isPathCandidateLegal(garden, candidate)) {
      return candidate;
    }
  }

  return null;
}

function findNearestStructurePoint(
  garden: Garden,
  structure: Structure,
  desired: { xFt: number; yFt: number },
) {
  const step = garden.plot.snapUnitFt * 2;
  const candidates: Array<{ xFt: number; yFt: number }> = [];

  for (
    let yFt = 0;
    yFt <= garden.plot.depthFt - structure.depthFt + 0.001;
    yFt += step
  ) {
    for (
      let xFt = 0;
      xFt <= garden.plot.widthFt - structure.widthFt + 0.001;
      xFt += step
    ) {
      const point = {
        xFt: snap(xFt, garden.plot.snapUnitFt),
        yFt: snap(yFt, garden.plot.snapUnitFt),
      };

      if (isStructurePositionLegal(garden, structure, point)) {
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

function isPathCandidateLegal(garden: Garden, path: Structure) {
  const pathFootprint = getStructureFootprint(path);
  const blockingRects = [
    ...garden.plantings.map(getPlantingFootprint),
    ...garden.structures
      .filter((structure) => !isPathStructure(structure))
      .map(getStructureFootprint),
  ];

  return (
    isRectInsidePlot(pathFootprint, garden.plot) &&
    !blockingRects.some((rect) => rectsOverlap(rect, pathFootprint))
  );
}

function isStructurePositionLegal(
  garden: Garden,
  structure: Structure,
  point: { xFt: number; yFt: number },
) {
  const moved = {
    ...structure,
    xFt: point.xFt,
    yFt: point.yFt,
  };
  const rect = getStructureFootprint(moved);
  const blockers = [
    ...garden.plantings.map(getPlantingFootprint),
    ...garden.structures
      .filter(
        (candidate) =>
          candidate.id !== structure.id &&
          (isPathStructure(candidate) || candidate.type === 'trellis'),
      )
      .map(getStructureFootprint),
  ];

  return (
    isRectInsidePlot(rect, garden.plot) &&
    !blockers.some((blocker) => rectsOverlap(rect, blocker))
  );
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
