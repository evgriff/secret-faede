import { assertIsoInstant, assertValidTimezone } from '../time/gardenTime';
import {
  assertFiniteNonNegative,
  assertOrderedIntervals,
  assertUniqueIds,
} from './modelSupport';
import { calculateTargetRecommendation } from './recommendation';
import { createInitialWaterBalance } from './targets';
import {
  WATERING_CALCULATION_REVISION,
  WATERING_MODEL_VERSION,
  type WateringCalculationInput,
  type WateringCalculationResult,
  type WateringReasonDetail,
} from './types';

export function calculateWateringRecommendations(
  input: WateringCalculationInput,
): WateringCalculationResult {
  assertIsoInstant(input.nowIso);
  assertValidTimezone(input.timezone);
  assertUniqueIds(
    input.targets.map((target) => ({ id: target.planting.id })),
    'targets',
  );
  assertUniqueIds(input.applications, 'applications');
  assertUniqueIds(
    input.priorBalances.map((balance) => ({ id: balance.cropGroupId })),
    'priorBalances',
  );
  assertUniqueIds(input.historicalWeather.observations, 'historicalWeather');
  assertUniqueIds(input.forecastWeather.periods, 'forecastWeather');
  const observations = assertOrderedIntervals(
    input.historicalWeather.observations,
    'Historical weather',
  );
  const forecastPeriods = assertOrderedIntervals(
    input.forecastWeather.periods,
    'Forecast weather',
  );
  const balances = new Map(
    input.priorBalances.map((balance) => [balance.cropGroupId, balance]),
  );
  const nowMs = Date.parse(input.nowIso);

  if (input.historicalWeather.sourceUpdatedAtIso !== null) {
    assertIsoInstant(input.historicalWeather.sourceUpdatedAtIso);
  }
  if (input.forecastWeather.generatedAtIso !== null) {
    assertIsoInstant(input.forecastWeather.generatedAtIso);
  }

  const recommendations = input.targets.map((target) => {
    const existing = balances.get(target.planting.id);
    if (!existing) {
      const initialized = createInitialWaterBalance({
        asOfIso: input.nowIso,
        cropGroupId: target.planting.id,
      });
      const recommendation = calculateTargetRecommendation(
        input,
        target,
        initialized,
        observations,
        forecastPeriods,
      );
      const missingReason: WateringReasonDetail = {
        amountInches: null,
        code: 'MISSING_BALANCE_BASELINE',
        message:
          'A durable prior balance is required before an automatic watering amount is actionable.',
        sourceIds: [],
      };
      return {
        ...recommendation,
        action: 'checkSoil' as const,
        actionable: true,
        confidence: 'low' as const,
        dataQuality: 'insufficient' as const,
        reasonCodes: [
          'MISSING_BALANCE_BASELINE' as const,
          ...recommendation.reasonCodes,
        ],
        reasonDetails: [missingReason, ...recommendation.reasonDetails],
        recommendedDepthInches: null,
        recommendedGallons: null,
        scheduledForIso: null,
        status: 'checkSoil' as const,
        suppressedUntilIso: null,
      };
    }
    if (
      existing.modelVersion !== WATERING_MODEL_VERSION ||
      existing.calculationRevision !== WATERING_CALCULATION_REVISION
    ) {
      throw new Error(
        `Water balance ${existing.cropGroupId} uses an unsupported model revision.`,
      );
    }
    assertIsoInstant(existing.asOfIso);
    assertFiniteNonNegative(
      existing.depletionInches,
      'balance depletionInches',
    );
    if (Date.parse(existing.asOfIso) > nowMs) {
      throw new Error(
        `Water balance ${existing.cropGroupId} is newer than the calculation instant.`,
      );
    }
    return calculateTargetRecommendation(
      input,
      target,
      existing,
      observations,
      forecastPeriods,
    );
  });

  return {
    calculatedAtIso: input.nowIso,
    calculationRevision: WATERING_CALCULATION_REVISION,
    gardenId: input.gardenId,
    modelVersion: WATERING_MODEL_VERSION,
    recommendations,
    timezone: input.timezone,
  };
}

export {
  createCropGroupWateringTarget,
  createInitialWaterBalance,
  isWateringActivePlanting,
  resolveLifecycleWateringStage,
  resolvePlantingWateringStage,
} from './targets';
