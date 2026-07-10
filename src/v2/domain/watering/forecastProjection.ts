import { differenceInGardenDays } from '../time/gardenTime';
import {
  EPSILON,
  FORECAST_RAIN_CREDIT_WINDOW_MS,
  FORECAST_SUPPRESSION_WINDOW_MS,
  assertFiniteNonNegative,
  clamp,
  type ForecastProjection,
  type TargetFactors,
} from './modelSupport';
import type { ForecastWeatherPeriod } from './types';

export function projectForecast(
  periods: readonly ForecastWeatherPeriod[],
  nowIso: string,
  startingDepletionInches: number,
  timezone: string,
  factors: TargetFactors,
): ForecastProjection {
  const nowMs = Date.parse(nowIso);
  const rainCreditWindowEndMs = nowMs + FORECAST_RAIN_CREDIT_WINDOW_MS;
  let projected = startingDepletionInches;
  let firstThresholdCrossing: ForecastProjection['firstThresholdCrossing'] =
    null;
  let forecastRainCreditInches = 0;
  let suppression: ForecastProjection['suppression'] = null;
  let usedEtEstimate = false;
  const startedDue = projected + EPSILON >= factors.triggerDepletionInches;

  for (const period of periods) {
    const periodStart = Date.parse(period.startIso);
    const periodEnd = Date.parse(period.endIso);
    const clippedStart = Math.max(nowMs, periodStart);
    if (periodEnd <= clippedStart) continue;

    if (period.expectedRainInches !== null) {
      assertFiniteNonNegative(
        period.expectedRainInches,
        'forecast expectedRainInches',
      );
    }
    if (period.referenceEtInches !== null) {
      assertFiniteNonNegative(
        period.referenceEtInches,
        'forecast referenceEtInches',
      );
    }
    if (
      period.precipitationProbabilityPercent !== null &&
      (!Number.isFinite(period.precipitationProbabilityPercent) ||
        period.precipitationProbabilityPercent < 0 ||
        period.precipitationProbabilityPercent > 100)
    ) {
      throw new Error(
        'forecast precipitationProbabilityPercent must be between 0 and 100.',
      );
    }

    const fraction = (periodEnd - clippedStart) / (periodEnd - periodStart);
    const periodDays = Math.max(
      0,
      differenceInGardenDays(
        new Date(clippedStart).toISOString(),
        period.endIso,
        timezone,
      ),
    );
    usedEtEstimate ||= period.referenceEtInches === null;
    const demand =
      period.referenceEtInches === null
        ? periodDays * factors.baseDailyDemandInches
        : period.referenceEtInches *
          fraction *
          factors.cropDemandPerReferenceEtInch;
    const probability = (period.precipitationProbabilityPercent ?? 0) / 100;
    const forecastRain =
      (period.expectedRainInches ?? 0) *
      fraction *
      probability *
      factors.rainCaptureFactor;
    const rainCreditEnd = Math.min(periodEnd, rainCreditWindowEndMs);
    const rainCreditFraction = Math.max(
      0,
      (rainCreditEnd - clippedStart) / (periodEnd - periodStart),
    );
    forecastRainCreditInches +=
      (period.expectedRainInches ?? 0) *
      rainCreditFraction *
      probability *
      factors.rainCaptureFactor;
    const before = projected;
    projected = clamp(
      projected + demand - forecastRain,
      0,
      factors.rootZoneCapacityInches,
    );

    if (
      firstThresholdCrossing === null &&
      before < factors.triggerDepletionInches &&
      projected + EPSILON >= factors.triggerDepletionInches
    ) {
      firstThresholdCrossing = {
        atIso: period.endIso,
        depletionInches: projected,
      };
    }

    if (
      suppression === null &&
      startedDue &&
      forecastRain > EPSILON &&
      periodStart - nowMs <= FORECAST_SUPPRESSION_WINDOW_MS &&
      before < factors.rootZoneCapacityInches * 0.9 &&
      projected + EPSILON < factors.triggerDepletionInches
    ) {
      suppression = { untilIso: period.endIso };
    }
  }

  return {
    firstThresholdCrossing,
    forecastRainCreditInches,
    projectedDepletionInches: projected,
    suppression,
    usedEtEstimate,
  };
}
