import type { Garden } from '../../domain/gardens/GardenRepository';
import {
  markWaterDone,
  skipWateringBecauseRainArrived,
  snoozeWatering,
  type TodayWateringSnoozeOption,
} from './todayActions';

export function markWateringGroupDone(
  garden: Garden,
  recommendationIds: string[],
  now = new Date(),
): Garden {
  return dedupeRecommendationIds(recommendationIds).reduce(
    (currentGarden, recommendationId) =>
      markWaterDone(currentGarden, recommendationId, now),
    garden,
  );
}

export function skipWateringGroupBecauseRainArrived(
  garden: Garden,
  recommendationIds: string[],
  now = new Date(),
): Garden {
  return dedupeRecommendationIds(recommendationIds).reduce(
    (currentGarden, recommendationId) =>
      skipWateringBecauseRainArrived(currentGarden, recommendationId, now),
    garden,
  );
}

export function snoozeWateringGroup(
  garden: Garden,
  recommendationIds: string[],
  option: TodayWateringSnoozeOption,
  now = new Date(),
): Garden {
  return dedupeRecommendationIds(recommendationIds).reduce(
    (currentGarden, recommendationId) =>
      snoozeWatering(currentGarden, recommendationId, option, now),
    garden,
  );
}

function dedupeRecommendationIds(recommendationIds: string[]) {
  return [...new Set(recommendationIds)];
}
