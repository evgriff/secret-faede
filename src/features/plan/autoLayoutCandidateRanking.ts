import type { AutoLayoutCandidate } from './autoLayoutTypes';

const strategyRank: Record<AutoLayoutCandidate['strategy'], number> = {
  sunFirst: 0,
  supportFirst: 1,
  accessFirst: 2,
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
  const averageScore =
    (candidate.scoreBreakdown.seasonalSuitability +
      candidate.scoreBreakdown.shadeManagement +
      candidate.scoreBreakdown.spacingQuality +
      candidate.scoreBreakdown.waterGrouping) /
    4;

  return Number(
    (
      hardConstraintCount * 1000 +
      activeWarningCount * 100 +
      candidate.unplaced.length * 35 +
      unresolvedIssueCount * 10 +
      moveDistanceFt * 0.1 -
      averageScore
    ).toFixed(3),
  );
}
