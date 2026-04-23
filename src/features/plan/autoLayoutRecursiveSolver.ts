import type {
  Garden,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import {
  findPlanWarnings,
  getPlantingFootprint,
  isActivePlanWarning,
  type PlanWarning,
} from '../garden/gardenPlanning';
import type { SunSeason } from '../garden/sunShadeEngine';
import {
  buildReservedRects,
  canSupportFootprint,
} from './autoLayoutConstraints';
import { applyAutoLayoutCandidateToGarden } from './autoLayoutCandidateGarden';
import {
  buildAutoLayoutCandidate,
  createPendingSearchReport,
} from './autoLayoutCandidateBuilder';
import { getAutoLayoutCandidateRankingScore } from './autoLayoutCandidateRanking';
import {
  isLegalRect,
  rectInsideRect,
  snap,
  type LayoutZone,
  type Placement,
} from './autoLayoutPlanner';
import type {
  AutoLayoutCandidate,
  AutoLayoutSearchReport,
  AutoLayoutStrategy,
} from './autoLayoutTypes';

const defaultMaxDepth = 4;
const defaultMaxStates = 160;
const maxBranchesPerState = 12;

export function resolveAutoLayoutCandidate({
  garden,
  ignoredWarningIds = [],
  initialPlacements,
  maxDepth = defaultMaxDepth,
  maxStates = defaultMaxStates,
  proposedStructures,
  referenceDate,
  strategy,
  sunLayer,
  sunSeason,
  unplaced,
  zones,
}: {
  garden: Garden;
  ignoredWarningIds?: string[];
  initialPlacements: Placement[];
  maxDepth?: number;
  maxStates?: number;
  proposedStructures: Garden['structures'];
  referenceDate: Date;
  strategy: AutoLayoutStrategy;
  sunLayer: SunShadeLayer | null;
  sunSeason?: SunSeason;
  unplaced: AutoLayoutCandidate['unplaced'];
  zones: LayoutZone[];
}): AutoLayoutCandidate {
  const ignoredWarnings = new Set(ignoredWarningIds);
  const visited = new Set<string>();
  const stats = {
    evaluatedStates: 0,
    maxReachedDepth: 0,
    prunedStates: 0,
    repeatedStates: 0,
  };
  let best: SearchEvaluation | null = null;

  explore({
    depth: 0,
    initialPlacements,
    placements: initialPlacements,
  });

  const bestEvaluation =
    best ??
    evaluatePlacements({
      initialPlacements,
      placements: initialPlacements,
    });
  const search = buildSearchReport({
    evaluation: bestEvaluation,
    hardConstraintCount:
      bestEvaluation.candidate.hardConstraintViolations.length,
    maxDepth,
    maxStates,
    stats,
    unplaced,
  });

  return buildAutoLayoutCandidate({
    garden,
    placements: bestEvaluation.placements,
    proposedStructures,
    referenceDate,
    search,
    strategy,
    unplaced,
  });

  function explore({
    depth,
    initialPlacements,
    placements,
  }: {
    depth: number;
    initialPlacements: Placement[];
    placements: Placement[];
  }) {
    const stateHash = hashPlacements(placements);

    if (visited.has(stateHash)) {
      stats.repeatedStates += 1;
      return;
    }

    if (stats.evaluatedStates >= maxStates) {
      stats.prunedStates += 1;
      return;
    }

    visited.add(stateHash);
    stats.evaluatedStates += 1;
    stats.maxReachedDepth = Math.max(stats.maxReachedDepth, depth);

    const evaluation = evaluatePlacements({
      initialPlacements,
      placements,
    });

    if (!best || compareEvaluations(evaluation, best) < 0) {
      best = evaluation;
    }

    if (
      evaluation.candidate.hardConstraintViolations.length === 0 &&
      evaluation.activeWarnings.length === 0 &&
      unplaced.length === 0
    ) {
      return;
    }

    if (depth >= maxDepth) {
      stats.prunedStates += 1;
      return;
    }

    for (const nextPlacements of buildSuccessors(placements).slice(
      0,
      maxBranchesPerState,
    )) {
      explore({
        depth: depth + 1,
        initialPlacements,
        placements: nextPlacements,
      });
    }
  }

  function evaluatePlacements({
    initialPlacements,
    placements,
  }: {
    initialPlacements: Placement[];
    placements: Placement[];
  }): SearchEvaluation {
    const candidate = buildAutoLayoutCandidate({
      garden,
      placements,
      proposedStructures,
      referenceDate,
      search: createPendingSearchReport(),
      strategy,
      unplaced,
    });
    const candidateGarden = applyAutoLayoutCandidateToGarden(garden, candidate);
    const warnings = findPlanWarnings(candidateGarden, {
      ...(sunLayer ? { sunLayer } : {}),
      now: referenceDate,
      ...(sunSeason ? { sunSeason } : {}),
    });
    const activeWarnings = warnings.filter(
      (warning) =>
        isActivePlanWarning(warning) && !ignoredWarnings.has(warning.id),
    );

    return {
      activeWarnings,
      candidate,
      moveDistanceFt: getMoveDistance(initialPlacements, placements),
      placements,
      stateHash: hashPlacements(placements),
    };
  }

  function buildSuccessors(placements: Placement[]) {
    const successors: Placement[][] = [];
    const step = garden.plot.snapUnitFt * 2;
    const deltas = [
      { id: 'north', xFt: 0, yFt: -step },
      { id: 'west', xFt: -step, yFt: 0 },
      { id: 'east', xFt: step, yFt: 0 },
      { id: 'south', xFt: 0, yFt: step },
    ];

    placements.forEach((placement, index) => {
      for (const delta of deltas) {
        const shifted = shiftPlacement(placement, delta, placements);

        if (!shifted) {
          continue;
        }

        successors.push(
          placements.map((current, currentIndex) =>
            currentIndex === index ? shifted : current,
          ),
        );
      }
    });

    return successors.sort((left, right) =>
      hashPlacements(left).localeCompare(hashPlacements(right)),
    );
  }

  function shiftPlacement(
    placement: Placement,
    delta: { id: string; xFt: number; yFt: number },
    placements: Placement[],
  ): Placement | null {
    const shifted = {
      ...placement,
      planting: {
        ...placement.planting,
        xFt: snap(placement.planting.xFt + delta.xFt, garden.plot.snapUnitFt),
        yFt: snap(placement.planting.yFt + delta.yFt, garden.plot.snapUnitFt),
      },
    };
    const footprint = getPlantingFootprint(shifted.planting);
    const zone = zones.find((candidate) =>
      rectInsideRect(footprint, candidate.rect),
    );
    const otherRects = placements
      .filter((candidate) => candidate.unit.id !== placement.unit.id)
      .map((candidate) => getPlantingFootprint(candidate.planting));
    const reservedRects = buildReservedRects(
      garden,
      shifted.planting,
      referenceDate,
    );

    if (
      !zone ||
      !isLegalRect(
        garden,
        footprint,
        [...reservedRects, ...otherRects],
        zone,
      ) ||
      !canSupportFootprint(garden, shifted.unit.crop, footprint, otherRects)
    ) {
      return null;
    }

    return shifted;
  }
}

interface SearchEvaluation {
  activeWarnings: PlanWarning[];
  candidate: AutoLayoutCandidate;
  moveDistanceFt: number;
  placements: Placement[];
  stateHash: string;
}

function buildSearchReport({
  evaluation,
  hardConstraintCount,
  maxDepth,
  maxStates,
  stats,
  unplaced,
}: {
  evaluation: SearchEvaluation;
  hardConstraintCount: number;
  maxDepth: number;
  maxStates: number;
  stats: {
    evaluatedStates: number;
    maxReachedDepth: number;
    prunedStates: number;
    repeatedStates: number;
  };
  unplaced: AutoLayoutCandidate['unplaced'];
}): AutoLayoutSearchReport {
  const unresolvedIssues = [
    ...evaluation.candidate.hardConstraintViolations,
    ...evaluation.activeWarnings.map((warning) => warning.title),
    ...unplaced.map((item) => `${item.cropName}: ${item.reason}`),
  ];
  const status =
    hardConstraintCount > 0
      ? 'blocked'
      : unresolvedIssues.length > 0
        ? 'partial'
        : 'resolved';

  return {
    activeWarningCount: evaluation.activeWarnings.length,
    evaluatedStates: stats.evaluatedStates,
    maxDepth,
    maxStates,
    prunedStates: stats.prunedStates,
    rankingScore: getAutoLayoutCandidateRankingScore(evaluation.candidate, {
      activeWarningCount: evaluation.activeWarnings.length,
      moveDistanceFt: evaluation.moveDistanceFt,
      unresolvedIssueCount: unresolvedIssues.length,
    }),
    reachedDepth: stats.maxReachedDepth,
    repeatedStates: stats.repeatedStates,
    status,
    unresolvedIssues: [...new Set(unresolvedIssues)].slice(0, 5),
  };
}

function compareEvaluations(left: SearchEvaluation, right: SearchEvaluation) {
  return (
    left.candidate.hardConstraintViolations.length -
      right.candidate.hardConstraintViolations.length ||
    warningWeight(left.activeWarnings) - warningWeight(right.activeWarnings) ||
    left.candidate.unplaced.length - right.candidate.unplaced.length ||
    getAverageScore(right.candidate) - getAverageScore(left.candidate) ||
    left.moveDistanceFt - right.moveDistanceFt ||
    left.stateHash.localeCompare(right.stateHash)
  );
}

function warningWeight(warnings: PlanWarning[]) {
  return warnings.reduce(
    (total, warning) => total + (warning.severity === 'critical' ? 4 : 1),
    0,
  );
}

function getAverageScore(candidate: AutoLayoutCandidate) {
  const breakdown = candidate.scoreBreakdown;

  return (
    breakdown.seasonalSuitability +
    breakdown.shadeManagement +
    breakdown.spacingQuality +
    breakdown.waterGrouping
  );
}

function getMoveDistance(
  initialPlacements: Placement[],
  nextPlacements: Placement[],
) {
  const initialByUnitId = new Map(
    initialPlacements.map((placement) => [placement.unit.id, placement]),
  );

  return nextPlacements.reduce((total, placement) => {
    const initial = initialByUnitId.get(placement.unit.id);

    if (!initial) {
      return total;
    }

    return (
      total +
      Math.abs(initial.planting.xFt - placement.planting.xFt) +
      Math.abs(initial.planting.yFt - placement.planting.yFt)
    );
  }, 0);
}

function hashPlacements(placements: Placement[]) {
  return [...placements]
    .sort((left, right) => left.unit.id.localeCompare(right.unit.id))
    .map(
      (placement) =>
        `${placement.unit.id}:${placement.planting.xFt.toFixed(3)}:${placement.planting.yFt.toFixed(3)}`,
    )
    .join('|');
}
