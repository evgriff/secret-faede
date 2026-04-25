import type {
  Garden,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import {
  scoreAccess,
  scoreCompatibleGrouping,
  scoreSpacingQuality,
  scoreSupportPlacement,
  type ScoredPlacement,
} from './autoLayoutScoring';
import type { Placement } from './autoLayoutPlanner';
import type { AutoLayoutStrategy } from './autoLayoutTypes';

export function scorePlacement(
  garden: Garden,
  placement: Placement,
  strategy: AutoLayoutStrategy,
  _sunLayer: SunShadeLayer | null,
  placedPlacements: Placement[] = [],
) {
  const scoredPlacement = toScoredPlacement(placement);
  const scoredPlacedPlacements = placedPlacements.map(toScoredPlacement);
  const access = scoreAccess(
    garden,
    placement.planting,
    placedPlacements.map((candidate) => candidate.planting),
  );
  const support = scoreSupportPlacement(garden, scoredPlacement);
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
    access * weights.access +
    support * weights.support +
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
      access: 0.42,
      grouping: 0.14,
      spacing: 0.22,
      support: 0.18,
    };
  }

  if (strategy === 'supportFirst') {
    return {
      access: 0.18,
      grouping: 0.14,
      spacing: 0.22,
      support: 0.42,
    };
  }

  return {
    access: 0.2,
    grouping: 0.32,
    spacing: 0.24,
    support: 0.2,
  };
}

function getStrategyBias(
  garden: Garden,
  placement: Placement,
  strategy: AutoLayoutStrategy,
) {
  const xRatio = placement.planting.xFt / garden.plot.widthFt;
  const yRatio = placement.planting.yFt / garden.plot.depthFt;

  if (strategy === 'accessFirst') {
    return Math.max(xRatio, 1 - xRatio, yRatio, 1 - yRatio);
  }

  if (strategy === 'supportFirst') {
    return 0.5;
  }

  return Math.max(0, 1 - (Math.abs(xRatio - 0.5) + Math.abs(yRatio - 0.5)));
}
