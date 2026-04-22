import type {
  Garden,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import { getSunAreaAtPoint } from '../garden/sunShadeEngine';
import {
  scoreAccess,
  scoreNorthTallPlacement,
  scoreSeasonalSuitability,
  scoreSpacingQuality,
  scoreSunAreaFit,
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
  const sunFit = scoreSunAreaFit(
    placement.unit.crop,
    sunLayer ? getSunAreaAtPoint(sunLayer, placement.planting) : null,
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
  const priority =
    placement.unit.request.mustGrow ||
    placement.unit.request.priority === 'high'
      ? 1
      : placement.unit.request.priority === 'medium'
        ? 0.82
        : 0.68;
  const weights = getPlacementWeights(strategy);

  return (
    sunFit * weights.sun +
    access * weights.access +
    support * weights.support +
    tallNorth * weights.tall +
    seasonal * weights.seasonal +
    shadeDiscipline * weights.shade +
    spacing * weights.spacing +
    priority * weights.priority +
    getStrategyBias(garden, placement, strategy) * 0.04
  );
}

export function toScoredPlacement(placement: Placement): ScoredPlacement {
  return {
    crop: placement.unit.crop,
    fitLevel: placement.unit.request.fit.level,
    planting: placement.planting,
    required: placement.unit.request.mustGrow,
  };
}

function getPlacementWeights(strategy: AutoLayoutStrategy) {
  if (strategy === 'accessFirst') {
    return {
      access: 0.28,
      priority: 0.13,
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
      priority: 0.1,
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
    priority: 0.1,
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
