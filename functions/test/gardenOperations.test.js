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
      occurredOn: '2026-06-21',
      id: 'note-1',
      structureId: 'bed-a',
      targetLabel: 'Bed A',
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
    {
      id: 'radish-inside',
      label: 'Radish inside window',
      plannedFor: '2026-06-27',
      status: 'planned',
      xFt: 3,
      yFt: 2,
    },
    {
      id: 'radish-outside',
      label: 'Radish outside window',
      plannedFor: '2026-06-28',
      status: 'planned',
      xFt: 4,
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
  wateringSchedule: [],
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
      days: [
        {
          conditionSummary: 'Hot',
          date: '2026-06-21',
          expectedRainIn: 0,
          highF: 96,
          precipitationChancePercent: null,
        },
      ],
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
  assert.equal(result.recommendations[0].source, 'backend');
  assert.equal(result.recommendations[0].dataQuality, 'complete');
  assert.equal(result.recommendations[0].status, 'partial');
  assert.equal(result.recommendations[0].targetId, 'bed-a');
  assert.equal(result.recommendations[0].targetKind, 'bed');
  assert.equal(
    result.recommendations[0].waterBalance.rootZoneCapacitySource,
    'estimated',
  );
  assert.equal(
    result.recommendations[0].waterBalance.currentDepletionInches,
    result.recommendations[0].waterBalance.effectiveDeficitInches,
  );
  assert.ok(
    result.recommendations[0].waterBalance.actionableDeficitInches >= 0,
  );
  assert.match(result.recommendations[0].reasonDetails.join(' '), /Zone 1/);
  assert.ok(result.tasks.some((task) => task.type === 'water'));
  assert.ok(result.tasks.some((task) => task.id === 'weather-heat-2026-06-21'));
  assert.ok(
    result.tasks.some((task) => task.id === 'planting-radish-inside-plant'),
  );
  assert.ok(
    !result.tasks.some((task) => task.id === 'planting-radish-outside-plant'),
  );
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

  const scheduledResult = await generateGardenOperations({
    garden: {
      ...garden,
      journalEntries: [],
    },
    logger: { warn() {} },
    now: new Date('2026-06-21T11:00:00.000Z'),
    profile,
    weatherProvider,
  });

  assert.equal(scheduledResult.recommendations[0].status, 'scheduled');
  assert.equal(
    Date.parse(scheduledResult.recommendations[0].dueWindowStartIso),
    Date.parse('2026-06-21T11:30:00.000Z'),
  );
  assert.equal(
    scheduledResult.recommendations[0].waterBalance.modelVersion,
    'water-balance-v1',
  );

  const plantingDayResult = await generateGardenOperations({
    garden: {
      ...garden,
      journalEntries: [],
      plantings: [
        {
          ...garden.plantings[0],
          plantedOn: '2026-06-21',
          plantingEvents: [
            {
              id: 'planting-event:plantedOut:2026-06-21',
              occurredOn: '2026-06-21',
              type: 'plantedOut',
            },
          ],
          status: 'planted',
        },
      ],
    },
    logger: { warn() {} },
    now,
    profile,
    weatherProvider,
  });

  assert.equal(plantingDayResult.recommendations.length, 0);

  const snoozed = mergeWaterRecommendations(
    [{ ...scheduledResult.recommendations[0], status: 'snoozed' }],
    scheduledResult.recommendations,
    now,
  );

  assert.equal(snoozed[0].status, 'snoozed');
  console.log('gardenOperations tests passed');
})();
