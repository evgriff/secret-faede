import type {
  Garden,
  Planting,
  PlantingInstance,
  SunShadeArea,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import { getPlantingInstances } from '../../domain/gardens/plantingInstances';
import { formatFeet } from '../garden/gardenMath';
import type { PlanWarning } from '../garden/gardenPlanning';
import { getPlantingFocusKey } from './planCropFocus';

export type PlanInfluenceZoneKind = 'shade' | 'spacing';

export interface PlanInfluenceZone {
  depthFt: number;
  id: string;
  kind: PlanInfluenceZoneKind;
  label: string;
  warning: boolean;
  widthFt: number;
  xFt: number;
  yFt: number;
}

export interface PlanInfluenceOverlayModel {
  focusKey: string;
  summary: {
    keepAway: string;
    shade: string;
    warnings: string[];
  };
  zones: PlanInfluenceZone[];
}

export function buildPlanInfluenceOverlay({
  focusKey,
  garden,
  sunLayer,
  warnings,
}: {
  focusKey: string | null;
  garden: Garden;
  sunLayer: SunShadeLayer;
  warnings: PlanWarning[];
}): PlanInfluenceOverlayModel | null {
  if (!focusKey) {
    return null;
  }

  const matchingPlantings = garden.plantings.filter(
    (planting) =>
      isActivePlanting(planting) && getPlantingFocusKey(planting) === focusKey,
  );

  if (matchingPlantings.length === 0) {
    return null;
  }

  const matchingPlantingIds = new Set(
    matchingPlantings.map((planting) => planting.id),
  );
  const relevantWarnings = warnings.filter(
    (warning) =>
      ['spacing', 'structure', 'sun', 'trellis'].includes(warning.kind) &&
      warning.itemIds.some((itemId) => matchingPlantingIds.has(itemId)),
  );
  const warningPlantingIds = new Set(
    relevantWarnings.flatMap((warning) =>
      warning.itemIds.filter((itemId) => matchingPlantingIds.has(itemId)),
    ),
  );
  const spacingZones = matchingPlantings.flatMap((planting) =>
    getPlantingInstances(planting).map((instance) =>
      createSpacingZone({
        instance,
        planting,
        warning: warningPlantingIds.has(planting.id),
      }),
    ),
  );
  const shadeZones = createShadeZones({
    matchingPlantingIds,
    sunLayer,
    warnings: relevantWarnings,
  });

  return {
    focusKey,
    summary: {
      keepAway: formatKeepAwaySummary(matchingPlantings),
      shade: formatShadeSummary(matchingPlantings, shadeZones),
      warnings: relevantWarnings.map((warning) => warning.title).slice(0, 3),
    },
    zones: [...spacingZones, ...shadeZones],
  };
}

function createSpacingZone({
  instance,
  planting,
  warning,
}: {
  instance: PlantingInstance;
  planting: Planting;
  warning: boolean;
}): PlanInfluenceZone {
  const diameterFt = getSpacingInfluenceDiameterFt(planting);

  return {
    depthFt: diameterFt,
    id: `spacing-${planting.id}-${instance.id}`,
    kind: 'spacing',
    label: `${instance.label || planting.label} keep-away diameter ${formatFeet(
      diameterFt,
    )} ft`,
    warning,
    widthFt: diameterFt,
    xFt: instance.xFt - diameterFt / 2,
    yFt: instance.yFt - diameterFt / 2,
  };
}

function createShadeZones({
  matchingPlantingIds,
  sunLayer,
  warnings,
}: {
  matchingPlantingIds: Set<string>;
  sunLayer: SunShadeLayer;
  warnings: PlanWarning[];
}) {
  const hasSunWarning = warnings.some((warning) => warning.kind === 'sun');

  return sunLayer.areas
    .flatMap((area) => {
      const shadeSource = getMatchingPlantingShadeSource(
        area,
        matchingPlantingIds,
      );

      if (!shadeSource) {
        return [];
      }

      return [
        {
          depthFt: area.depthFt,
          id: `shade-${area.id}-${shadeSource.itemId}`,
          kind: 'shade' as const,
          label: `${shadeSource.label} modeled shade: ${area.sunHours.toFixed(
            1,
          )} direct-sun hours`,
          warning: hasSunWarning,
          widthFt: area.widthFt,
          xFt: area.xFt,
          yFt: area.yFt,
        },
      ];
    })
    .slice(0, 160);
}

function getMatchingPlantingShadeSource(
  area: SunShadeArea,
  matchingPlantingIds: Set<string>,
) {
  return area.shadeSources?.find(
    (source) =>
      source.itemType === 'planting' && matchingPlantingIds.has(source.itemId),
  );
}

function formatKeepAwaySummary(plantings: Planting[]) {
  const diameterFt = Math.max(...plantings.map(getSpacingInfluenceDiameterFt));

  return `${formatFeet(diameterFt / 2)} ft keep-away radius from saved crop spacing`;
}

function formatShadeSummary(
  plantings: Planting[],
  shadeZones: PlanInfluenceZone[],
) {
  if (shadeZones.length > 0) {
    return `${shadeZones.length} modeled shade ${
      shadeZones.length === 1 ? 'cell' : 'cells'
    } from this crop in the active season`;
  }

  return plantings.some(castsPlantingShade)
    ? 'No modeled shade cells from this crop in the active season'
    : 'No tall-crop shade influence for this crop';
}

function getSpacingInfluenceDiameterFt(planting: Planting) {
  return Math.max(
    (planting.spacingInches ?? planting.matureSpreadInches ?? 12) / 12,
    0.75,
  );
}

function castsPlantingShade(planting: Planting) {
  return (
    planting.mode === 'trellisLine' ||
    (planting.trellisLengthFt ?? 0) > 0 ||
    (planting.matureHeightInches ?? 0) >= 48
  );
}

function isActivePlanting(planting: Planting) {
  return planting.status !== 'removed' && planting.status !== 'harvested';
}
