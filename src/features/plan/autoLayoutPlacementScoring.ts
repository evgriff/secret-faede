import type {
  Garden,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import {
  scoreAccess,
  scoreCompatibleGrouping,
  scoreNorthTallPlacement,
  scoreSeasonalSuitability,
  scoreSpacingQuality,
  scoreSunFootprintFit,
  scoreSupportPlacement,
  type ScoredPlacement,
} from './autoLayoutScoring';
import { scorePlacementShadeDiscipline } from './autoLayoutShadeScoring';
import type { Placement } from './autoLayoutPlanner';
import type { AutoLayoutStrategy } from './autoLayoutTypes';

export function scorePlacement(
  garden: Garden,
  placement: Placement,
  strategy: AutoLayoutStrategy,
  sunLayer: SunShadeLayer | null,
  placedPlacements: Placement[] = [],
) {
  const scoredPlacement = toScoredPlacement(placement);
  const scoredPlacedPlacements = placedPlacements.map(toScoredPlacement);
  const sunFit = scoreSunFootprintFit(
    placement.unit.crop,
    sunLayer,
    placement.planting,
  );
  const access = scoreAccess(garden, placement.planting);
  const support = scoreSupportPlacement(garden, scoredPlacement);
  const tallNorth = scoreNorthTallPlacement(garden, scoredPlacement);
  const seasonal = scoreSeasonalSuitability(placement.unit.request.fit.level);
  const shadeDiscipline = scorePlacementShadeDiscipline(
    garden,
    scoredPlacement,
    scoredPlacedPlacements,
  );
  const spacing = scoreSpacingQuality([
    scoredPlacement,
    ...scoredPlacedPlacements,
  ]);
  const compatibleGrouping = scoreCompatibleGrouping(
    scoredPlacement,
    scoredPlacedPlacements,
  );
  const weights = getPlacementWeights(strategy);

  return (
    sunFit * weights.sun +
    access * weights.access +
    support * weights.support +
    tallNorth * weights.tall +
    seasonal * weights.seasonal +
    shadeDiscipline * weights.shade +
    spacing * weights.spacing +
    compatibleGrouping * weights.grouping +
    getStrategyBias(garden, placement, strategy) * 0.04
  );
}

export function toScoredPlacement(placement: Placement): ScoredPlacement {
  return {
    crop: placement.unit.crop,
    fitLevel: placement.unit.request.fit.level,
    planting: placement.planting,
  };
}

function getPlacementWeights(strategy: AutoLayoutStrategy) {
  if (strategy === 'accessFirst') {
    return {
      access: 0.28,
      grouping: 0.08,
      seasonal: 0.08,
      shade: 0.13,
      spacing: 0.08,
      sun: 0.2,
      support: 0.1,
      tall: 0,
    };
  }

  if (strategy === 'supportFirst') {
    return {
      access: 0.1,
      grouping: 0.1,
      seasonal: 0.08,
      shade: 0.18,
      spacing: 0.08,
      sun: 0.18,
      support: 0.2,
      tall: 0.08,
    };
  }

  return {
    access: 0.1,
    grouping: 0.08,
    seasonal: 0.1,
    shade: 0.14,
    spacing: 0.08,
    sun: 0.32,
    support: 0.08,
    tall: 0.08,
  };
}

function getStrategyBias(
  garden: Garden,
  placement: Placement,
  strategy: AutoLayoutStrategy,
) {
  const xRatio = placement.planting.xFt / garden.plot.widthFt;
  const yRatio = placement.planting.yFt / garden.plot.depthFt;

  if (strategy === 'supportFirst') {
    return 1 - yRatio;
  }

  if (strategy === 'accessFirst') {
    return Math.max(xRatio, 1 - xRatio, yRatio, 1 - yRatio);
  }

  return xRatio;
}
