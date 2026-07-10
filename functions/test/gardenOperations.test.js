'use strict';

const assert = require('node:assert/strict');
const {
  buildWeatherInputs,
  generateGardenOperations,
  weatherSignalQuality,
} = require('../gardenOperations');
const { resolveLocalDateTimeIso } = require('../operationTime');
const {
  calculateWateringRecommendations,
  createCropGroupTargets,
} = require('../wateringModelV2');
const { balance, now, plan, provider, shared } = require('./v2Fixtures');

(async () => {
  const targets = createCropGroupTargets(plan, []);
  assert.deepEqual(
    targets.map((target) => target.planting.id),
    ['tomato-group', 'lettuce-group'],
  );
  assert.equal(targets[0].stage, 'fruiting');
  assert.equal(targets[0].stageSource, 'lifecycleFallback');

  const result = await generateGardenOperations({
    logger: { warn() {} },
    now,
    operationsSettings: { defaultWateringCheckTime: '07:00' },
    plan,
    sharedOperations: shared(),
    weatherProvider: provider(),
  });
  const tomato = result.recommendations.find(
    (item) => item.target.cropGroupId === 'tomato-group',
  );
  const lettuce = result.recommendations.find(
    (item) => item.target.cropGroupId === 'lettuce-group',
  );

  assert.equal(result.snapshot.quality.historical, 'fresh');
  assert.equal(result.snapshot.quality.forecast, 'fresh');
  assert.equal(tomato.modelVersion, 'crop-water-balance-v2');
  assert.equal(tomato.target.kind, 'cropGroup');
  assert.equal(tomato.target.cropGroupLabel, 'Tomato in Bed A');
  assert.deepEqual(tomato.target.plantingIds, ['tomato-group']);
  assert.equal(
    tomato.target.deepLink,
    '/app/today?focus=watering&cropGroupId=tomato-group',
  );
  assert.equal(tomato.basis.cropProfile.stage, 'fruiting');
  assert.equal(tomato.basis.cropProfile.stageSource, 'lifecycleFallback');
  assert.ok(
    tomato.balance.depletionInches > lettuce.balance.depletionInches,
    'crop groups retain their own profile and root-zone balance',
  );
  assert.notEqual(
    tomato.recommendedDepthInches,
    lettuce.recommendedDepthInches,
    'each crop group receives its own watering amount',
  );
  assert.ok(tomato.reasonCodes.includes('SKIPPED_APPLICATION_ZERO_CREDIT'));
  assert.equal(
    tomato.balance.applicationLedger.find(
      (entry) => entry.applicationId === 'skip-a',
    ).creditedDepthInches,
    0,
    'skipped watering receives exactly zero credit',
  );
  assert.ok(result.tasks.every((task) => task.dueOn && task.target));
  assert.equal(
    result.tasks.find((task) => task.sourceId === tomato.id).target.label,
    'Tomato in Bed A',
  );

  const repeated = await generateGardenOperations({
    logger: { warn() {} },
    now,
    operationsSettings: { defaultWateringCheckTime: '07:00' },
    plan,
    sharedOperations: shared(),
    weatherProvider: provider(),
  });
  assert.deepEqual(
    repeated.recommendations,
    result.recommendations,
    'identical plan, ledger, weather, and clock inputs are deterministic',
  );

  const withPartialWater = await generateGardenOperations({
    logger: { warn() {} },
    now,
    operationsSettings: { defaultWateringCheckTime: '07:00' },
    plan,
    sharedOperations: shared({
      waterApplications: [
        {
          amount: { depthInches: 0.25, unit: 'inches' },
          appliedAtIso: '2026-06-20T12:00:00.000Z',
          cropGroupId: 'tomato-group',
          efficiency: {
            confidence: 'high',
            fraction: 1,
            source: 'calibrated',
          },
          id: 'partial-water',
          method: 'drip',
          outcome: 'partial',
          recordedAtIso: '2026-06-20T12:05:00.000Z',
          recordedByUserId: 'user-a',
          revision: 1,
        },
      ],
    }),
    weatherProvider: provider(),
  });
  assert.deepEqual(
    withPartialWater.recommendations
      .find((item) => item.target.cropGroupId === 'tomato-group')
      .balance.applicationLedger.find(
        (entry) => entry.applicationId === 'partial-water',
      ),
    {
      applicationId: 'partial-water',
      creditedDepthInches: 0.25,
      outcome: 'partial',
      revision: 1,
    },
    'partial watering retains its outcome and receives measured credit',
  );

  const missing = await generateGardenOperations({
    logger: { warn() {} },
    now,
    operationsSettings: { defaultWateringCheckTime: '07:00' },
    plan,
    sharedOperations: shared(),
    weatherProvider: provider({ failPrecipitation: true }),
  });
  assert.equal(missing.snapshot.quality.historical, 'insufficient');
  assert.ok(
    missing.recommendations.every(
      (recommendation) =>
        recommendation.status === 'checkSoil' &&
        recommendation.recommendedDepthInches === null,
    ),
  );

  assert.equal(
    weatherSignalQuality('2026-06-20T00:00:00.000Z', false, now),
    'stale',
  );
  assert.equal(
    weatherSignalQuality(now.toISOString(), false, now, 'cached'),
    'cached',
  );
  assert.equal(
    weatherSignalQuality(now.toISOString(), false, now, 'stale'),
    'stale',
  );

  const timestampedBalances = [
    {
      ...balance('tomato-group'),
      asOfIso: '2026-06-21T11:00:00.000Z',
    },
    {
      ...balance('lettuce-group'),
      asOfIso: '2026-06-21T08:00:00.000Z',
    },
  ];
  const timestampedWeather = buildWeatherInputs({
    context: weatherContext({
      observations: [
        {
          observedAtIso: '2026-06-21T10:00:00.000Z',
          precipitationIn: 0.4,
        },
      ],
    }),
    now,
    priorBalances: timestampedBalances,
    timezone: 'America/Detroit',
  });
  const timestampedResult = calculateWateringRecommendations({
    applications: [],
    checkTimeLocal: '07:00',
    forecastWeather: timestampedWeather.forecastWeather,
    gardenId: plan.id,
    historicalWeather: timestampedWeather.historicalWeather,
    nowIso: now.toISOString(),
    priorBalances: timestampedBalances,
    targets,
    timezone: 'America/Detroit',
  });
  assert.equal(
    timestampedResult.recommendations
      .find((item) => item.target.cropGroupId === 'tomato-group')
      .reasonCodes.includes('OBSERVED_RAIN_CREDITED'),
    false,
    'rain before a crop-group balance boundary is not credited again',
  );
  assert.equal(
    timestampedResult.recommendations
      .find((item) => item.target.cropGroupId === 'lettuce-group')
      .reasonCodes.includes('OBSERVED_RAIN_CREDITED'),
    true,
    'rain inside an earlier crop-group balance window is credited',
  );

  const midday = new Date('2026-06-21T16:00:00.000Z');
  const forecastInputs = buildWeatherInputs({
    context: weatherContext({
      days: [
        {
          date: '2026-06-21',
          expectedRainIn: 0.4,
          precipitationChancePercent: 75,
        },
        {
          date: '2026-06-22',
          expectedRainIn: 0.2,
          precipitationChancePercent: 50,
        },
      ],
      evapotranspirationNext24hIn: 0.24,
    }),
    now: midday,
    priorBalances: [],
    timezone: 'America/Detroit',
  }).forecastWeather.periods;
  assert.equal(forecastInputs[0].startIso, midday.toISOString());
  assert.equal(
    forecastInputs[0].expectedRainInches,
    0.4,
    'provider future-only daily rain is not scaled a second time at midday',
  );
  assert.ok(
    Math.abs(
      forecastInputs.reduce(
        (total, period) => total + (period.referenceEtInches || 0),
        0,
      ) - 0.24,
    ) < 1e-9,
    'next-24-hour ET is distributed once across local forecast days',
  );

  assert.equal(
    resolveLocalDateTimeIso('2026-11-01', '01:30', 'America/Detroit'),
    '2026-11-01T06:30:00.000Z',
    'the Functions runtime resolves an ambiguous local time to the later instant',
  );

  console.log('gardenOperations tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

function weatherContext({
  days = [
    {
      date: '2026-06-21',
      expectedRainIn: 0,
      precipitationChancePercent: 0,
    },
  ],
  evapotranspirationNext24hIn = 0,
  observations = [],
} = {}) {
  return {
    agricultureMetrics: {
      evapotranspirationNext24hIn,
      generatedAtIso: now.toISOString(),
      providerId: 'test-weather',
    },
    forecast: {
      days,
      generatedAtIso: now.toISOString(),
      providerId: 'test-weather',
    },
    forecastQuality: 'fresh',
    historicalQuality: 'fresh',
    recentPrecipitation: {
      available: true,
      generatedAtIso: now.toISOString(),
      observations,
      providerId: 'test-weather',
    },
  };
}
