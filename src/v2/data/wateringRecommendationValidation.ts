import {
  WATERING_CALCULATION_REVISION,
  WATERING_MODEL_VERSION,
  type WateringRecommendation,
} from '../domain';

export function currentWateringRecommendations(
  recommendations: readonly WateringRecommendation[],
  publishedRevisionId: string,
) {
  return recommendations.filter((recommendation) =>
    isCurrentWateringRecommendation(recommendation, publishedRevisionId),
  );
}

export function isCurrentWateringRecommendation(
  recommendation: WateringRecommendation,
  publishedRevisionId: string,
) {
  return (
    recommendation.modelVersion === WATERING_MODEL_VERSION &&
    recommendation.calculationRevision === WATERING_CALCULATION_REVISION &&
    recommendation.workspaceRevisionId === publishedRevisionId &&
    recommendation.target?.kind === 'cropGroup' &&
    Boolean(recommendation.target.cropGroupId) &&
    recommendation.balance?.cropGroupId === recommendation.target.cropGroupId &&
    typeof recommendation.balance.profileFingerprint === 'string' &&
    Boolean(recommendation.balance.profileFingerprint) &&
    Number.isFinite(Date.parse(recommendation.calculatedAtIso)) &&
    Number.isFinite(recommendation.forecastRainCreditInches) &&
    recommendation.forecastRainCreditInches >= 0
  );
}
