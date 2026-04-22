import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  Garden,
  Planting,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import {
  doesPlantingReserveSpace,
  isPlantingAnchoredByLifecycle,
} from './gardenImmutability';
import { getSunAreaAtPoint } from './sunShadeEngine';
import {
  findNorthLegalPoint,
  findSunFitPoint,
  isBedLike,
  pointInsideStructure,
} from './reviewSuggestionGeometry';
import {
  appendNote,
  formatPoint,
  formatSun,
  reviewMarker,
  type ReviewSuggestion,
} from './reviewSuggestionModel';

export function buildTallCropSuggestions(garden: Garden): ReviewSuggestion[] {
  return garden.plantings.flatMap((planting): ReviewSuggestion[] => {
    const crop = planting.cropId ? getCropById(planting.cropId) : null;

    if (
      !doesPlantingReserveSpace(planting) ||
      isPlantingAnchoredByLifecycle(planting) ||
      !crop ||
      (crop.matureHeightInches ?? 0) < 42 ||
      planting.yFt <= garden.plot.depthFt * 0.35
    ) {
      return [];
    }

    const point = findNorthLegalPoint(garden, planting);

    if (!point) {
      return [];
    }

    return [
      {
        actions: [
          {
            id: planting.id,
            kind: 'updatePlanting',
            values: {
              notes: appendNote(
                planting.notes,
                `${reviewMarker} Moved north/up-sun to reduce shade pressure.`,
              ),
              xFt: point.xFt,
              yFt: point.yFt,
            },
          },
        ],
        canBatchAccept: false,
        confidence: 'medium',
        id: `review:move-tall-north:${planting.id}`,
        itemIds: [planting.id],
        preview: {
          after: formatPoint(point),
          before: formatPoint(planting),
        },
        rationale: `${crop.commonName} is tall enough to shade shorter crops if it sits low in the plot.`,
        severity: 'info',
        source: 'selfFix',
        sourceWarningId: null,
        title: 'Move tall crop north',
        type: 'moveTallCropNorth',
      },
    ];
  });
}

export function buildShadeCropSuggestions(
  garden: Garden,
  sunLayer: SunShadeLayer | null,
): ReviewSuggestion[] {
  if (!sunLayer) {
    return [];
  }

  return garden.plantings.flatMap((planting): ReviewSuggestion[] => {
    const crop = planting.cropId ? getCropById(planting.cropId) : null;
    const actual = getSunAreaAtPoint(sunLayer, planting)?.exposure ?? null;

    if (
      !doesPlantingReserveSpace(planting) ||
      isPlantingAnchoredByLifecycle(planting) ||
      !crop ||
      actual !== 'fullSun' ||
      (crop.sunRequirement !== 'partShade' && crop.sunRequirement !== 'partSun')
    ) {
      return [];
    }

    const point = findSunFitPoint(
      garden,
      planting,
      crop.sunRequirement,
      sunLayer,
    );

    if (!point) {
      return [];
    }

    return [
      {
        actions: [
          {
            id: planting.id,
            kind: 'updatePlanting',
            values: {
              notes: appendNote(
                planting.notes,
                `${reviewMarker} Moved into intentional partial shade from Review.`,
              ),
              xFt: point.xFt,
              yFt: point.yFt,
            },
          },
        ],
        canBatchAccept: false,
        confidence: 'medium',
        id: `review:move-partial-shade:${planting.id}`,
        itemIds: [planting.id],
        preview: {
          after: `${formatSun(crop.sunRequirement)} pocket at ${formatPoint(
            point,
          )}`,
          before: `full sun at ${formatPoint(planting)}`,
        },
        rationale: `${crop.commonName} can use partial shade, freeing brighter space for full-sun crops.`,
        severity: 'info',
        source: 'selfFix',
        sourceWarningId: null,
        title: 'Move shade-tolerant crop',
        type: 'moveShadeTolerantCrop',
      },
    ];
  });
}

export function buildWaterZoneSuggestions(garden: Garden): ReviewSuggestion[] {
  const beds = garden.structures.filter(isBedLike);

  return beds.flatMap((bed): ReviewSuggestion[] => {
    const plantings = garden.plantings.filter(
      (planting) =>
        planting.status !== 'removed' &&
        pointInsideStructure(planting, bed) &&
        planting.cropId,
    );
    const waterGroups = new Map<string, Planting[]>();

    for (const planting of plantings) {
      const crop = planting.cropId ? getCropById(planting.cropId) : null;

      if (!crop) {
        continue;
      }

      waterGroups.set(crop.waterNeeds, [
        ...(waterGroups.get(crop.waterNeeds) ?? []),
        planting,
      ]);
    }

    const highWater = waterGroups.get('high') ?? [];
    const lowWater = waterGroups.get('low') ?? [];

    if (highWater.length === 0 || lowWater.length === 0) {
      return [];
    }

    const affected = [...highWater, ...lowWater].slice(0, 4);
    const note = `${reviewMarker} ${bed.label} mixes high- and low-water crops. Group watering by hand or move one group later.`;

    if (affected.every((planting) => planting.notes.includes(note))) {
      return [];
    }

    return [
      {
        actions: affected.map((planting) => ({
          id: planting.id,
          kind: 'updatePlanting' as const,
          values: {
            notes: appendNote(planting.notes, note),
          },
        })),
        canBatchAccept: false,
        confidence: 'medium',
        id: `review:water-zone:${bed.id}`,
        itemIds: [bed.id, ...affected.map((planting) => planting.id)],
        preview: {
          after: 'Water-zone note saved',
          before: `${bed.label} mixes high and low water needs`,
        },
        rationale: `${bed.label} contains crops with meaningfully different water needs.`,
        severity: 'info',
        source: 'planHealth',
        sourceWarningId: null,
        title: 'Flag water-zone mismatch',
        type: 'flagWaterZoneMismatch',
      },
    ];
  });
}
