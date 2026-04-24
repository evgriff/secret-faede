import { isPathStructure } from '../garden/gardenStructureRules';
import type { AutoLayoutCandidate } from './autoLayoutTypes';

const strategyRank: Record<AutoLayoutCandidate['strategy'], number> = {
  accessFirst: 0,
  supportFirst: 1,
  sunFirst: 2,
};

export function compareAutoLayoutCandidates(
  left: AutoLayoutCandidate,
  right: AutoLayoutCandidate,
) {
  return (
    left.search.rankingScore - right.search.rankingScore ||
    strategyRank[left.strategy] - strategyRank[right.strategy] ||
    left.id.localeCompare(right.id)
  );
}

export function getAutoLayoutCandidateRankingScore(
  candidate: AutoLayoutCandidate,
  overrides: {
    activeWarningCount?: number;
    moveDistanceFt?: number;
    unresolvedIssueCount?: number;
  } = {},
) {
  const hardConstraintCount = candidate.hardConstraintViolations.length;
  const activeWarningCount =
    overrides.activeWarningCount ?? candidate.search.activeWarningCount;
  const unresolvedIssueCount =
    overrides.unresolvedIssueCount ?? candidate.search.unresolvedIssues.length;
  const moveDistanceFt = overrides.moveDistanceFt ?? 0;
  const qualityScore = getAutoLayoutCandidateQualityScore(candidate);
  const complexityPenalty = getAutoLayoutCandidateComplexityPenalty(candidate);

  return Number(
    (
      hardConstraintCount * 1000 +
      activeWarningCount * 120 +
      candidate.unplaced.length * 40 +
      unresolvedIssueCount * 12 +
      moveDistanceFt * 1.5 +
      complexityPenalty -
      qualityScore
    ).toFixed(3),
  );
}

export function getAutoLayoutCandidateQualityScore(
  candidate: AutoLayoutCandidate,
) {
  return Number(
    (
      candidate.scoreBreakdown.accessQuality * 55 +
      candidate.scoreBreakdown.spacingQuality * 20 +
      candidate.scoreBreakdown.structureCompatibility * 15 +
      candidate.scoreBreakdown.waterGrouping * 10
    ).toFixed(3),
  );
}

export function getAutoLayoutCandidateComplexityPenalty(
  candidate: AutoLayoutCandidate,
) {
  const pathCount = candidate.structures.filter(isPathStructure).length;
  const trellisCount = candidate.structures.filter(
    (structure) => structure.type === 'trellis',
  ).length;
  const plantSupportCount = candidate.plantings.filter(
    (planting) =>
      planting.support.type !== 'none' && planting.support.quantity > 0,
  ).length;

  return (
    pathCount * 3 +
    Math.max(0, pathCount - 1) * 10 +
    trellisCount * 8 +
    plantSupportCount * 3
  );
}
