import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  Garden,
  Planting,
  PlantSupportPlan,
  PlantSupportType,
  Structure,
} from '../../domain/gardens/GardenRepository';
import {
  findPlanWarnings,
  getPlantingFootprint,
  getStructureFootprint,
  isActivePlanWarning,
  rectsOverlap,
  type PlanWarning,
} from './gardenPlanning';
import { isRectInsidePlot } from './gardenPlanningGeometry';
import {
  clamp,
  findFirstPlanting,
  findFirstStructure,
  isPath,
} from './reviewSuggestionGeometry';
import {
  estimateSupportLengthFt,
  getCropSupportNeed,
  getPathNarrowDimension,
  getPathRequiredWidthFt,
  getSupportLabel,
  getWalkablePathWidthFt,
  isBlockingStructure,
  type PlantLevelSupportKind,
} from './gardenStructureRules';
import {
  appendNote,
  formatMeasure,
  formatPlantingMode,
  reviewMarker,
  type ReviewSuggestion,
} from './reviewSuggestionModel';

export function buildSupportSuggestion(
  garden: Garden,
  warning: PlanWarning,
): ReviewSuggestion | null {
  const planting = findFirstPlanting(garden, warning.itemIds);

  if (!planting) {
    return null;
  }

  const crop = planting.cropId ? getCropById(planting.cropId) : null;
  const supportNeed = crop ? getCropSupportNeed(crop) : null;

  if (!supportNeed) {
    return null;
  }

  const supportLabel = getSupportLabel(supportNeed.kind);

  if (supportNeed.kind !== 'trellis') {
    const support = createPlantSupportUpdate(
      planting,
      supportNeed.kind,
      supportNeed.required,
    );

    return {
      actions: [
        {
          id: planting.id,
          kind: 'updatePlanting',
          values: { support },
        },
      ],
      canBatchAccept: true,
      id: `review:addStakeCage:${planting.id}`,
      itemIds: [planting.id],
      preview: {
        after: `${support.quantity} ${supportLabel}${support.quantity === 1 ? '' : 's'} assigned to plant group`,
        before: 'No plant-level support assigned',
      },
      rationale: `${planting.label} is missing a ${supportLabel}. This assigns ${support.quantity} ${supportLabel}${support.quantity === 1 ? '' : 's'} on the plant group, without adding a standalone grid object.${getSupportSafetyNote(
        garden,
        {
          ...garden,
          plantings: garden.plantings.map((candidate) =>
            candidate.id === planting.id
              ? {
                  ...candidate,
                  support,
                }
              : candidate,
          ),
        },
      )}`,
      severity: warning.severity,
      source: 'selfFix',
      sourceWarningId: warning.id,
      title: 'Add stake or cage',
      type: 'addStakeCage',
    };
  }

  const support = createTrellisStructure(garden, planting, 'addTrellis');

  if (!support) {
    return null;
  }
  const linkedPlanting = {
    ...planting,
    supportStructureIds: [
      ...new Set([...planting.supportStructureIds, support.id]),
    ],
    trellisLengthFt: support.widthFt,
  };
  const nextGarden = {
    ...garden,
    plantings: garden.plantings.map((candidate) =>
      candidate.id === planting.id ? linkedPlanting : candidate,
    ),
    structures: [...garden.structures, support],
  };
  const safetyNote = getSupportSafetyNote(garden, nextGarden);

  return {
    actions: [
      { kind: 'addStructure', structure: support },
      {
        id: planting.id,
        kind: 'updatePlanting',
        values: {
          supportStructureIds: linkedPlanting.supportStructureIds,
          trellisLengthFt: linkedPlanting.trellisLengthFt,
        },
      },
    ],
    canBatchAccept: false,
    id: `review:addTrellis:${planting.id}`,
    itemIds: [planting.id],
    preview: {
      after: `${support.label}, ${formatMeasure(support.widthFt)} ft ${supportLabel}`,
      before: 'No saved trellis within 1 ft',
    },
    rationale: `${planting.label} is missing a grid trellis. This adds ${support.label} next to the footprint and keeps it out of saved paths.${safetyNote}`,
    severity: warning.severity,
    source: 'selfFix',
    sourceWarningId: warning.id,
    title: 'Add trellis',
    type: 'addTrellis',
  };
}

export function buildTrellisedLayoutSuggestion(
  garden: Garden,
  warning: PlanWarning,
): ReviewSuggestion | null {
  const planting = findFirstPlanting(garden, warning.itemIds);

  if (!planting || planting.mode === 'trellisLine') {
    return null;
  }

  const crop = planting.cropId ? getCropById(planting.cropId) : null;

  if (
    !crop ||
    getCropSupportNeed(crop)?.kind !== 'trellis' ||
    !crop.supportedPlantingModes.includes('trellisLine')
  ) {
    return null;
  }

  const footprint = getPlantingFootprint(planting);
  const rowLengthFt = Math.max(
    Math.min(garden.plot.widthFt - 1, footprint.widthFt),
    2,
  );

  return {
    actions: [
      {
        id: planting.id,
        kind: 'updatePlanting',
        values: {
          blockDepthFt: null,
          blockWidthFt: null,
          clusterRadiusFt: null,
          mode: 'trellisLine',
          notes: appendNote(
            planting.notes,
            `${reviewMarker} Converted to a trellised layout from Review.`,
          ),
          rowCount: 1,
          rowLengthFt,
          trellisLengthFt: rowLengthFt,
        },
      },
    ],
    canBatchAccept: false,
    id: `review:convert-trellis:${planting.id}`,
    itemIds: [planting.id],
    preview: {
      after: `Trellis line, ${formatMeasure(rowLengthFt)} ft`,
      before: formatPlantingMode(planting.mode),
    },
    rationale: `${crop.commonName} can be managed more cleanly as a trellised row.`,
    severity: warning.severity,
    source: 'selfFix',
    sourceWarningId: warning.id,
    title: 'Convert to trellised layout',
    type: 'convertToTrellisedLayout',
  };
}

export function buildWidenPathSuggestion(
  garden: Garden,
  warning: PlanWarning,
): ReviewSuggestion | null {
  if (!warning.id.startsWith('path-width-')) {
    return null;
  }

  const path = findFirstStructure(garden, warning.itemIds);

  if (!path || !isPath(path)) {
    return null;
  }

  const dimension = getPathNarrowDimension(path);
  const currentWidthFt = getWalkablePathWidthFt(path);
  const currentDimensionFt = path[dimension];
  const requiredWidthFt = getPathRequiredWidthFt(path);
  const availableFt =
    dimension === 'widthFt'
      ? garden.plot.widthFt - path.xFt
      : garden.plot.depthFt - path.yFt;

  if (availableFt < requiredWidthFt || currentWidthFt >= requiredWidthFt) {
    return null;
  }

  const values =
    dimension === 'widthFt'
      ? {
          notes: appendNote(
            path.notes,
            `${reviewMarker} Widened from Review for saved access clearance.`,
          ),
          widthFt: requiredWidthFt,
        }
      : {
          depthFt: requiredWidthFt,
          notes: appendNote(
            path.notes,
            `${reviewMarker} Widened from Review for saved access clearance.`,
          ),
        };

  if (requiredWidthFt <= currentDimensionFt) {
    return null;
  }

  return {
    actions: [
      {
        id: path.id,
        kind: 'updateStructure',
        values,
      },
    ],
    canBatchAccept: false,
    id: `review:widen-path:${path.id}`,
    itemIds: [path.id],
    preview: {
      after: `${formatMeasure(requiredWidthFt)} ft walkable`,
      before: `${formatMeasure(currentWidthFt)} ft walkable`,
    },
    rationale: `${path.label} is below the saved ${
      path.accessiblePath ? 'accessible' : 'standard'
    } path width.`,
    severity: warning.severity,
    source: 'selfFix',
    sourceWarningId: warning.id,
    title: 'Widen path',
    type: 'widenPath',
  };
}

function createPlantSupportUpdate(
  planting: Planting,
  supportKind: PlantLevelSupportKind,
  required: boolean,
): PlantSupportPlan {
  const quantity = Math.max(Math.round(planting.plantCount ?? 1), 1);
  const supportLabel = getSupportLabel(supportKind);
  const supportType = toPlantSupportType(supportKind);

  return {
    installedAtIso: null,
    notes: `${reviewMarker} ${capitalize(supportLabel)} support assigned from Review.`,
    perPlant: true,
    quantity,
    required,
    type: supportType,
  };
}

function toPlantSupportType(
  supportKind: PlantLevelSupportKind,
): PlantSupportType {
  return supportKind;
}

function createTrellisStructure(
  garden: Garden,
  planting: Planting,
  type: 'addTrellis',
): Structure | null {
  const crop = planting.cropId ? getCropById(planting.cropId) : null;
  const footprint = getPlantingFootprint(planting);
  const widthFt = Math.min(
    Math.max(estimateSupportLengthFt(planting, crop), 2),
    garden.plot.widthFt,
  );
  const depthFt = 0.5;
  const placement = findSupportPlacement(garden, footprint, widthFt, depthFt);

  if (!placement) {
    return null;
  }

  const supportLabel = getSupportLabel('trellis');

  return {
    accessiblePath: false,
    canopyRadiusFt: null,
    continuousPath: false,
    depthFt,
    drainageProfile: 'normal',
    heightFt: Math.max((crop?.matureHeightInches ?? 60) / 12, 4),
    id: `${reviewMarker}-${type}-${planting.id}`,
    irrigationZone: null,
    label: `${planting.label} trellis`,
    locked: false,
    material: 'wire',
    mulched: false,
    notes: `${reviewMarker} ${capitalize(supportLabel)} support accepted from Review.`,
    rotationDegrees: 0,
    soilType: 'unknown',
    type: 'trellis',
    widthFt,
    workingClearanceFt: 1,
    xFt: placement.xFt,
    yFt: placement.yFt,
  };
}

function findSupportPlacement(
  garden: Garden,
  cropFootprint: ReturnType<typeof getPlantingFootprint>,
  widthFt: number,
  depthFt: number,
) {
  const xFt = clamp(cropFootprint.xFt, 0, garden.plot.widthFt - widthFt);
  const blockedRects = garden.structures
    .filter(isBlockingStructure)
    .map(getStructureFootprint);
  const options = [
    { xFt, yFt: cropFootprint.yFt - depthFt },
    { xFt, yFt: cropFootprint.yFt + cropFootprint.depthFt },
  ];

  return options.find((option) => {
    const supportFootprint = {
      depthFt,
      id: 'review-support-preview',
      itemType: 'structure' as const,
      label: 'Support preview',
      widthFt,
      xFt: option.xFt,
      yFt: option.yFt,
    };

    return (
      isRectInsidePlot(supportFootprint, garden.plot) &&
      !blockedRects.some((rect) => rectsOverlap(rect, supportFootprint))
    );
  });
}

function getSupportSafetyNote(garden: Garden, nextGarden: Garden) {
  const beforeWarningIds = new Set(
    findPlanWarnings(garden)
      .filter(isActivePlanWarning)
      .map((warning) => warning.id),
  );
  const introducedWarnings = findPlanWarnings(nextGarden)
    .filter(isActivePlanWarning)
    .filter((warning) => !beforeWarningIds.has(warning.id))
    .map((warning) => warning.title);

  return introducedWarnings.length > 0
    ? ` New issue to review after this support: ${[
        ...new Set(introducedWarnings),
      ].join(', ')}.`
    : ' It does not introduce a new active plan warning.';
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
