import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  Garden,
  Planting,
  Structure,
} from '../../domain/gardens/GardenRepository';
import {
  getPlantingFootprint,
  getStructureFootprint,
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

  const type = supportNeed.kind === 'trellis' ? 'addTrellis' : 'addStakeCage';
  const support = createSupportStructure(
    garden,
    planting,
    type,
    supportNeed.kind,
  );

  if (!support) {
    return null;
  }

  const supportLabel = getSupportLabel(supportNeed.kind);

  return {
    actions: [{ kind: 'addStructure', structure: support }],
    canBatchAccept: true,
    id: `review:${type}:${planting.id}`,
    itemIds: [planting.id],
    preview: {
      after: `${support.label}, ${formatMeasure(support.widthFt)} ft ${supportLabel}`,
      before: 'No saved support within 1 ft',
    },
    rationale:
      type === 'addTrellis'
        ? `${planting.label} needs trellis support from crop data.`
        : `${planting.label} benefits from a ${supportLabel}.`,
    severity: warning.severity,
    source: 'selfFix',
    sourceWarningId: warning.id,
    title: type === 'addTrellis' ? 'Add trellis' : 'Add stake or cage',
    type,
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

function createSupportStructure(
  garden: Garden,
  planting: Planting,
  type: 'addStakeCage' | 'addTrellis',
  supportKind: 'cage' | 'stake' | 'trellis',
): Structure | null {
  const crop = planting.cropId ? getCropById(planting.cropId) : null;
  const footprint = getPlantingFootprint(planting);
  const widthFt = Math.min(
    Math.max(
      supportKind === 'trellis'
        ? estimateSupportLengthFt(planting, crop)
        : footprint.widthFt,
      supportKind === 'trellis' ? 2 : 1,
    ),
    garden.plot.widthFt,
  );
  const depthFt = supportKind === 'trellis' ? 0.5 : 1;
  const placement = findSupportPlacement(garden, footprint, widthFt, depthFt);

  if (!placement) {
    return null;
  }

  const supportLabel = getSupportLabel(supportKind);
  const label =
    supportKind === 'trellis'
      ? `${planting.label} trellis`
      : `${planting.label} ${supportLabel}`;

  return {
    accessiblePath: false,
    canopyRadiusFt: null,
    continuousPath: false,
    depthFt,
    drainageProfile: 'normal',
    heightFt: Math.max((crop?.matureHeightInches ?? 60) / 12, 4),
    id: `${reviewMarker}-${type}-${planting.id}`,
    irrigationZone: null,
    label,
    locked: false,
    material: 'wire',
    mulched: false,
    notes: `${reviewMarker} ${
      supportKind === 'trellis' ? 'Trellis' : capitalize(supportLabel)
    } support accepted from Review.`,
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
    {
      xFt: clamp(
        cropFootprint.xFt + cropFootprint.widthFt / 2 - widthFt / 2,
        0,
        garden.plot.widthFt - widthFt,
      ),
      yFt: clamp(
        cropFootprint.yFt + cropFootprint.depthFt / 2 - depthFt / 2,
        0,
        garden.plot.depthFt - depthFt,
      ),
    },
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

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
