import { assertIsoInstant } from '../time/gardenTime';
import type {
  CropGroupWateringTarget,
  WaterDataQuality,
  WateringReasonCode,
  WateringReasonDetail,
} from './types';

export const GALLONS_PER_INCH_SQUARE_FOOT = 0.623;
export const FORECAST_SUPPRESSION_WINDOW_MS = 48 * 60 * 60 * 1_000;
export const FORECAST_RAIN_CREDIT_WINDOW_MS = 24 * 60 * 60 * 1_000;
export const EPSILON = 0.000_001;

export const availableWaterPerSoilInch = {
  clay: 0.16,
  loam: 0.13,
  sandy: 0.07,
  unknown: 0.1,
} as const;

export const drainageDemandFactor = {
  fast: 1.1,
  moderate: 1,
  slow: 0.92,
  unknown: 1,
} as const;

export const drainageCaptureFactor = {
  fast: 0.72,
  moderate: 0.9,
  slow: 0.82,
  unknown: 0.75,
} as const;

export interface BalanceEvent {
  atMs: number;
  deltaInches: number;
  order: number;
}

export interface TargetFactors {
  baseDailyDemandInches: number;
  cropDemandPerReferenceEtInch: number;
  contextUncertain: boolean;
  rainCaptureFactor: number;
  rootZoneCapacityInches: number;
  stageCoefficient: number;
  triggerDepletionInches: number;
}

export interface ForecastProjection {
  firstThresholdCrossing: { atIso: string; depletionInches: number } | null;
  forecastRainCreditInches: number;
  projectedDepletionInches: number;
  suppression: { untilIso: string } | null;
  usedEtEstimate: boolean;
}

export function round(value: number) {
  return Math.round((value + Number.EPSILON) * 1_000) / 1_000;
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function assertFiniteNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a finite, non-negative number.`);
  }
}

export function assertFraction(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1.`);
  }
}

function qualityRank(quality: WaterDataQuality) {
  return {
    fresh: 0,
    cached: 1,
    stale: 2,
    insufficient: 3,
  }[quality];
}

export function worstQuality(...qualities: WaterDataQuality[]) {
  return qualities.reduce((worst, quality) =>
    qualityRank(quality) > qualityRank(worst) ? quality : worst,
  );
}

export function addReason(
  reasons: WateringReasonDetail[],
  code: WateringReasonCode,
  message: string,
  amountInches: number | null = null,
  sourceIds: readonly string[] = [],
) {
  reasons.push({
    amountInches: amountInches === null ? null : round(amountInches),
    code,
    message,
    sourceIds: [...sourceIds],
  });
}

export function assertUniqueIds(
  items: readonly { id: string }[],
  label: string,
) {
  const ids = new Set<string>();

  for (const item of items) {
    if (ids.has(item.id)) {
      throw new Error(`${label} contains duplicate id ${item.id}.`);
    }

    ids.add(item.id);
  }
}

export function assertOrderedIntervals<
  T extends { endIso: string; id: string; startIso: string },
>(intervals: readonly T[], label: string) {
  const sorted = [...intervals].sort(
    (left, right) => Date.parse(left.startIso) - Date.parse(right.startIso),
  );
  let previousEnd = Number.NEGATIVE_INFINITY;

  for (const interval of sorted) {
    assertIsoInstant(interval.startIso);
    assertIsoInstant(interval.endIso);
    const start = Date.parse(interval.startIso);
    const end = Date.parse(interval.endIso);

    if (end <= start) {
      throw new Error(
        `${label} interval ${interval.id} must have positive duration.`,
      );
    }

    if (start < previousEnd) {
      throw new Error(`${label} intervals must not overlap.`);
    }

    previousEnd = end;
  }

  return sorted;
}

export function profileFingerprint(target: CropGroupWateringTarget) {
  const profile = target.planting.waterProfile;
  const structure = target.structure;
  return [
    profile.source,
    profile.sourceVersion,
    profile.baseWeeklyInches,
    profile.rootDepthInches,
    profile.depletionFraction,
    target.stage,
    target.stageSource,
    profile.stageCoefficients[target.stage],
    structure?.type ?? 'none',
    structure?.soilType ?? 'unknown',
    structure?.soilDepthInches ?? 'unknown',
    structure?.drainage ?? 'unknown',
    target.planting.mulched || structure?.mulched === true ? 'mulched' : 'bare',
  ].join('|');
}

export function hasReliableArea(
  area: CropGroupWateringTarget['area'],
): area is CropGroupWateringTarget['area'] & { squareFeet: number } {
  return (
    area.squareFeet !== null &&
    area.squareFeet > 0 &&
    (area.reliability === 'measured' || area.reliability === 'geometry')
  );
}
