'use strict';

const { buildAutomatedTasks, mergeTasks } = require('./taskAutomation');
const { getGardenLocation } = require('./operationTime');
const {
  buildWaterRecommendations,
  createWeatherSnapshot,
  mergeWaterRecommendations,
} = require('./wateringLogic');

async function generateGardenOperations({
  garden,
  logger,
  now = new Date(),
  profile,
  weatherProvider,
}) {
  const location = getGardenLocation(garden, profile);
  const context = await loadWeatherWateringContext(
    weatherProvider,
    location,
    logger,
  );
  const snapshot = createWeatherSnapshot(garden, context, now);
  const generatedRecommendations = buildWaterRecommendations(
    garden,
    context,
    snapshot,
    now,
  );
  const waterRecommendations = mergeWaterRecommendations(
    garden.waterRecommendations || [],
    generatedRecommendations,
    now,
  );
  const tasks = mergeTasks(
    garden.tasks || [],
    buildAutomatedTasks({ ...garden, waterRecommendations }, snapshot, now),
  );

  return {
    generatedAtIso: now.toISOString(),
    providerId: context.currentConditions.providerId,
    recommendations: generatedRecommendations,
    snapshot,
    tasks,
    waterRecommendations,
    weatherSnapshots: [...(garden.weatherSnapshots || []), snapshot].slice(-8),
  };
}

async function loadWeatherWateringContext(provider, location, logger) {
  const failures = [];
  const guard = async (label, fallback, load) => {
    try {
      return await load();
    } catch (error) {
      failures.push(label);
      logger?.warn?.('Weather signal unavailable; using fallback.', {
        error: error instanceof Error ? error.message : String(error),
        label,
        providerId: provider.id,
      });
      return fallback;
    }
  };
  const nowIso = new Date().toISOString();
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
    dataQuality:
      failures.length === 0
        ? 'complete'
        : failures.length <= 2
          ? 'partial'
          : 'limited',
    failedSignals: failures,
    forecast,
    recentPrecipitation,
  };
}

function defaultCurrent(provider, nowIso) {
  return {
    capturedAtIso: nowIso,
    conditionSummary: 'Weather unavailable',
    feelsLikeF: null,
    humidityPercent: null,
    observationTimeIso: null,
    precipitationLastHourIn: null,
    providerId: provider.id,
    sourceLabel: provider.label,
    temperatureF: null,
    windMph: null,
  };
}

function defaultForecast(provider, nowIso) {
  return {
    dailyHighF: null,
    generatedAtIso: nowIso,
    next24hPrecipIn: 0,
    next48hPrecipIn: 0,
    nextRainIso: null,
    overnightLowF: null,
    periods: [],
    providerId: provider.id,
    summary: 'Forecast unavailable',
  };
}

function defaultPrecip(provider, nowIso) {
  return {
    generatedAtIso: nowIso,
    hours: 72,
    last24hIn: 0,
    last72hIn: 0,
    observations: [],
    providerId: provider.id,
    totalIn: 0,
  };
}

function defaultAgriculture(provider, nowIso) {
  return {
    evapotranspirationIn: null,
    evapotranspirationNext24hIn: null,
    generatedAtIso: nowIso,
    notes: ['Agriculture metrics unavailable.'],
    providerId: provider.id,
  };
}

module.exports = {
  generateGardenOperations,
  loadWeatherWateringContext,
};
