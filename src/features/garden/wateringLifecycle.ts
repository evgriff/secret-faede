import { getCropById } from '../../domain/crops/cropCatalog';
import {
  getInGroundDate,
  type Planting,
} from '../../domain/gardens/GardenRepository';

export const ACTIVE_WATERING_STATUSES = new Set([
  'growing',
  'harvest-ready',
  'planted',
]);
const ESTABLISHING_WINDOW_DAYS = 14;

export type WaterLifecycleStage = 'establishing' | 'mixed' | 'steady';
export type WaterNeedSource = 'cropProfile' | 'fallback' | 'manual';

export interface PlantingWaterProfile {
  lifecycleStage: Exclude<WaterLifecycleStage, 'mixed'>;
  waterNeedSource: WaterNeedSource;
  weeklyWaterNeedInches: number;
}

export function getPlantingWaterProfile(
  planting: Planting,
  now: Date,
  fallbackWaterNeed: (waterNeeds: 'high' | 'low' | 'medium' | null) => number,
): PlantingWaterProfile {
  const crop = getCropById(planting.cropId);
  const waterNeedSource: WaterNeedSource = planting.weeklyWaterNeedInches
    ? 'manual'
    : crop?.weeklyWaterNeedInches
      ? 'cropProfile'
      : 'fallback';
  const weeklyWaterNeedInches =
    (planting.weeklyWaterNeedInches ??
      crop?.weeklyWaterNeedInches ??
      fallbackWaterNeed(crop?.waterNeeds ?? null)) *
    getLifecycleWaterMultiplier(planting, now);

  return {
    lifecycleStage: isEstablishingPlanting(planting, now)
      ? 'establishing'
      : 'steady',
    waterNeedSource,
    weeklyWaterNeedInches,
  };
}

export function getTargetLifecycleStage(
  plantings: Planting[],
  now: Date,
): WaterLifecycleStage {
  const establishingCount = plantings.filter((planting) =>
    isEstablishingPlanting(planting, now),
  ).length;

  if (establishingCount === 0) {
    return 'steady';
  }

  if (establishingCount === plantings.length) {
    return 'establishing';
  }

  return 'mixed';
}

function getLifecycleWaterMultiplier(planting: Planting, now: Date) {
  if (isEstablishingPlanting(planting, now)) {
    return 1.15;
  }

  if (planting.status === 'harvest-ready') {
    return 1.05;
  }

  return 1;
}

function isEstablishingPlanting(planting: Planting, now: Date) {
  if (planting.status === 'planted') {
    return true;
  }

  if (!ACTIVE_WATERING_STATUSES.has(planting.status)) {
    return false;
  }

  const inGroundDate = getInGroundDate(planting);

  if (!inGroundDate) {
    return false;
  }

  return daysSinceLocalDate(inGroundDate, now) <= ESTABLISHING_WINDOW_DAYS;
}

function daysSinceLocalDate(localDate: string, now: Date) {
  const parsedDate = new Date(`${localDate}T12:00:00.000Z`);

  if (Number.isNaN(parsedDate.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.floor(
    (now.getTime() - parsedDate.getTime()) / (24 * 60 * 60 * 1000),
  );
}
