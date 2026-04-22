import type {
  Garden,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import { getPlantingFootprint, type FootRect } from '../garden/gardenPlanning';
import {
  buildReservedRects,
  canSupportFootprint,
  getLayoutReferenceDate,
} from './autoLayoutConstraints';
import { buildScoreBreakdown } from './autoLayoutScoring';
import {
  scorePlacement,
  toScoredPlacement,
} from './autoLayoutPlacementScoring';
import {
  buildExplanations,
  buildMaterials,
  buildTradeoffs,
  getAnchoredOptimizerPlantings,
  getUnplacedReason,
} from './autoLayoutCandidateSummary';
import {
  buildLayoutZones,
  createLayoutUnits,
  createPlacementPlanting,
  enumerateCenters,
  getStrategyLabel,
  isLegalRect,
  rectInsideRect,
  snap,
  sortUnits,
  zoneCanHost,
  type LayoutUnit,
  type LayoutZone,
  type Placement,
} from './autoLayoutPlanner';
export { autoLayoutProposalMarker } from './autoLayoutPlanner';
import {
  buildSupportStructures,
  findHardConstraintViolations,
} from './autoLayoutProposalOutput';
import { buildSeasonCropLayoutRequests } from './seasonCropPlan';
import type {
  AutoLayoutCandidate,
  AutoLayoutStrategy,
} from './autoLayoutTypes';

export function generateAutoLayoutCandidates(
  garden: Garden,
  options: { sunLayer?: SunShadeLayer | null } = {},
): AutoLayoutCandidate[] {
  const requests = buildSeasonCropLayoutRequests(garden);
  const units = requests.flatMap(createLayoutUnits);

  if (units.length === 0) {
    return [];
  }

  return (['sunFirst', 'supportFirst', 'accessFirst'] as const).map(
    (strategy) =>
      buildCandidate(garden, units, strategy, options.sunLayer ?? null),
  );
}

function buildCandidate(
  garden: Garden,
  units: LayoutUnit[],
  strategy: AutoLayoutStrategy,
  sunLayer: SunShadeLayer | null,
): AutoLayoutCandidate {
  const referenceDate = getLayoutReferenceDate(garden);
  const anchoredPlantings = getAnchoredOptimizerPlantings(garden);
  const zones = buildLayoutZones(garden);
  const placements: Placement[] = [];
  const unplaced: AutoLayoutCandidate['unplaced'] = [];

  for (const unit of sortUnits(units, strategy)) {
    const placement = placeUnit({
      garden,
      placedRects: placements.map((entry) =>
        getPlantingFootprint(entry.planting),
      ),
      placedPlacements: placements,
      referenceDate,
      strategy,
      sunLayer,
      unit,
      zones: zones.filter((zone) => zoneCanHost(zone, unit)),
    });

    if (placement) {
      placements.push(placement);
    } else {
      unplaced.push({
        cropName: unit.crop.commonName,
        reason: getUnplacedReason(unit, anchoredPlantings),
      });
    }
  }

  const improvedPlacements = improvePlacements({
    garden,
    placements,
    referenceDate,
    strategy,
    sunLayer,
    zones,
  });
  const scoredPlacements = improvedPlacements.map(toScoredPlacement);
  const structures = buildSupportStructures(
    garden,
    improvedPlacements,
    strategy,
    referenceDate,
  );
  const hardConstraintViolations = findHardConstraintViolations(
    garden,
    improvedPlacements,
    structures,
    referenceDate,
  );
  const scoreBreakdown = buildScoreBreakdown({
    garden,
    placements: scoredPlacements,
  });

  return {
    explanations: buildExplanations(strategy, scoredPlacements, structures),
    hardConstraintViolations,
    id: `auto-${strategy}`,
    label: getStrategyLabel(strategy),
    materials: buildMaterials(scoredPlacements, structures),
    plantings: improvedPlacements.map((placement) => placement.planting),
    scoreBreakdown,
    strategy,
    structures,
    tradeoffs: buildTradeoffs(
      strategy,
      unplaced,
      scoreBreakdown,
      anchoredPlantings,
    ),
    unplaced,
  };
}

function placeUnit({
  garden,
  placedRects,
  placedPlacements,
  referenceDate,
  strategy,
  sunLayer,
  unit,
  zones,
}: {
  garden: Garden;
  placedRects: FootRect[];
  placedPlacements: Placement[];
  referenceDate: Date;
  strategy: AutoLayoutStrategy;
  sunLayer: SunShadeLayer | null;
  unit: LayoutUnit;
  zones: LayoutZone[];
}) {
  let bestPlacement: Placement | null = null;
  let bestScore = -Infinity;

  if (unit.crop.trellisRequired && !unit.request.supportAllowed) {
    return null;
  }

  for (const zone of zones) {
    for (const center of enumerateCenters(garden, zone.rect, unit.size)) {
      const planting = createPlacementPlanting(unit, center, strategy);
      const footprint = getPlantingFootprint(planting);
      const reservedRects = buildReservedRects(garden, planting, referenceDate);

      if (
        !isLegalRect(
          garden,
          footprint,
          [...reservedRects, ...placedRects],
          zone,
        ) ||
        !canSupportFootprint(garden, unit.crop, footprint)
      ) {
        continue;
      }

      const placement = { planting, unit };
      const score = scorePlacement(
        garden,
        placement,
        strategy,
        sunLayer,
        placedPlacements,
      );

      if (score > bestScore) {
        bestPlacement = placement;
        bestScore = score;
      }
    }
  }

  return bestPlacement;
}

function improvePlacements({
  garden,
  placements,
  referenceDate,
  strategy,
  sunLayer,
  zones,
}: {
  garden: Garden;
  placements: Placement[];
  referenceDate: Date;
  strategy: AutoLayoutStrategy;
  sunLayer: SunShadeLayer | null;
  zones: LayoutZone[];
}) {
  const nextPlacements = [...placements];
  const step = garden.plot.snapUnitFt * 2;
  const deltas = [
    { xFt: -step, yFt: 0 },
    { xFt: step, yFt: 0 },
    { xFt: 0, yFt: -step },
    { xFt: 0, yFt: step },
  ];

  for (let pass = 0; pass < 2; pass += 1) {
    for (let index = 0; index < nextPlacements.length; index += 1) {
      const current = nextPlacements[index];

      if (!current) {
        continue;
      }

      const otherRects = nextPlacements
        .filter((_, candidateIndex) => candidateIndex !== index)
        .map((placement) => getPlantingFootprint(placement.planting));
      let best = current;
      const otherPlacements = nextPlacements.filter(
        (_, candidateIndex) => candidateIndex !== index,
      );
      let bestScore = scorePlacement(
        garden,
        current,
        strategy,
        sunLayer,
        otherPlacements,
      );

      for (const delta of deltas) {
        const shifted = {
          ...current,
          planting: {
            ...current.planting,
            xFt: snap(current.planting.xFt + delta.xFt, garden.plot.snapUnitFt),
            yFt: snap(current.planting.yFt + delta.yFt, garden.plot.snapUnitFt),
          },
        };
        const zone = zones.find((candidate) =>
          rectInsideRect(
            getPlantingFootprint(shifted.planting),
            candidate.rect,
          ),
        );
        const reservedRects = buildReservedRects(
          garden,
          shifted.planting,
          referenceDate,
        );

        if (
          !zone ||
          !isLegalRect(
            garden,
            getPlantingFootprint(shifted.planting),
            [...reservedRects, ...otherRects],
            zone,
          ) ||
          !canSupportFootprint(
            garden,
            shifted.unit.crop,
            getPlantingFootprint(shifted.planting),
          )
        ) {
          continue;
        }

        const score = scorePlacement(
          garden,
          shifted,
          strategy,
          sunLayer,
          otherPlacements,
        );

        if (score > bestScore + 0.01) {
          best = shifted;
          bestScore = score;
        }
      }

      nextPlacements[index] = best;
    }
  }

  return nextPlacements;
}
