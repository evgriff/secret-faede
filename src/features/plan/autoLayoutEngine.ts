import type {
  Garden,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import { getPlantingFootprint, type FootRect } from '../garden/gardenPlanning';
import type { SunSeason } from '../garden/sunShadeEngine';
import {
  buildReservedRects,
  canSupportFootprint,
  getLayoutReferenceDate,
} from './autoLayoutConstraints';
import { scorePlacement } from './autoLayoutPlacementScoring';
import {
  getAnchoredOptimizerPlantings,
  getUnplacedReason,
} from './autoLayoutCandidateSummary';
import { compareAutoLayoutCandidates } from './autoLayoutCandidateRanking';
import { buildWholePlotPlanningContext } from './autoLayoutWholePlot';
import {
  buildLayoutZones,
  createLayoutUnits,
  createPlacementPlanting,
  enumerateCenters,
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
import { resolveAutoLayoutCandidate } from './autoLayoutRecursiveSolver';
import { buildSeasonCropLayoutRequests } from './seasonCropPlan';
import type {
  AutoLayoutCandidate,
  AutoLayoutStrategy,
} from './autoLayoutTypes';

const minimumImprovementToMoveScore = 0.04;

export function generateAutoLayoutCandidates(
  garden: Garden,
  options: {
    ignoredWarningIds?: string[];
    maxSearchDepth?: number;
    maxSearchStates?: number;
    sunLayer?: SunShadeLayer | null;
    sunSeason?: SunSeason;
  } = {},
): AutoLayoutCandidate[] {
  const requests = buildSeasonCropLayoutRequests(garden);
  const units = requests.flatMap(createLayoutUnits);

  if (units.length === 0) {
    return [];
  }

  return (['sunFirst', 'supportFirst', 'accessFirst'] as const)
    .map((strategy) =>
      buildCandidate({
        garden,
        ignoredWarningIds: options.ignoredWarningIds ?? [],
        ...(options.maxSearchDepth !== undefined
          ? { maxSearchDepth: options.maxSearchDepth }
          : {}),
        ...(options.maxSearchStates !== undefined
          ? { maxSearchStates: options.maxSearchStates }
          : {}),
        strategy,
        sunLayer: options.sunLayer ?? null,
        ...(options.sunSeason ? { sunSeason: options.sunSeason } : {}),
        units,
      }),
    )
    .sort(compareAutoLayoutCandidates);
}

export function generateAutoLayoutSuggestion(
  garden: Garden,
  options: {
    ignoredWarningIds?: string[];
    maxSearchDepth?: number;
    maxSearchStates?: number;
    sunLayer?: SunShadeLayer | null;
    sunSeason?: SunSeason;
  } = {},
) {
  return generateAutoLayoutCandidates(garden, options)[0] ?? null;
}

function buildCandidate({
  garden,
  ignoredWarningIds,
  maxSearchDepth,
  maxSearchStates,
  strategy,
  sunLayer,
  sunSeason,
  units,
}: {
  garden: Garden;
  ignoredWarningIds: string[];
  maxSearchDepth?: number;
  maxSearchStates?: number;
  strategy: AutoLayoutStrategy;
  sunLayer: SunShadeLayer | null;
  sunSeason?: SunSeason;
  units: LayoutUnit[];
}): AutoLayoutCandidate {
  const referenceDate = getLayoutReferenceDate(garden);
  const anchoredPlantings = getAnchoredOptimizerPlantings(garden);
  const wholePlotContext = buildWholePlotPlanningContext(garden, strategy);
  const planningGarden = wholePlotContext.garden;
  const zones = buildLayoutZones(planningGarden);
  const placements: Placement[] = [];
  const unplaced: AutoLayoutCandidate['unplaced'] = [];

  for (const unit of sortUnits(units, strategy)) {
    const placement = placeUnit({
      garden: planningGarden,
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
    garden: planningGarden,
    placements,
    referenceDate,
    strategy,
    sunLayer,
    zones,
  });

  return resolveAutoLayoutCandidate({
    garden: planningGarden,
    ignoredWarningIds,
    initialPlacements: improvedPlacements,
    ...(maxSearchDepth !== undefined ? { maxDepth: maxSearchDepth } : {}),
    ...(maxSearchStates !== undefined ? { maxStates: maxSearchStates } : {}),
    proposedStructures: wholePlotContext.proposedStructures,
    referenceDate,
    strategy,
    sunLayer,
    ...(sunSeason ? { sunSeason } : {}),
    unplaced,
    zones,
  });
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

        if (score > bestScore + minimumImprovementToMoveScore) {
          best = shifted;
          bestScore = score;
        }
      }

      nextPlacements[index] = best;
    }
  }

  return nextPlacements;
}
