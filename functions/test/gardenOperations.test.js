'use strict';

const assert = require('node:assert/strict');
const { generateGardenOperations } = require('../gardenOperations');
const { isUserDueForWateringCheck } = require('../operationTime');
const { mergeWaterRecommendations } = require('../wateringLogic');

const profile = {
  notificationPreference: {
    defaultWateringCheckTime: '07:30',
    timezone: 'America/Detroit',
  },
  timezone: 'America/Detroit',
};

assert.equal(
  isUserDueForWateringCheck(profile, new Date('2026-06-21T11:45:00.000Z')),
  true,
);
assert.equal(
  isUserDueForWateringCheck(profile, new Date('2026-06-21T14:00:00.000Z')),
  false,
);

const now = new Date('2026-06-21T12:00:00.000Z');
const garden = {
  id: 'user-a',
  journalEntries: [
    {
      body: 'Watered Bed A 0.25 inches',
      createdAtIso: '2026-06-21T10:00:00.000Z',
      id: 'note-1',
      title: 'Water done',
    },
  ],
  plantings: [
    {
      id: 'tomato-1',
      label: 'Tomato',
      plantedOn: '2026-06-01',
      status: 'harvest-ready',
      weeklyWaterNeedInches: 1.3,
      xFt: 2,
      yFt: 2,
    },
  ],
  plot: {
    location: {
      latitude: 42.3314,
      locationName: 'Detroit, MI',
      longitude: -83.0458,
      timezone: 'America/Detroit',
    },
  },
  structures: [
    {
      depthFt: 4,
      drainageProfile: 'fast',
      id: 'bed-a',
      irrigationZone: 'Zone 1',
      label: 'Bed A',
      mulched: true,
      soilType: 'sandy',
      type: 'raisedBed',
      widthFt: 8,
      xFt: 0,
      yFt: 0,
    },
  ],
  tasks: [],
  userId: 'user-a',
  waterRecommendations: [],
  weatherSnapshots: [],
};

const weatherProvider = {
  id: 'nationalWeatherService',
  label: 'National Weather Service',
  getCurrentConditions: () =>
    Promise.resolve({
      capturedAtIso: now.toISOString(),
      conditionSummary: 'Hot',
      feelsLikeF: 98,
      humidityPercent: 55,
      observationTimeIso: now.toISOString(),
      precipitationLastHourIn: 0,
      providerId: 'nationalWeatherService',
      sourceLabel: 'National Weather Service',
      temperatureF: 96,
      windMph: 5,
    }),
  getForecast: () =>
    Promise.resolve({
      dailyHighF: 96,
      generatedAtIso: now.toISOString(),
      next24hPrecipIn: 0,
      next48hPrecipIn: 0,
      nextRainIso: null,
      overnightLowF: 70,
      periods: [{ startIso: now.toISOString(), temperatureF: 96 }],
      providerId: 'nationalWeatherService',
      summary: 'Hot',
    }),
  getOptionalAgricultureMetrics: () =>
    Promise.resolve({
      evapotranspirationIn: 0.18,
      evapotranspirationNext24hIn: 0.18,
      generatedAtIso: now.toISOString(),
      notes: [],
      providerId: 'nationalWeatherService',
    }),
  getRecentPrecipitation: () =>
    Promise.resolve({
      generatedAtIso: now.toISOString(),
      hours: 72,
      last24hIn: 0,
      last72hIn: 0,
      observations: [],
      providerId: 'nationalWeatherService',
      totalIn: 0,
    }),
  getWeatherAlerts: () => Promise.resolve([]),
};

(async () => {
  const result = await generateGardenOperations({
    garden,
    logger: { warn() {} },
    now,
    profile,
    weatherProvider,
  });

  assert.equal(result.snapshot.heatRisk, 'warning');
  assert.equal(result.recommendations[0].generatedBy, 'backend');
  assert.equal(result.recommendations[0].dataQuality, 'complete');
  assert.match(result.recommendations[0].rationale.join(' '), /Zone 1/);
  assert.ok(result.tasks.some((task) => task.type === 'water'));
  assert.ok(result.tasks.some((task) => task.id === 'weather-heat-2026-06-21'));
  assert.ok(
    result.tasks.some((task) =>
      task.id.startsWith('succession-review-tomato-1'),
    ),
  );

  const preserved = mergeWaterRecommendations(
    [{ ...result.recommendations[0], status: 'completed' }],
    result.recommendations,
    now,
  );

  assert.equal(preserved[0].status, 'completed');
  console.log('gardenOperations tests passed');
})();
