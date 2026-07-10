'use strict';

const {
  EPSILON,
  assertNonNegative,
  clamp,
  differenceInGardenDays,
} = require('./wateringV2Support');

const SUPPRESSION_WINDOW_MS = 48 * 60 * 60 * 1000;
const RAIN_CREDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

function projectForecast(periods, nowIso, starting, timezone, factors) {
  const nowMs = Date.parse(nowIso);
  const rainCreditWindowEndMs = nowMs + RAIN_CREDIT_WINDOW_MS;
  let projected = starting;
  let firstThresholdCrossing = null;
  let forecastRainCreditInches = 0;
  let suppression = null;
  let usedEtEstimate = false;
  const startedDue = projected + EPSILON >= factors.triggerDepletionInches;

  for (const period of periods) {
    const periodStart = Date.parse(period.startIso);
    const periodEnd = Date.parse(period.endIso);
    const clippedStart = Math.max(nowMs, periodStart);
    if (periodEnd <= clippedStart) continue;

    if (period.expectedRainInches !== null) {
      assertNonNegative(
        period.expectedRainInches,
        'forecast expectedRainInches',
      );
    }
    if (period.referenceEtInches !== null) {
      assertNonNegative(period.referenceEtInches, 'forecast referenceEtInches');
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
    const forecastRain =
      (period.expectedRainInches || 0) *
      fraction *
      ((period.precipitationProbabilityPercent || 0) / 100) *
      factors.rainCaptureFactor;
    const rainCreditEnd = Math.min(periodEnd, rainCreditWindowEndMs);
    const rainCreditFraction = Math.max(
      0,
      (rainCreditEnd - clippedStart) / (periodEnd - periodStart),
    );
    forecastRainCreditInches +=
      (period.expectedRainInches || 0) *
      rainCreditFraction *
      ((period.precipitationProbabilityPercent || 0) / 100) *
      factors.rainCaptureFactor;
    const before = projected;
    projected = clamp(
      projected + demand - forecastRain,
      0,
      factors.rootZoneCapacityInches,
    );

    if (
      !firstThresholdCrossing &&
      before < factors.triggerDepletionInches &&
      projected + EPSILON >= factors.triggerDepletionInches
    ) {
      firstThresholdCrossing = {
        atIso: period.endIso,
        depletionInches: projected,
      };
    }
    if (
      !suppression &&
      startedDue &&
      forecastRain > EPSILON &&
      periodStart - nowMs <= SUPPRESSION_WINDOW_MS &&
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

module.exports = { projectForecast };
