'use strict';

const { formatLocalDate } = require('./operationTime');
const {
  GALLONS_PER_INCH_SQUARE_FOOT,
  WATERING_CALCULATION_REVISION,
  WATERING_MODEL_VERSION,
  buildRecommendationBasis,
  hasReliableArea,
  nextGardenTimeIso,
  reason,
  round,
  worstQuality,
} = require('./wateringV2Support');

function resolveQuality(input, historical, forecastPeriods, reasons) {
  let historicalQuality = input.historicalWeather.quality;
  let forecastQuality = input.forecastWeather.quality;
  const future = forecastPeriods.filter(
    (period) => Date.parse(period.endIso) > Date.parse(input.nowIso),
  );
  if (historical.hasGap || historical.missingRain) {
    historicalQuality = 'insufficient';
  }
  if (
    future.length === 0 ||
    future.some(
      (period) =>
        period.expectedRainInches === null ||
        period.precipitationProbabilityPercent === null,
    )
  ) {
    forecastQuality = 'insufficient';
  }
  if (
    input.historicalWeather.quality === 'cached' ||
    input.forecastWeather.quality === 'cached'
  ) {
    reasons.push(
      reason(
        'CACHED_WEATHER_USED',
        'Cached weather remains usable but lowers recommendation confidence.',
      ),
    );
  }
  if (historicalQuality === 'stale') {
    reasons.push(
      reason(
        'HISTORICAL_WEATHER_STALE',
        'Historical weather is stale, so the soil should be checked before watering.',
      ),
    );
  } else if (historicalQuality === 'insufficient') {
    reasons.push(
      reason(
        'HISTORICAL_WEATHER_INSUFFICIENT',
        'Historical weather is incomplete, so the accrued balance is not fully actionable.',
      ),
    );
  }
  if (forecastQuality === 'stale') {
    reasons.push(
      reason(
        'FORECAST_WEATHER_STALE',
        'The forecast is stale and cannot safely suppress or schedule watering.',
      ),
    );
  } else if (forecastQuality === 'insufficient') {
    reasons.push(
      reason(
        'FORECAST_WEATHER_INSUFFICIENT',
        'The forecast is incomplete and cannot safely suppress or schedule watering.',
      ),
    );
  }
  return {
    forecast: forecastQuality,
    historical: historicalQuality,
    overall: worstQuality(historicalQuality, forecastQuality),
  };
}

function buildRecommendation(input) {
  const scheduledForIso =
    input.status === 'scheduled'
      ? input.projection.firstThresholdCrossing?.atIso || null
      : null;
  const suppressedUntilIso =
    input.status === 'suppressed'
      ? input.projection.suppression?.untilIso || null
      : null;
  const defaultRecheck = nextGardenTimeIso(
    input.input.nowIso,
    input.input.checkTimeLocal,
    input.input.timezone,
  );
  const recommendedDepthInches =
    input.status === 'due'
      ? round(input.depletion)
      : input.status === 'scheduled' && input.projection.firstThresholdCrossing
        ? round(input.projection.firstThresholdCrossing.depletionInches)
        : null;
  const areaIsReliable = hasReliableArea(input.target.area);
  const recommendedGallons =
    recommendedDepthInches !== null && areaIsReliable
      ? round(
          recommendedDepthInches *
            input.target.area.squareFeet *
            GALLONS_PER_INCH_SQUARE_FOOT,
        )
      : null;
  if (recommendedDepthInches !== null && !areaIsReliable) {
    input.reasons.push(
      reason(
        'AREA_UNRELIABLE_NO_GALLONS',
        'Gallons are omitted because the irrigated crop-group area is not reliable.',
      ),
    );
  }
  const confidence = resolveConfidence(input);
  const action = {
    checkSoil: 'checkSoil',
    due: 'waterNow',
    scheduled: 'planWatering',
    suppressed: 'waitForForecast',
  }[input.status];

  return {
    action,
    actionable: ['due', 'checkSoil'].includes(input.status),
    balance: input.balance,
    basis: buildRecommendationBasis(input.target, input.factors),
    calculatedAtIso: input.input.nowIso,
    calculationRevision: WATERING_CALCULATION_REVISION,
    confidence,
    dataQuality: input.quality,
    forecastRainCreditInches: round(input.projection.forecastRainCreditInches),
    id: `watering:${input.target.planting.id}:${formatLocalDate(new Date(input.input.nowIso), input.input.timezone)}:r${WATERING_CALCULATION_REVISION}`,
    modelVersion: WATERING_MODEL_VERSION,
    projectedDepletionInches: round(input.projection.projectedDepletionInches),
    reasonCodes: [...new Set(input.reasons.map((entry) => entry.code))],
    reasonDetails: input.reasons,
    recommendedDepthInches,
    recommendedGallons,
    recheckAtIso:
      suppressedUntilIso ||
      (scheduledForIso &&
      Date.parse(scheduledForIso) <= Date.parse(defaultRecheck)
        ? scheduledForIso
        : defaultRecheck),
    rootZoneCapacityInches: round(input.factors.rootZoneCapacityInches),
    scheduledForIso,
    status: input.status,
    suppressedUntilIso,
    target: {
      cropGroupId: input.target.planting.id,
      cropGroupLabel: input.target.label,
      cropId: input.target.planting.cropId,
      cropName: input.target.planting.cropName,
      deepLink: input.target.deepLink,
      kind: 'cropGroup',
      plantingIds: [input.target.planting.id],
      structureId: input.target.structure?.id ?? null,
    },
    triggerDepletionInches: round(input.factors.triggerDepletionInches),
  };
}

function resolveConfidence(input) {
  if (
    ['stale', 'insufficient'].includes(input.quality) ||
    input.applications.amountUncertain
  ) {
    return 'low';
  }
  if (
    input.quality === 'cached' ||
    input.target.planting.waterProfile.confidence !== 'high' ||
    input.factors.contextUncertain ||
    input.historicalMissingEt ||
    input.target.stageSource === 'lifecycleFallback' ||
    input.projection.usedEtEstimate
  ) {
    return 'medium';
  }
  return 'high';
}

module.exports = { buildRecommendation, resolveQuality };
