import type {
  CropProfile,
  Garden,
  Planting,
  SunExposure,
  SunShadeArea,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import { getPlantingFootprint, type FootRect } from '../garden/gardenPlanning';
import { rectDistanceFt } from '../garden/gardenPlanningGeometry';
import { getSunAreaAtPoint } from '../garden/sunShadeEngine';
import { scoreShadeManagement } from './autoLayoutShadeScoring';
import type { SeasonCropFitLevel } from './seasonCropPlan';
import type { AutoLayoutScoreBreakdown } from './autoLayoutTypes';

export interface ScoredPlacement {
  crop: CropProfile;
  fitLevel: SeasonCropFitLevel;
  planting: Planting;
}

export function scoreSunFit(crop: CropProfile, actual: SunExposure | null) {
  if (!actual) {
    return 0.55;
  }

  const scores: Record<SunExposure, Record<SunExposure, number>> = {
    fullShade: { fullShade: 1, partShade: 0.85, partSun: 0.4, fullSun: 0.15 },
    fullSun: { fullShade: 0.05, partShade: 0.3, partSun: 0.72, fullSun: 1 },
    partShade: { fullShade: 0.65, partShade: 1, partSun: 0.8, fullSun: 0.45 },
    partSun: { fullShade: 0.2, partShade: 0.72, partSun: 1, fullSun: 0.85 },
  };

  return scores[crop.sunRequirement][actual];
}

export function scoreSunAreaFit(crop: CropProfile, area: SunShadeArea | null) {
  const base = scoreSunFit(crop, area?.exposure ?? null);

  if (
    crop.sunRequirement === 'fullSun' &&
    area?.shadeSources?.some((source) =>
      ['tallCrop', 'trellisedCrop'].includes(source.kind),
    ) &&
    base < 1
  ) {
    return Math.max(0, base - 0.08);
  }

  return base;
}

export function scoreSunFootprintFit(
  crop: CropProfile,
  layer: SunShadeLayer | null,
  planting: Planting,
) {
  if (!layer) {
    return scoreSunAreaFit(crop, null);
  }

  const footprint = getPlantingFootprint(planting);
  const areas = layer.areas.filter((area) => rectsTouch(footprint, area));

  return average(
    (areas.length > 0
      ? areas
      : [getSunAreaAtPoint(layer, planting)].filter(Boolean)
    ).map((area) => scoreSunAreaFit(crop, area)),
  );
}

export function scoreAccess(garden: Garden, planting: Planting) {
  const footprint = getPlantingFootprint(planting);
  const pathFootprints = garden.structures
    .filter(
      (structure) => structure.type === 'path' || structure.type === 'pathway',
    )
    .map((structure) => ({
      depthFt: structure.depthFt,
      id: structure.id,
      itemType: 'structure' as const,
      label: structure.label,
      widthFt: structure.widthFt,
      xFt: structure.xFt,
      yFt: structure.yFt,
    }));
  const edgeDistance = Math.min(
    footprint.xFt,
    footprint.yFt,
    garden.plot.widthFt - (footprint.xFt + footprint.widthFt),
    garden.plot.depthFt - (footprint.yFt + footprint.depthFt),
  );
  const pathDistance =
    pathFootprints.length > 0
      ? Math.min(
          ...pathFootprints.map((pathFootprint) =>
            rectDistanceFt(footprint, pathFootprint),
          ),
        )
      : edgeDistance;
  const distance = Math.max(Math.min(pathDistance, edgeDistance), 0);

  return Math.max(0, 1 - distance / 6);
}

export function scoreSupportPlacement(
  garden: Garden,
  placement: ScoredPlacement,
) {
  const needsSupport =
    placement.crop.trellisRequired ||
    placement.crop.trellisRecommended ||
    placement.crop.growthForm === 'climber' ||
    placement.crop.growthForm === 'vining';

  if (!needsSupport) {
    return 1;
  }

  const footprint = getPlantingFootprint(placement.planting);
  const nearExistingTrellis = garden.structures.some(
    (structure) =>
      structure.type === 'trellis' &&
      rectDistanceFt(footprint, {
        depthFt: structure.depthFt,
        id: structure.id,
        itemType: 'structure',
        label: structure.label,
        widthFt: structure.widthFt,
        xFt: structure.xFt,
        yFt: structure.yFt,
      }) <= 1.25,
  );

  if (nearExistingTrellis || placement.planting.mode === 'trellisLine') {
    return 1;
  }

  return 0.68;
}

export function scoreNorthTallPlacement(
  garden: Garden,
  placement: ScoredPlacement,
) {
  const heightInches = placement.crop.matureHeightInches ?? 18;

  if (heightInches < 42 && !placement.crop.trellisRequired) {
    return 0.9;
  }

  const northness = 1 - placement.planting.yFt / garden.plot.depthFt;

  return clamp01(0.35 + northness * 0.65);
}

export function scoreSeasonalSuitability(level: SeasonCropFitLevel) {
  const scores: Record<SeasonCropFitLevel, number> = {
    caution: 0.58,
    greatFit: 1,
    unlikelyFit: 0.22,
    workable: 0.82,
  };

  return scores[level];
}

export function scoreWaterGrouping(placements: ScoredPlacement[]) {
  if (placements.length < 2) {
    return 1;
  }

  let comparisons = 0;
  let score = 0;

  for (let leftIndex = 0; leftIndex < placements.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < placements.length;
      rightIndex += 1
    ) {
      const left = placements[leftIndex];
      const right = placements[rightIndex];

      if (!left || !right) {
        continue;
      }

      const distance = rectDistanceFt(
        getPlantingFootprint(left.planting),
        getPlantingFootprint(right.planting),
      );
      const close = distance <= 4;
      const sameWater = left.crop.waterNeeds === right.crop.waterNeeds;

      comparisons += 1;
      score += sameWater === close ? 1 : 0.55;
    }
  }

  return comparisons ? score / comparisons : 1;
}

export function scoreCompatibleGrouping(
  placement: ScoredPlacement,
  existingPlacements: ScoredPlacement[],
) {
  if (existingPlacements.length === 0) {
    return 1;
  }

  let comparisons = 0;
  let score = 0;

  for (const existingPlacement of existingPlacements) {
    const distance = rectDistanceFt(
      getPlantingFootprint(placement.planting),
      getPlantingFootprint(existingPlacement.planting),
    );
    const close = distance <= 4;
    const compatible =
      placement.crop.waterNeeds === existingPlacement.crop.waterNeeds &&
      compatibleSunNeeds(
        placement.crop.sunRequirement,
        existingPlacement.crop.sunRequirement,
      );
    const bothTall =
      isTallCrop(placement.crop) && isTallCrop(existingPlacement.crop);

    comparisons += 1;
    score += compatible === close || (bothTall && close) ? 1 : 0.62;
  }

  return comparisons ? score / comparisons : 1;
}

export function scoreSpacingQuality(placements: ScoredPlacement[]) {
  if (placements.length < 2) {
    return 1;
  }

  let comparisons = 0;
  let score = 0;

  for (let leftIndex = 0; leftIndex < placements.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < placements.length;
      rightIndex += 1
    ) {
      const left = placements[leftIndex];
      const right = placements[rightIndex];

      if (!left || !right) {
        continue;
      }

      const distance = rectDistanceFt(
        getPlantingFootprint(left.planting),
        getPlantingFootprint(right.planting),
      );

      comparisons += 1;
      score += distance >= 0.5 ? 1 : distance >= 0.125 ? 0.82 : 0.62;
    }
  }

  return comparisons ? score / comparisons : 1;
}

export function buildScoreBreakdown({
  garden,
  placements,
}: {
  garden: Garden;
  placements: ScoredPlacement[];
}): AutoLayoutScoreBreakdown {
  const seasonalSuitability = average(
    placements.map((placement) => scoreSeasonalSuitability(placement.fitLevel)),
  );
  const shadeManagement = scoreShadeManagement(garden, placements);
  const spacingQuality = scoreSpacingQuality(placements);
  const waterGrouping = scoreWaterGrouping(placements);

  return {
    seasonalSuitability,
    shadeManagement,
    spacingQuality,
    waterGrouping,
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 1;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function rectsTouch(
  left: FootRect,
  right: Pick<FootRect, 'depthFt' | 'widthFt' | 'xFt' | 'yFt'>,
) {
  return (
    left.xFt < right.xFt + right.widthFt &&
    left.xFt + left.widthFt > right.xFt &&
    left.yFt < right.yFt + right.depthFt &&
    left.yFt + left.depthFt > right.yFt
  );
}

function compatibleSunNeeds(left: SunExposure, right: SunExposure) {
  if (left === right) {
    return true;
  }

  return [left, right].every((exposure) =>
    ['partShade', 'partSun'].includes(exposure),
  );
}

function isTallCrop(crop: CropProfile) {
  return (crop.matureHeightInches ?? 0) >= 42 || crop.trellisRecommended;
}
