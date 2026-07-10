'use strict';

const {
  applyBalanceEvents,
  historicalEvents,
  resolveApplications,
} = require('./wateringV2Balance');
const { projectForecast } = require('./wateringV2Forecast');
const {
  buildRecommendation,
  resolveQuality,
} = require('./wateringV2Recommendation');
const {
  EPSILON,
  WATERING_CALCULATION_REVISION,
  WATERING_MODEL_VERSION,
  assertIsoInstant,
  assertNonNegative,
  createCropGroupTargets,
  createInitialWaterBalance,
  getTargetFactors,
  isValidTimezone,
  profileFingerprint,
  reason,
  round,
} = require('./wateringV2Support');

function calculateWateringRecommendations(input) {
  validateInput(input);
  const observations = orderedIntervals(
    input.historicalWeather.observations,
    'Historical weather',
  );
  const forecastPeriods = orderedIntervals(
    input.forecastWeather.periods,
    'Forecast weather',
  );
  const balances = new Map(
    input.priorBalances.map((balance) => [balance.cropGroupId, balance]),
  );
  const recommendations = input.targets.map((target) => {
    const existing = balances.get(target.planting.id);

    if (!existing) {
      const recommendation = calculateTarget(
        input,
        target,
        createInitialWaterBalance(input.nowIso, target.planting.id),
        observations,
        forecastPeriods,
      );
      const missing = reason(
        'MISSING_BALANCE_BASELINE',
        'A durable prior balance is required before an automatic watering amount is actionable.',
      );
      return {
        ...recommendation,
        action: 'checkSoil',
        actionable: true,
        confidence: 'low',
        dataQuality: 'insufficient',
        reasonCodes: [
          'MISSING_BALANCE_BASELINE',
          ...recommendation.reasonCodes,
        ],
        reasonDetails: [missing, ...recommendation.reasonDetails],
        recommendedDepthInches: null,
        recommendedGallons: null,
        scheduledForIso: null,
        status: 'checkSoil',
        suppressedUntilIso: null,
      };
    }

    validateBalance(existing, input.nowIso);
    return calculateTarget(
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

function calculateTarget(
  input,
  target,
  baseline,
  observations,
  forecastPeriods,
) {
  const reasons = [];
  const factors = getTargetFactors(target, reasons);
  const fingerprint = profileFingerprint(target);
  if (
    baseline.profileFingerprint !== 'uninitialized' &&
    baseline.profileFingerprint !== fingerprint
  ) {
    reasons.push(
      reason(
        'PROFILE_REVISION_APPLIED',
        'The persisted deficit is retained while crop stage or soil-profile factors are recalculated.',
      ),
    );
  }

  const historical = historicalEvents({
    baselineIso: baseline.asOfIso,
    factors,
    nowIso: input.nowIso,
    observations,
    reasons,
    timezone: input.timezone,
  });
  const applications = resolveApplications(
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
    [...applications.events, ...historical.events],
    reasons,
  );
  const balance = {
    applicationLedger: applications.ledger,
    asOfIso: input.nowIso,
    calculationRevision: WATERING_CALCULATION_REVISION,
    cropGroupId: target.planting.id,
    depletionInches: round(depletion),
    modelVersion: WATERING_MODEL_VERSION,
    profileFingerprint: fingerprint,
  };
  reasons.push(
    reason(
      'BALANCE_ROLLED_FORWARD',
      'The durable crop-group balance is advanced only through the calculation instant.',
      depletion,
    ),
  );

  const quality = resolveQuality(input, historical, forecastPeriods, reasons);
  const futureForecast = forecastPeriods.filter(
    (period) => Date.parse(period.endIso) > Date.parse(input.nowIso),
  );
  const projection = projectForecast(
    ['fresh', 'cached'].includes(quality.forecast) ? futureForecast : [],
    input.nowIso,
    depletion,
    input.timezone,
    factors,
  );
  if (projection.usedEtEstimate) {
    reasons.push(
      reason(
        'FORECAST_ET_ESTIMATED',
        'Crop weekly need estimates future demand where forecast ET is unavailable.',
      ),
    );
  }

  const isDue = depletion + EPSILON >= factors.triggerDepletionInches;
  const mustCheckSoil =
    ['stale', 'insufficient'].includes(quality.overall) ||
    applications.amountUncertain ||
    (isDue &&
      (factors.contextUncertain ||
        target.planting.waterProfile.confidence === 'low'));
  const status = mustCheckSoil
    ? 'checkSoil'
    : isDue && projection.suppression
      ? 'suppressed'
      : isDue
        ? 'due'
        : 'scheduled';
  reasons.push(
    reason(
      isDue ? 'BALANCE_AT_OR_ABOVE_TRIGGER' : 'BALANCE_BELOW_TRIGGER',
      isDue
        ? 'The accrued root-zone depletion has reached the crop-specific action threshold.'
        : 'The accrued root-zone depletion remains below the crop-specific action threshold.',
      depletion,
    ),
  );

  if (status === 'suppressed') {
    reasons.push(
      reason(
        'FORECAST_RAIN_SUPPRESSION',
        'Quantified near-term forecast rain is expected to move the future balance below the action threshold.',
      ),
    );
  }
  if (status === 'scheduled' && projection.firstThresholdCrossing) {
    reasons.push(
      reason(
        'FORECAST_DEPLETION_EXPECTED',
        'Forecast demand is expected to move the future balance to the action threshold.',
        projection.firstThresholdCrossing.depletionInches,
      ),
    );
  }

  return buildRecommendation({
    applications,
    balance,
    depletion,
    factors,
    historicalMissingEt: historical.missingEt,
    input,
    projection,
    quality: quality.overall,
    reasons,
    status,
    target,
  });
}

function validateInput(input) {
  assertIsoInstant(input.nowIso);
  if (!isValidTimezone(input.timezone)) throw new Error('Invalid timezone.');
  assertUnique(input.targets, (item) => item.planting.id, 'targets');
  assertUnique(input.applications, (item) => item.id, 'applications');
  assertUnique(input.priorBalances, (item) => item.cropGroupId, 'balances');
  assertUnique(
    input.historicalWeather.observations,
    (item) => item.id,
    'historicalWeather',
  );
  assertUnique(
    input.forecastWeather.periods,
    (item) => item.id,
    'forecastWeather',
  );
  if (input.historicalWeather.sourceUpdatedAtIso !== null) {
    assertIsoInstant(input.historicalWeather.sourceUpdatedAtIso);
  }
  if (input.forecastWeather.generatedAtIso !== null) {
    assertIsoInstant(input.forecastWeather.generatedAtIso);
  }
}

function validateBalance(balance, nowIso) {
  if (
    balance.modelVersion !== WATERING_MODEL_VERSION ||
    balance.calculationRevision !== WATERING_CALCULATION_REVISION
  ) {
    throw new Error(`Unsupported water balance ${balance.cropGroupId}.`);
  }
  assertIsoInstant(balance.asOfIso);
  assertNonNegative(balance.depletionInches, 'balance depletion');
  if (Date.parse(balance.asOfIso) > Date.parse(nowIso))
    throw new Error('Future water balance.');
}

function orderedIntervals(items, label) {
  const sorted = [...items].sort(
    (a, b) => Date.parse(a.startIso) - Date.parse(b.startIso),
  );
  let previousEnd = -Infinity;
  for (const item of sorted) {
    assertIsoInstant(item.startIso);
    assertIsoInstant(item.endIso);
    const start = Date.parse(item.startIso);
    const end = Date.parse(item.endIso);
    if (end <= start || start < previousEnd)
      throw new Error(`${label} intervals are invalid.`);
    previousEnd = end;
  }
  return sorted;
}

function assertUnique(items, getId, label) {
  const ids = new Set();
  for (const item of items) {
    const id = getId(item);
    if (ids.has(id)) throw new Error(`${label} contains duplicate ${id}.`);
    ids.add(id);
  }
}

module.exports = {
  WATERING_CALCULATION_REVISION,
  WATERING_MODEL_VERSION,
  calculateWateringRecommendations,
  createCropGroupTargets,
};
