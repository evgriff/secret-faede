import type { Garden } from '../../domain/gardens/GardenRepository';
import {
  applySupportPlansAndBuildStructures,
  findHardConstraintViolations,
} from './autoLayoutProposalOutput';
import {
  buildExplanations,
  buildMaterials,
  buildTradeoffs,
  getAnchoredOptimizerPlantings,
} from './autoLayoutCandidateSummary';
import { buildScoreBreakdown } from './autoLayoutScoring';
import { toScoredPlacement } from './autoLayoutPlacementScoring';
import { getStrategyLabel, type Placement } from './autoLayoutPlanner';
import { buildWholePlotPlan } from './autoLayoutWholePlot';
import type {
  AutoLayoutCandidate,
  AutoLayoutSearchReport,
  AutoLayoutStrategy,
} from './autoLayoutTypes';

export function buildAutoLayoutCandidate({
  garden,
  placements,
  proposedStructures,
  referenceDate,
  search,
  strategy,
  unplaced,
}: {
  garden: Garden;
  placements: Placement[];
  proposedStructures: Garden['structures'];
  referenceDate: Date;
  search: AutoLayoutSearchReport;
  strategy: AutoLayoutStrategy;
  unplaced: AutoLayoutCandidate['unplaced'];
}): AutoLayoutCandidate {
  const supportedProposal = applySupportPlansAndBuildStructures(
    garden,
    placements,
    strategy,
    referenceDate,
  );
  const proposalPlacements = supportedProposal.placements;
  const structures = supportedProposal.structures;
  const candidateStructures = [...proposedStructures, ...structures];
  const scoredPlacements = proposalPlacements.map(toScoredPlacement);
  const scoreBreakdown = buildScoreBreakdown({
    garden,
    placements: scoredPlacements,
  });
  const hardConstraintViolations = findHardConstraintViolations(
    garden,
    proposalPlacements,
    candidateStructures,
    referenceDate,
  );
  const wholePlot = buildWholePlotPlan({
    placements: proposalPlacements,
    proposedStructures,
  });

  return {
    explanations: buildSearchExplanations(search, [
      ...buildExplanations(strategy, scoredPlacements, candidateStructures),
      ...wholePlot.heuristics.slice(0, 2),
    ]),
    hardConstraintViolations,
    id: `auto-${strategy}`,
    label: getStrategyLabel(strategy),
    materials: buildMaterials(scoredPlacements, candidateStructures),
    plantings: proposalPlacements.map((placement) => placement.planting),
    scoreBreakdown,
    search,
    strategy,
    structures: candidateStructures,
    tradeoffs: [
      ...buildTradeoffs(
        strategy,
        unplaced,
        scoreBreakdown,
        getAnchoredOptimizerPlantings(garden),
      ),
      ...buildSearchTradeoffs(search),
    ],
    unplaced,
    wholePlot,
  };
}

export function createPendingSearchReport(): AutoLayoutSearchReport {
  return {
    activeWarningCount: 0,
    evaluatedStates: 0,
    maxDepth: 0,
    maxStates: 0,
    prunedStates: 0,
    rankingScore: 0,
    reachedDepth: 0,
    repeatedStates: 0,
    status: 'resolved',
    unresolvedIssues: [],
  };
}

function buildSearchExplanations(
  search: AutoLayoutSearchReport,
  explanations: string[],
) {
  if (search.evaluatedStates === 0) {
    return explanations;
  }

  return [
    ...explanations,
    `Recursive solver checked ${search.evaluatedStates} state${search.evaluatedStates === 1 ? '' : 's'} to depth ${search.reachedDepth}/${search.maxDepth}.`,
  ];
}

function buildSearchTradeoffs(search: AutoLayoutSearchReport) {
  if (search.evaluatedStates === 0) {
    return [];
  }

  return [
    search.repeatedStates > 0
      ? `${search.repeatedStates} repeated state${search.repeatedStates === 1 ? '' : 's'} pruned by layout hashing.`
      : 'No repeated layout states reached the candidate list.',
    search.prunedStates > 0
      ? `${search.prunedStates} branch${search.prunedStates === 1 ? '' : 'es'} stopped at the search cap.`
      : 'Search finished within the configured caps.',
    search.status === 'resolved'
      ? 'No active downstream problem remains for this proposal.'
      : `Still unresolved: ${search.unresolvedIssues.slice(0, 3).join('; ')}.`,
  ];
}
