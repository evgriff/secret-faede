'use strict';

const {
  buildAutomatedTasks,
  mergeAutomatedTasks,
} = require('./taskAutomationV2');
const {
  calculateWateringRecommendations,
  createCropGroupTargets,
} = require('./wateringModelV2');
const {
  buildWeatherInputs,
  createWeatherSnapshot,
} = require('./weatherWateringInputs');

async function generateGardenOperations({
  now = new Date(),
  operationsSettings,
  plan,
  sharedOperations,
  validationWarnings = [],
  weatherProvider,
  logger,
}) {
  const location = {
    latitude: plan.plot.location.coordinates?.latitude ?? null,
    locationName: plan.plot.location.label,
    longitude: plan.plot.location.coordinates?.longitude ?? null,
    timezone: plan.plot.location.timezone,
  };
  const context = await loadWeatherWateringContext(
    weatherProvider,
    location,
    logger,
    now,
  );
  const weatherInputs = buildWeatherInputs({
    context,
    now,
    priorBalances: sharedOperations.waterBalances,
    timezone: location.timezone,
  });
  const snapshot = createWeatherSnapshot({
    context,
    now,
    plan,
    validationWarnings,
    weatherInputs,
  });
  const targets = createCropGroupTargets(
    plan,
    sharedOperations.wateringRecommendations,
  );
  const watering = calculateWateringRecommendations({
    applications: sharedOperations.waterApplications,
    checkTimeLocal: operationsSettings.defaultWateringCheckTime,
    forecastWeather: weatherInputs.forecastWeather,
    gardenId: plan.id,
    historicalWeather: weatherInputs.historicalWeather,
    nowIso: now.toISOString(),
    priorBalances: sharedOperations.waterBalances,
    targets,
    timezone: location.timezone,
  });
  const generatedTasks = buildAutomatedTasks(
    plan,
    watering.recommendations,
    snapshot,
    now,
  );

  return {
    generatedAtIso: now.toISOString(),
    providerId: context.currentConditions.providerId,
    recommendations: watering.recommendations,
    snapshot,
    tasks: mergeAutomatedTasks(sharedOperations.tasks, generatedTasks, now),
    waterBalances: watering.recommendations.map(
      (recommendation) => recommendation.balance,
    ),
  };
}

async function loadWeatherWateringContext(
  provider,
  location,
  logger,
  now = new Date(),
) {
  if (
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude)
  ) {
    return unavailableWeatherContext(now);
  }
  const failures = [];
  const guard = async (label, fallback, load) => {
    try {
      return await load();
    } catch (error) {
      failures.push(label);
      logger?.warn?.('Weather signal unavailable; using safe fallback.', {
        error: error instanceof Error ? error.message : String(error),
        label,
        providerId: provider.id,
      });
      return fallback;
    }
  };
  const nowIso = now.toISOString();
  const [
    currentConditions,
    forecast,
    alerts,
    recentPrecipitation,
    agriculture,
  ] = await Promise.all([
    guard('currentConditions', defaultCurrent(provider, nowIso), () =>
      provider.getCurrentConditions(location),
    ),
    guard('forecast', defaultForecast(provider, nowIso), () =>
      provider.getForecast(location),
    ),
    guard('weatherAlerts', [], () => provider.getWeatherAlerts(location)),
    guard('recentPrecipitation', defaultPrecip(provider, nowIso), () =>
      provider.getRecentPrecipitation(location, 72),
    ),
    guard('agricultureMetrics', defaultAgriculture(provider, nowIso), () =>
      provider.getOptionalAgricultureMetrics(location),
    ),
  ]);

  return {
    agricultureMetrics: agriculture,
    alerts,
    currentConditions,
    failures,
    forecast,
    forecastQuality: worstSignalQuality(
      weatherSignalQuality(
        forecast.generatedAtIso,
        failures.includes('forecast'),
        now,
        forecast.qualityHint,
      ),
      Number.isFinite(agriculture.evapotranspirationNext24hIn)
        ? weatherSignalQuality(
            agriculture.generatedAtIso,
            failures.includes('agricultureMetrics'),
            now,
            agriculture.qualityHint,
          )
        : 'fresh',
    ),
    historicalQuality: weatherSignalQuality(
      recentPrecipitation.generatedAtIso,
      failures.includes('recentPrecipitation') ||
        recentPrecipitation.available === false,
      now,
      recentPrecipitation.qualityHint,
    ),
    recentPrecipitation,
  };
}

function unavailableWeatherContext(now) {
  const nowIso = now.toISOString();
  const unavailableProvider = {
    id: 'unavailable',
    label: 'Weather unavailable',
  };
  return {
    agricultureMetrics: defaultAgriculture(unavailableProvider, nowIso),
    alerts: [],
    currentConditions: defaultCurrent(unavailableProvider, nowIso),
    failures: ['missingCoordinates'],
    forecast: defaultForecast(unavailableProvider, nowIso),
    forecastQuality: 'insufficient',
    historicalQuality: 'insufficient',
    recentPrecipitation: defaultPrecip(unavailableProvider, nowIso),
  };
}

function weatherSignalQuality(generatedAtIso, missing, now, qualityHint) {
  if (missing) return 'insufficient';
  if (qualityHint === 'stale') return 'stale';
  const generatedAtMs = Date.parse(generatedAtIso || '');
  if (!Number.isFinite(generatedAtMs)) return 'insufficient';
  if (now.getTime() - generatedAtMs > 6 * 60 * 60 * 1000) return 'stale';
  return qualityHint === 'cached' ? 'cached' : 'fresh';
}

function worstSignalQuality(...qualities) {
  const ranks = { cached: 1, fresh: 0, insufficient: 3, stale: 2 };
  return qualities.reduce((worst, quality) =>
    ranks[quality] > ranks[worst] ? quality : worst,
  );
}

function defaultCurrent(provider, nowIso) {
  return {
    capturedAtIso: nowIso,
    conditionSummary: 'Weather unavailable',
    humidityPercent: null,
    observationTimeIso: null,
    providerId: provider.id,
    sourceLabel: provider.label,
    temperatureF: null,
    windMph: null,
  };
}

function defaultForecast(provider, nowIso) {
  return {
    dailyHighF: null,
    days: [],
    generatedAtIso: nowIso,
    overnightLowF: null,
    providerId: provider.id,
  };
}

function defaultPrecip(provider, nowIso) {
  return {
    available: false,
    generatedAtIso: nowIso,
    last24hIn: null,
    last72hIn: null,
    observations: [],
    providerId: provider.id,
    totalIn: null,
  };
}

function defaultAgriculture(provider, nowIso) {
  return {
    evapotranspirationNext24hIn: null,
    generatedAtIso: nowIso,
    providerId: provider.id,
  };
}

module.exports = {
  buildWeatherInputs,
  createWeatherSnapshot,
  generateGardenOperations,
  loadWeatherWateringContext,
  weatherSignalQuality,
};
