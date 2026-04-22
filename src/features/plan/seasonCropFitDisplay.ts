import type {
  SeasonCropFitLevel,
  SeasonCropFitReasonGroup,
  SeasonCropFitSignal,
} from './seasonCropPlan';

export function formatSeasonCropPlanningState(level: SeasonCropFitLevel) {
  const labels: Record<SeasonCropFitLevel, string> = {
    caution: 'Review',
    greatFit: 'Ready',
    unlikelyFit: 'Hold',
    workable: 'Check',
  };

  return labels[level];
}

export function needsSeasonCropReview(fit: SeasonCropFitSignal) {
  return fit.level !== 'greatFit';
}

export function formatSeasonCropFitReasonGroup(
  group: SeasonCropFitReasonGroup,
) {
  const labels: Record<SeasonCropFitReasonGroup, string> = {
    bedContainer: 'Bed/container',
    climateSeason: 'Climate/season',
    space: 'Space',
    sun: 'Sun',
    support: 'Support',
  };

  return labels[group];
}

export function getSeasonCropPlanningRank(fit: SeasonCropFitSignal) {
  const levelRanks: Record<SeasonCropFitLevel, number> = {
    caution: 45,
    greatFit: 100,
    unlikelyFit: 10,
    workable: 72,
  };
  const penalty = fit.groupedReasons.reduce((total, reason) => {
    if (reason.severity === 'blocker') {
      return total + 18;
    }

    return total + (reason.severity === 'watch' ? 8 : 3);
  }, 0);

  return Math.max(0, levelRanks[fit.level] - penalty);
}
