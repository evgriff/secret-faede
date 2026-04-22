import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  Garden,
  Planting,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import { getSunAreaAtPoint } from './sunShadeEngine';
import type { PlanWarning } from './gardenPlanning';
import {
  createReviewNoteAction,
  findBedPlacement,
  findFirstPlanting,
  findNearestLegalPoint,
  findSunFitPoint,
} from './reviewSuggestionGeometry';
import {
  appendNote,
  formatPoint,
  formatSun,
  reviewMarker,
  type ReviewSuggestion,
  type ReviewSuggestionType,
} from './reviewSuggestionModel';

export function buildSplitSuggestion(
  garden: Garden,
  warning: PlanWarning,
): ReviewSuggestion | null {
  const plantings = warning.itemIds
    .map((id) => garden.plantings.find((planting) => planting.id === id))
    .filter((planting): planting is Planting => Boolean(planting));
  const planting = plantings[1] ?? plantings[0];

  if (!planting) {
    return null;
  }

  const point = findNearestLegalPoint(garden, planting, {
    xFt: planting.xFt + 1.5,
    yFt: planting.yFt + 1.5,
  });

  if (!point) {
    return createFlagSuggestion(garden, warning);
  }

  return {
    actions: [
      {
        id: planting.id,
        kind: 'updatePlanting',
        values: {
          notes: appendNote(
            planting.notes,
            `${reviewMarker} Moved from an overcrowded footprint in Review.`,
          ),
          xFt: point.xFt,
          yFt: point.yFt,
        },
      },
    ],
    canBatchAccept: false,
    confidence: 'medium',
    id: `review:split-overcrowded:${warning.id}`,
    itemIds: warning.itemIds,
    preview: {
      after: `${planting.label} at ${formatPoint(point)}`,
      before: `${planting.label} at ${formatPoint(planting)}`,
    },
    rationale: warning.message,
    severity: warning.severity,
    source: 'selfFix',
    sourceWarningId: warning.id,
    title: 'Split overcrowded planting',
    type: 'splitOvercrowdedPlanting',
  };
}

export function buildReassignCropSuggestion(
  garden: Garden,
  warning: PlanWarning,
): ReviewSuggestion | null {
  const planting = findFirstPlanting(garden, warning.itemIds);

  if (!planting) {
    return null;
  }

  const target = findBedPlacement(
    garden,
    planting,
    warning.kind === 'container',
  );

  if (!target) {
    return createFlagSuggestion(garden, warning);
  }

  return {
    actions: [
      {
        id: planting.id,
        kind: 'updatePlanting',
        values: {
          notes: appendNote(
            planting.notes,
            `${reviewMarker} Reassigned to ${target.bed.label} from Review.`,
          ),
          xFt: target.point.xFt,
          yFt: target.point.yFt,
        },
      },
    ],
    canBatchAccept: false,
    confidence: 'medium',
    id: `review:reassign-bed:${planting.id}:${target.bed.id}`,
    itemIds: [planting.id, target.bed.id],
    preview: {
      after: `${target.bed.label} at ${formatPoint(target.point)}`,
      before: formatPoint(planting),
    },
    rationale: warning.message,
    severity: warning.severity,
    source: 'selfFix',
    sourceWarningId: warning.id,
    title: 'Reassign crop to bed',
    type: 'reassignCropToBed',
  };
}

export function buildSunMoveSuggestion(
  garden: Garden,
  warning: PlanWarning,
  sunLayer: SunShadeLayer | null,
): ReviewSuggestion | null {
  const planting = findFirstPlanting(garden, warning.itemIds);
  const crop = planting?.cropId ? getCropById(planting.cropId) : null;

  if (!planting || !crop || !sunLayer) {
    return null;
  }

  const point = findSunFitPoint(
    garden,
    planting,
    crop.sunRequirement,
    sunLayer,
  );

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
            `${reviewMarker} Moved to better ${formatSun(
              crop.sunRequirement,
            )} from Review.`,
          ),
          xFt: point.xFt,
          yFt: point.yFt,
        },
      },
    ],
    canBatchAccept: false,
    confidence: 'medium',
    id: `review:move-sun:${planting.id}`,
    itemIds: [planting.id],
    preview: {
      after: `${formatSun(crop.sunRequirement)} at ${formatPoint(point)}`,
      before: `${formatSun(
        getSunAreaAtPoint(sunLayer, planting)?.exposure ?? null,
      )} at ${formatPoint(planting)}`,
    },
    rationale: warning.message,
    severity: warning.severity,
    source: 'selfFix',
    sourceWarningId: warning.id,
    title:
      crop.sunRequirement === 'partShade' || crop.sunRequirement === 'partSun'
        ? 'Move shade-tolerant crop'
        : 'Move crop to better sun',
    type:
      crop.sunRequirement === 'partShade' || crop.sunRequirement === 'partSun'
        ? 'moveShadeTolerantCrop'
        : 'flagSunMismatch',
  };
}

export function createFlagSuggestion(
  garden: Garden,
  warning: PlanWarning,
  type: ReviewSuggestionType = 'flagSunMismatch',
): ReviewSuggestion | null {
  const itemId = warning.itemIds[0];

  if (!itemId) {
    return null;
  }

  const action = createReviewNoteAction(
    garden,
    itemId,
    `${reviewMarker} ${warning.title}: ${warning.fix}`,
  );

  if (!action) {
    return null;
  }

  const resolvedType =
    type === 'flagSunMismatch' && warning.kind === 'rotation'
      ? 'flagRotationConcern'
      : type;

  return {
    actions: [action],
    canBatchAccept: false,
    confidence: warning.severity === 'critical' ? 'high' : 'medium',
    id: `review:${resolvedType}:${warning.id}`,
    itemIds: warning.itemIds,
    preview: {
      after: 'Saved to item notes',
      before: 'Not tracked on the draft',
    },
    rationale: warning.message,
    severity: warning.severity,
    source: 'planHealth',
    sourceWarningId: warning.id,
    title:
      resolvedType === 'flagRotationConcern'
        ? 'Flag rotation concern'
        : resolvedType === 'flagWaterZoneMismatch'
          ? 'Flag water-zone mismatch'
          : warning.title,
    type: resolvedType,
  };
}
