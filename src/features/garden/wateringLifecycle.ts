import { getCropById } from '../../domain/crops/cropCatalog';
import {
  getInGroundDate,
  type DrainageProfile,
  type Planting,
  type SoilType,
} from '../../domain/gardens/GardenRepository';

export const ACTIVE_WATERING_STATUSES = new Set([
  'growing',
  'harvest-ready',
  'planted',
]);
export const WATER_BALANCE_MODEL_VERSION = 'water-balance-v1';
export const DIRECT_SOW_WATER_CREDIT_INCHES = 0.25;
export const PLANTED_OUT_WATER_CREDIT_INCHES = 0.4;
const ESTABLISHING_WINDOW_DAYS = 14;

export type WaterLifecycleStage = 'establishing' | 'mixed' | 'steady';
export type WaterNeedSource = 'cropProfile' | 'fallback' | 'manual';

export interface WaterLifecycleTargetContext {
  drainageProfile: DrainageProfile;
  isContainer: boolean;
  lifecycleStage: WaterLifecycleStage;
  mulched: boolean;
  plantings?: Planting[];
  soilType: SoilType;
  weeklyWaterNeedInches: number;
}

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
    return 1.1;
  }

  if (planting.status === 'harvest-ready') {
    return 1.05;
  }

  return 1;
}

export function fallbackCropWaterNeed(
  waterNeeds: 'high' | 'low' | 'medium' | null,
) {
  if (waterNeeds === 'high') {
    return 1.35;
  }

  if (waterNeeds === 'low') {
    return 0.65;
  }

  return 1;
}

export function getLifecycleHeatMultiplier(dailyHighF: number | null) {
  if (dailyHighF === null) {
    return 1;
  }

  if (dailyHighF >= 95) {
    return 1.3;
  }

  if (dailyHighF >= 88) {
    return 1.15;
  }

  return dailyHighF >= 82 ? 1.05 : 1;
}

export function getLifecycleEtMultiplier(etInches: number | null | undefined) {
  return etInches === null || etInches === undefined
    ? 1
    : Math.min(1 + etInches / 0.7, 1.35);
}

export function getLifecycleSoilMultiplier(soilType: SoilType) {
  if (soilType === 'sandy') {
    return 1.12;
  }

  if (soilType === 'clay') {
    return 0.92;
  }

  return 1;
}

export function getLifecycleDrainageMultiplier(
  drainageProfile: DrainageProfile,
) {
  if (drainageProfile === 'fast') {
    return 1.12;
  }

  if (drainageProfile === 'slow') {
    return 0.92;
  }

  return 1;
}

export function getLifecycleContextMultiplier(
  target: WaterLifecycleTargetContext,
) {
  return (
    (target.mulched ? 0.85 : 1) *
    getLifecycleSoilMultiplier(target.soilType) *
    getLifecycleDrainageMultiplier(target.drainageProfile)
  );
}

export function getLifecycleDemandMultiplier(input: {
  dailyHighF: number | null;
  evapotranspirationIn?: number | null;
}) {
  return Math.min(
    Math.max(
      getLifecycleHeatMultiplier(input.dailyHighF),
      getLifecycleEtMultiplier(input.evapotranspirationIn),
    ),
    1.35,
  );
}

export function getLifecycleDailyNeedInches(
  target: WaterLifecycleTargetContext,
  input: {
    dailyHighF: number | null;
    evapotranspirationIn?: number | null;
  },
) {
  return roundTo(
    (target.weeklyWaterNeedInches / 7) *
      getLifecycleDemandMultiplier(input) *
      getLifecycleContextMultiplier(target),
    3,
  );
}

export function getLifecycleRootZoneCapacityInches(
  target: WaterLifecycleTargetContext,
) {
  const baseCapacity = target.isContainer
    ? 0.5
    : target.lifecycleStage === 'establishing'
      ? 0.6
      : target.lifecycleStage === 'mixed'
        ? 0.85
        : 1.15;
  const soilCapacityMultiplier =
    target.soilType === 'sandy' ? 0.75 : target.soilType === 'clay' ? 1.1 : 1;
  const drainageCapacityMultiplier =
    target.drainageProfile === 'fast'
      ? 0.85
      : target.drainageProfile === 'slow'
        ? 1.05
        : 1;

  return roundTo(
    clamp(
      baseCapacity * soilCapacityMultiplier * drainageCapacityMultiplier,
      target.isContainer ? 0.3 : 0.4,
      target.isContainer ? 0.8 : 1.6,
    ),
    2,
  );
}

export function getLifecycleAllowedDepletionInches(
  target: WaterLifecycleTargetContext,
  dailyHighF: number | null,
) {
  const baseThreshold =
    target.lifecycleStage === 'establishing'
      ? 0.18
      : target.isContainer
        ? 0.22
        : target.lifecycleStage === 'mixed'
          ? 0.28
          : 0.35;
  const harvestAdjusted = target.plantings?.some(
    (planting) => planting.status === 'harvest-ready',
  )
    ? Math.min(baseThreshold, 0.3)
    : baseThreshold;

  return (dailyHighF ?? 0) >= 95
    ? roundTo(Math.max(harvestAdjusted - 0.08, 0.15), 2)
    : harvestAdjusted;
}

export function getLifecycleEffectiveRainCreditInches(
  rawRainInches: number,
  target: Pick<WaterLifecycleTargetContext, 'isContainer'>,
  capInches = Number.POSITIVE_INFINITY,
) {
  const effectiveness = target.isContainer ? 0.65 : 0.8;

  return roundTo(
    Math.min(Math.max(rawRainInches, 0) * effectiveness, capInches),
    2,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;

  return Math.round((value + Number.EPSILON) * factor) / factor;
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
