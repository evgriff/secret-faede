import type {
  CropProfile,
  Garden,
  Planting,
  SunExposure,
  SunShadeArea,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import {
  getPlantingFootprint,
  getStructureFootprint,
  rectsOverlap,
  type FootRect,
} from '../garden/gardenPlanning';
import { rectDistanceFt } from '../garden/gardenPlanningGeometry';
import { minimumWorkingAisleWidthFt } from '../garden/gardenStructureRules';
import { getSunAreaAtPoint } from '../garden/sunShadeEngine';
import type { SeasonCropFitLevel } from './seasonCropPlan';
import type { AutoLayoutScoreBreakdown } from './autoLayoutTypes';

export interface ScoredPlacement {
  crop: CropProfile;
  fitLevel: SeasonCropFitLevel;
  planting: Planting;
}

interface AccessRoute {
  clear: boolean;
  distanceFt: number;
  source: 'edge' | 'path';
}

const comfortableWorkingReachFt = 2.5;

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

export function scoreAccess(
  garden: Garden,
  planting: Planting,
  blockedPlantings: Planting[] = [],
) {
  const footprint = getPlantingFootprint(planting);
  const blockedRects = blockedPlantings
    .filter((candidate) => candidate.id !== planting.id)
    .map(getPlantingFootprint);
  const routes = buildAccessRoutes(garden, footprint, blockedRects);

  if (routes.length === 0) {
    return 0.35;
  }

  const orderedRoutes = [...routes].sort(
    (left, right) =>
      Number(right.clear) - Number(left.clear) ||
      left.distanceFt - right.distanceFt,
  );
  const clearRoutes = routes
    .filter((route) => route.clear)
    .sort((left, right) => left.distanceFt - right.distanceFt);
  const bestRoute = clearRoutes[0] ?? orderedRoutes[0];

  if (!bestRoute) {
    return 0.35;
  }

  const distanceScore = clamp01(
    1 - bestRoute.distanceFt / comfortableWorkingReachFt,
  );
  let score = bestRoute.clear
    ? 0.38 + distanceScore * 0.55
    : 0.18 + distanceScore * 0.22;

  if (bestRoute.source === 'path' && bestRoute.distanceFt <= 0.5) {
    score += 0.08;
  }

  if (
    (clearRoutes[1] ?? null) &&
    clearRoutes[1]!.distanceFt <= comfortableWorkingReachFt
  ) {
    score += 0.07;
  }

  return clamp01(score);
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
      placement.crop.waterNeeds === existingPlacement.crop.waterNeeds;

    comparisons += 1;
    score += compatible === close ? 1 : 0.64;
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
  const accessQuality = average(
    placements.map((placement) =>
      scoreAccess(
        garden,
        placement.planting,
        placements
          .filter(
            (candidate) => candidate.planting.id !== placement.planting.id,
          )
          .map((candidate) => candidate.planting),
      ),
    ),
  );
  const spacingQuality = scoreSpacingQuality(placements);
  const structureCompatibility = average(
    placements.map((placement) => scoreSupportPlacement(garden, placement)),
  );
  const waterGrouping = scoreWaterGrouping(placements);

  return {
    accessQuality,
    spacingQuality,
    structureCompatibility,
    waterGrouping,
  };
}

function buildAccessRoutes(
  garden: Garden,
  footprint: FootRect,
  blockedRects: FootRect[],
) {
  return [
    ...buildEdgeAccessRoutes(garden, footprint, blockedRects),
    ...buildPathAccessRoutes(garden, footprint, blockedRects),
  ];
}

function buildEdgeAccessRoutes(
  garden: Garden,
  footprint: FootRect,
  blockedRects: FootRect[],
): AccessRoute[] {
  return [
    buildHorizontalAccessRoute({
      blockedRects,
      boundaryX: 0,
      footprint,
      plotDepthFt: garden.plot.depthFt,
      source: 'edge',
    }),
    buildHorizontalAccessRoute({
      blockedRects,
      boundaryX: garden.plot.widthFt,
      footprint,
      plotDepthFt: garden.plot.depthFt,
      source: 'edge',
    }),
    buildVerticalAccessRoute({
      blockedRects,
      boundaryY: 0,
      footprint,
      plotWidthFt: garden.plot.widthFt,
      source: 'edge',
    }),
    buildVerticalAccessRoute({
      blockedRects,
      boundaryY: garden.plot.depthFt,
      footprint,
      plotWidthFt: garden.plot.widthFt,
      source: 'edge',
    }),
  ];
}

function buildPathAccessRoutes(
  garden: Garden,
  footprint: FootRect,
  blockedRects: FootRect[],
): AccessRoute[] {
  return garden.structures
    .filter(
      (structure) => structure.type === 'path' || structure.type === 'pathway',
    )
    .flatMap((structure) => {
      const path = getStructureFootprint(structure);

      if (path.widthFt <= path.depthFt) {
        if (
          !rangesOverlap(
            path.yFt,
            path.yFt + path.depthFt,
            footprint.yFt,
            footprint.yFt + footprint.depthFt,
          )
        ) {
          return [];
        }

        const boundaryX =
          path.xFt + path.widthFt / 2 <= footprint.xFt + footprint.widthFt / 2
            ? path.xFt + path.widthFt
            : path.xFt;

        return [
          buildHorizontalAccessRoute({
            blockedRects,
            boundaryX,
            footprint,
            plotDepthFt: garden.plot.depthFt,
            source: 'path',
          }),
        ];
      }

      if (
        !rangesOverlap(
          path.xFt,
          path.xFt + path.widthFt,
          footprint.xFt,
          footprint.xFt + footprint.widthFt,
        )
      ) {
        return [];
      }

      const boundaryY =
        path.yFt + path.depthFt / 2 <= footprint.yFt + footprint.depthFt / 2
          ? path.yFt + path.depthFt
          : path.yFt;

      return [
        buildVerticalAccessRoute({
          blockedRects,
          boundaryY,
          footprint,
          plotWidthFt: garden.plot.widthFt,
          source: 'path',
        }),
      ];
    });
}

function buildHorizontalAccessRoute({
  blockedRects,
  boundaryX,
  footprint,
  plotDepthFt,
  source,
}: {
  blockedRects: FootRect[];
  boundaryX: number;
  footprint: FootRect;
  plotDepthFt: number;
  source: AccessRoute['source'];
}): AccessRoute {
  const corridorDepthFt = Math.max(
    footprint.depthFt,
    minimumWorkingAisleWidthFt,
  );
  const corridorYFt = clamp(
    footprint.yFt + footprint.depthFt / 2 - corridorDepthFt / 2,
    0,
    Math.max(plotDepthFt - corridorDepthFt, 0),
  );
  const leftXFt = Math.min(boundaryX, footprint.xFt);
  const rightXFt = Math.max(boundaryX, footprint.xFt + footprint.widthFt);
  const corridor = {
    depthFt: corridorDepthFt,
    id: 'access-corridor-horizontal',
    itemType: 'structure' as const,
    label: 'Access corridor',
    widthFt: Math.max(rightXFt - leftXFt, 0.01),
    xFt: leftXFt,
    yFt: corridorYFt,
  };
  const distanceFt =
    boundaryX <= footprint.xFt
      ? Math.max(footprint.xFt - boundaryX, 0)
      : Math.max(boundaryX - (footprint.xFt + footprint.widthFt), 0);

  return {
    clear: isClearCorridor(corridor, blockedRects),
    distanceFt,
    source,
  };
}

function buildVerticalAccessRoute({
  blockedRects,
  boundaryY,
  footprint,
  plotWidthFt,
  source,
}: {
  blockedRects: FootRect[];
  boundaryY: number;
  footprint: FootRect;
  plotWidthFt: number;
  source: AccessRoute['source'];
}): AccessRoute {
  const corridorWidthFt = Math.max(
    footprint.widthFt,
    minimumWorkingAisleWidthFt,
  );
  const corridorXFt = clamp(
    footprint.xFt + footprint.widthFt / 2 - corridorWidthFt / 2,
    0,
    Math.max(plotWidthFt - corridorWidthFt, 0),
  );
  const topYFt = Math.min(boundaryY, footprint.yFt);
  const bottomYFt = Math.max(boundaryY, footprint.yFt + footprint.depthFt);
  const corridor = {
    depthFt: Math.max(bottomYFt - topYFt, 0.01),
    id: 'access-corridor-vertical',
    itemType: 'structure' as const,
    label: 'Access corridor',
    widthFt: corridorWidthFt,
    xFt: corridorXFt,
    yFt: topYFt,
  };
  const distanceFt =
    boundaryY <= footprint.yFt
      ? Math.max(footprint.yFt - boundaryY, 0)
      : Math.max(boundaryY - (footprint.yFt + footprint.depthFt), 0);

  return {
    clear: isClearCorridor(corridor, blockedRects),
    distanceFt,
    source,
  };
}

function isClearCorridor(corridor: FootRect, blockedRects: FootRect[]) {
  return !blockedRects.some((blockedRect) =>
    rectsOverlap(corridor, blockedRect),
  );
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

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(value, maximum));
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

function rangesOverlap(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
) {
  return leftStart < rightEnd && rightStart < leftEnd;
}
