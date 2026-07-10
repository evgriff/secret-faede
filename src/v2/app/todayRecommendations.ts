import type {
  GardenPlan,
  UserProfile,
  WateringRecommendation,
} from '../domain';
import { getPlantingGroupLabel } from '../domain';
import {
  calculateWateringRecommendations,
  createCropGroupWateringTarget,
  isWateringActivePlanting,
} from '../domain/watering';
import { profileFingerprint } from '../domain/watering/modelSupport';

export function recommendationsForToday(
  plan: GardenPlan,
  profile: UserProfile,
  persisted: readonly WateringRecommendation[],
  nowIso: string,
  publishedRevisionId: string,
) {
  const activeGroups = plan.plantings.filter(isWateringActivePlanting);
  const targets = new Map(
    activeGroups.map((group) => {
      const structure =
        plan.structures.find(
          (candidate) => candidate.id === group.growingAreaStructureId,
        ) ?? null;
      return [
        group.id,
        createCropGroupWateringTarget(group, {
          areaReliability: 'geometry',
          deepLink: `/app/plan?plantingId=${encodeURIComponent(group.id)}`,
          label: getPlantingGroupLabel(plan, group),
          structure,
        }),
      ] as const;
    }),
  );
  const freshPersisted = latestFreshRecommendations(
    persisted,
    nowIso,
    publishedRevisionId,
    targets,
  );
  const fallbackGroups = activeGroups.filter(
    (group) => !freshPersisted.has(group.id),
  );
  const fallbackTargets = fallbackGroups.flatMap((group) => {
    const target = targets.get(group.id);
    return target ? [target] : [];
  });
  const fallbacks =
    fallbackTargets.length === 0
      ? []
      : calculateWateringRecommendations({
          applications: [],
          checkTimeLocal: profile.notificationPreferences.dailyCheckTime,
          forecastWeather: {
            generatedAtIso: null,
            periods: [],
            quality: 'insufficient',
            source: 'client-safety-fallback',
          },
          gardenId: plan.id,
          historicalWeather: {
            observations: [],
            quality: 'insufficient',
            source: 'client-safety-fallback',
            sourceUpdatedAtIso: null,
          },
          nowIso,
          priorBalances: [],
          targets: fallbackTargets,
          timezone: plan.plot.location.timezone,
        }).recommendations.map((recommendation) => ({
          ...recommendation,
          workspaceRevisionId: publishedRevisionId,
        }));
  return activeGroups.flatMap((group) => {
    const recommendation = freshPersisted.get(group.id);
    return recommendation
      ? [recommendation]
      : fallbacks.filter((item) => item.target.cropGroupId === group.id);
  });
}

function latestFreshRecommendations(
  recommendations: readonly WateringRecommendation[],
  nowIso: string,
  publishedRevisionId: string,
  targets: ReadonlyMap<
    string,
    ReturnType<typeof createCropGroupWateringTarget>
  >,
) {
  const maximumAgeMs = 36 * 60 * 60 * 1_000;
  const now = Date.parse(nowIso);
  const latest = new Map<string, WateringRecommendation>();
  for (const recommendation of recommendations) {
    const calculated = Date.parse(recommendation.calculatedAtIso);
    const target = targets.get(recommendation.target.cropGroupId);
    if (
      !target ||
      !Number.isFinite(calculated) ||
      calculated > now + 5 * 60 * 1_000 ||
      now - calculated > maximumAgeMs ||
      recommendation.modelVersion !== 'crop-water-balance-v2' ||
      recommendation.calculationRevision !== 1 ||
      recommendation.workspaceRevisionId !== publishedRevisionId ||
      recommendation.target.cropId !== target.planting.cropId ||
      recommendation.target.structureId !== (target.structure?.id ?? null) ||
      recommendation.balance.profileFingerprint !==
        profileFingerprint(target) ||
      recommendation.basis.area.reliability !== target.area.reliability ||
      recommendation.basis.area.squareFeet !== target.area.squareFeet
    )
      continue;
    const cropGroupId = recommendation.target.cropGroupId;
    const current = latest.get(cropGroupId);
    if (!current || current.calculatedAtIso < recommendation.calculatedAtIso) {
      latest.set(cropGroupId, recommendation);
    }
  }
  return latest;
}
