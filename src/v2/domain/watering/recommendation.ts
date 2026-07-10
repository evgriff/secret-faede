import { getGardenDate, nextGardenTimeIso } from '../time/gardenTime';
import {
  applyBalanceEvents,
  historicalEvents,
  resolveApplications,
} from './balanceAccrual';
import { projectForecast } from './forecastProjection';
import {
  EPSILON,
  GALLONS_PER_INCH_SQUARE_FOOT,
  addReason,
  hasReliableArea,
  profileFingerprint,
  round,
  worstQuality,
} from './modelSupport';
import { buildRecommendationBasis, getTargetFactors } from './targetFactors';
import {
  WATERING_CALCULATION_REVISION,
  WATERING_MODEL_VERSION,
  type CropGroupWateringTarget,
  type ForecastWeatherPeriod,
  type HistoricalWeatherObservation,
  type WaterBalanceBaseline,
  type WaterDataQuality,
  type WateringCalculationInput,
  type WateringConfidence,
  type WateringReasonDetail,
  type WateringRecommendation,
  type WateringRecommendationStatus,
} from './types';

function resolveConfidence(
  dataQuality: WaterDataQuality,
  profileConfidence: WateringConfidence,
  contextUncertain: boolean,
  usedEtEstimate: boolean,
  amountUncertain: boolean,
): WateringConfidence {
  if (
    dataQuality === 'stale' ||
    dataQuality === 'insufficient' ||
    amountUncertain
  ) {
    return 'low';
  }
  if (
    dataQuality === 'cached' ||
    profileConfidence !== 'high' ||
    contextUncertain ||
    usedEtEstimate
  ) {
    return 'medium';
  }
  return 'high';
}

function statusFor(
  isDue: boolean,
  hasSuppression: boolean,
  mustCheckSoil: boolean,
): WateringRecommendationStatus {
  if (mustCheckSoil) return 'checkSoil';
  if (isDue && hasSuppression) return 'suppressed';
  return isDue ? 'due' : 'scheduled';
}

function actionForStatus(status: WateringRecommendationStatus) {
  switch (status) {
    case 'due':
      return { action: 'waterNow' as const, actionable: true };
    case 'scheduled':
      return { action: 'planWatering' as const, actionable: false };
    case 'suppressed':
      return { action: 'waitForForecast' as const, actionable: false };
    case 'checkSoil':
      return { action: 'checkSoil' as const, actionable: true };
  }
}

function earlierIso(left: string, right: string) {
  return Date.parse(left) <= Date.parse(right) ? left : right;
}

export function calculateTargetRecommendation(
  input: WateringCalculationInput,
  target: CropGroupWateringTarget,
  baseline: WaterBalanceBaseline,
  observations: readonly HistoricalWeatherObservation[],
  forecastPeriods: readonly ForecastWeatherPeriod[],
): WateringRecommendation {
  const reasons: WateringReasonDetail[] = [];
  const factors = getTargetFactors(target, reasons);
  const fingerprint = profileFingerprint(target);

  if (
    baseline.profileFingerprint !== 'uninitialized' &&
    baseline.profileFingerprint !== fingerprint
  ) {
    addReason(
      reasons,
      'PROFILE_REVISION_APPLIED',
      'The persisted deficit is retained while crop stage or soil-profile factors are recalculated.',
    );
  }

  const historical = historicalEvents(
    observations,
    baseline.asOfIso,
    input.nowIso,
    input.timezone,
    factors,
    reasons,
  );
  const applicationResult = resolveApplications(
    input.applications.filter(
      (application) => application.cropGroupId === target.planting.id,
    ),
    baseline,
    Date.parse(input.nowIso),
    reasons,
  );
  const depletion = applyBalanceEvents(
    baseline.depletionInches,
    factors.rootZoneCapacityInches,
    [...applicationResult.events, ...historical.events],
    reasons,
  );
  const nextBalance: WaterBalanceBaseline = {
    applicationLedger: applicationResult.ledger,
    asOfIso: input.nowIso,
    calculationRevision: WATERING_CALCULATION_REVISION,
    cropGroupId: target.planting.id,
    depletionInches: round(depletion),
    modelVersion: WATERING_MODEL_VERSION,
    profileFingerprint: fingerprint,
  };
  addReason(
    reasons,
    'BALANCE_ROLLED_FORWARD',
    'The durable crop-group balance is advanced only through the calculation instant.',
    depletion,
  );

  let historicalQuality = input.historicalWeather.quality;
  let forecastQuality = input.forecastWeather.quality;
  const futureForecast = forecastPeriods.filter(
    (period) => Date.parse(period.endIso) > Date.parse(input.nowIso),
  );
  const forecastRainIncomplete = futureForecast.some(
    (period) =>
      period.expectedRainInches === null ||
      period.precipitationProbabilityPercent === null,
  );

  if (historical.hasGap || historical.missingRain) {
    historicalQuality = 'insufficient';
  }
  if (futureForecast.length === 0 || forecastRainIncomplete) {
    forecastQuality = 'insufficient';
  }
  if (
    input.historicalWeather.quality === 'cached' ||
    input.forecastWeather.quality === 'cached'
  ) {
    addReason(
      reasons,
      'CACHED_WEATHER_USED',
      'Cached weather remains usable but lowers recommendation confidence.',
    );
  }
  if (historicalQuality === 'stale') {
    addReason(
      reasons,
      'HISTORICAL_WEATHER_STALE',
      'Historical weather is stale, so the soil should be checked before watering.',
    );
  } else if (historicalQuality === 'insufficient') {
    addReason(
      reasons,
      'HISTORICAL_WEATHER_INSUFFICIENT',
      'Historical weather is incomplete, so the accrued balance is not fully actionable.',
    );
  }
  if (forecastQuality === 'stale') {
    addReason(
      reasons,
      'FORECAST_WEATHER_STALE',
      'The forecast is stale and cannot safely suppress or schedule watering.',
    );
  } else if (forecastQuality === 'insufficient') {
    addReason(
      reasons,
      'FORECAST_WEATHER_INSUFFICIENT',
      'The forecast is incomplete and cannot safely suppress or schedule watering.',
    );
  }

  const dataQuality = worstQuality(historicalQuality, forecastQuality);
  const forecastIsActionable =
    forecastQuality === 'fresh' || forecastQuality === 'cached';
  const projection = projectForecast(
    forecastIsActionable ? futureForecast : [],
    input.nowIso,
    depletion,
    input.timezone,
    factors,
  );
  if (projection.usedEtEstimate) {
    addReason(
      reasons,
      'FORECAST_ET_ESTIMATED',
      'Crop weekly need estimates future demand where forecast ET is unavailable.',
    );
  }

  const isDue = depletion + EPSILON >= factors.triggerDepletionInches;
  const mustCheckSoil =
    dataQuality === 'stale' ||
    dataQuality === 'insufficient' ||
    applicationResult.amountUncertain ||
    (isDue &&
      (factors.contextUncertain ||
        target.planting.waterProfile.confidence === 'low'));
  const status = statusFor(
    isDue,
    projection.suppression !== null,
    mustCheckSoil,
  );
  addReason(
    reasons,
    isDue ? 'BALANCE_AT_OR_ABOVE_TRIGGER' : 'BALANCE_BELOW_TRIGGER',
    isDue
      ? 'The accrued root-zone depletion has reached the crop-specific action threshold.'
      : 'The accrued root-zone depletion remains below the crop-specific action threshold.',
    depletion,
  );
  if (status === 'suppressed') {
    addReason(
      reasons,
      'FORECAST_RAIN_SUPPRESSION',
      'Quantified near-term forecast rain is expected to move the future balance below the action threshold.',
    );
  }
  if (status === 'scheduled' && projection.firstThresholdCrossing) {
    addReason(
      reasons,
      'FORECAST_DEPLETION_EXPECTED',
      'Forecast demand is expected to move the future balance to the action threshold.',
      projection.firstThresholdCrossing.depletionInches,
    );
  }

  const confidence = resolveConfidence(
    dataQuality,
    target.planting.waterProfile.confidence,
    factors.contextUncertain,
    historical.missingEt ||
      projection.usedEtEstimate ||
      target.stageSource === 'lifecycleFallback',
    applicationResult.amountUncertain,
  );
  const scheduledForIso =
    status === 'scheduled'
      ? (projection.firstThresholdCrossing?.atIso ?? null)
      : null;
  const suppressedUntilIso =
    status === 'suppressed' ? (projection.suppression?.untilIso ?? null) : null;
  const defaultRecheck = nextGardenTimeIso(
    input.nowIso,
    input.checkTimeLocal,
    input.timezone,
  );
  const recheckAtIso =
    suppressedUntilIso ??
    (scheduledForIso
      ? earlierIso(defaultRecheck, scheduledForIso)
      : defaultRecheck);
  const recommendedDepthInches =
    status === 'due'
      ? round(depletion)
      : status === 'scheduled' && projection.firstThresholdCrossing
        ? round(projection.firstThresholdCrossing.depletionInches)
        : null;
  const recommendedGallons =
    recommendedDepthInches !== null && hasReliableArea(target.area)
      ? round(
          recommendedDepthInches *
            target.area.squareFeet *
            GALLONS_PER_INCH_SQUARE_FOOT,
        )
      : null;
  if (recommendedDepthInches !== null && !hasReliableArea(target.area)) {
    addReason(
      reasons,
      'AREA_UNRELIABLE_NO_GALLONS',
      'Gallons are omitted because the irrigated crop-group area is not reliable.',
    );
  }

  const { action, actionable } = actionForStatus(status);
  return {
    action,
    actionable,
    balance: nextBalance,
    basis: buildRecommendationBasis(target, factors),
    calculatedAtIso: input.nowIso,
    calculationRevision: WATERING_CALCULATION_REVISION,
    confidence,
    dataQuality,
    forecastRainCreditInches: round(projection.forecastRainCreditInches),
    id: `watering:${target.planting.id}:${getGardenDate(input.nowIso, input.timezone)}:r${WATERING_CALCULATION_REVISION}`,
    modelVersion: WATERING_MODEL_VERSION,
    projectedDepletionInches: round(projection.projectedDepletionInches),
    reasonCodes: [...new Set(reasons.map((reason) => reason.code))],
    reasonDetails: reasons,
    recommendedDepthInches,
    recommendedGallons,
    recheckAtIso,
    rootZoneCapacityInches: round(factors.rootZoneCapacityInches),
    scheduledForIso,
    status,
    suppressedUntilIso,
    target: {
      cropGroupId: target.planting.id,
      cropGroupLabel: target.label,
      cropId: target.planting.cropId,
      cropName: target.planting.cropName,
      deepLink: target.deepLink,
      kind: 'cropGroup',
      plantingIds: [target.planting.id],
      structureId: target.structure?.id ?? null,
    },
    triggerDepletionInches: round(factors.triggerDepletionInches),
  };
}
