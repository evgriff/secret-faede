'use strict';

const now = new Date('2026-06-21T12:00:00.000Z');
const waterProfile = {
  baseWeeklyInches: 1.3,
  confidence: 'high',
  depletionFraction: 0.45,
  rootDepthInches: 24,
  source: 'curated',
  sourceVersion: 'extension-2026.1',
  stageCoefficients: {
    establishing: 1.2,
    flowering: 1.1,
    fruiting: 1.2,
    mature: 1,
  },
};
const plan = {
  createdAtIso: '2026-06-01T12:00:00.000Z',
  id: 'garden-main',
  name: 'Home garden',
  plantings: [
    planting({
      cropId: 'tomato',
      cropName: 'Tomato',
      id: 'tomato-group',
      lifecycle: 'harvestReady',
      waterProfile,
      xFt: 2,
    }),
    planting({
      cropId: 'lettuce',
      cropName: 'Lettuce',
      id: 'lettuce-group',
      lifecycle: 'growing',
      waterProfile: {
        ...waterProfile,
        baseWeeklyInches: 0.6,
        depletionFraction: 0.4,
        rootDepthInches: 8,
      },
      xFt: 4,
    }),
  ],
  plot: {
    climate: { firstFrost: '10-15', hardinessZone: '6b', lastFrost: '04-30' },
    depthFt: 12,
    location: {
      coordinates: { latitude: 42.3314, longitude: -83.0458 },
      label: 'Detroit, MI',
      query: 'Detroit, MI',
      timezone: 'America/Detroit',
    },
    northDegrees: 0,
    snapFt: 0.125,
    widthFt: 16,
  },
  reviewDecisions: [],
  schemaVersion: 9,
  setupCompleted: true,
  structures: [
    {
      depthFt: 4,
      drainage: 'moderate',
      id: 'bed-a',
      irrigationZoneId: 'zone-a',
      label: 'Bed A',
      locked: false,
      mulched: true,
      notes: '',
      rotationDegrees: 0,
      soilDepthInches: 12,
      soilType: 'loam',
      type: 'raisedBed',
      widthFt: 8,
      xFt: 0,
      yFt: 0,
    },
  ],
  updatedAtIso: now.toISOString(),
};

function planting(input) {
  return {
    arrangement: 'single',
    cropId: input.cropId,
    cropName: input.cropName,
    depthFt: 2,
    growingAreaStructureId: 'bed-a',
    id: input.id,
    instances: [
      { id: `${input.id}-1`, label: input.cropName, xFt: input.xFt, yFt: 2 },
    ],
    irrigationZoneId: 'zone-a',
    lifecycle: input.lifecycle,
    locked: false,
    mulched: false,
    notes: '',
    plantedOn: '2026-05-20',
    plannedFor: null,
    spacingInches: 12,
    sun: 'fullSun',
    waterProfile: input.waterProfile,
    wateringStage:
      input.lifecycle === 'planted'
        ? 'establishing'
        : input.lifecycle === 'harvestReady'
          ? 'fruiting'
          : 'mature',
    wateringStageSource: 'lifecycleFallback',
    widthFt: 2,
    xFt: input.xFt,
    yFt: 2,
  };
}

function balance(cropGroupId) {
  return {
    applicationLedger: [],
    asOfIso: '2026-06-19T12:00:00.000Z',
    calculationRevision: 1,
    cropGroupId,
    depletionInches: 0.4,
    modelVersion: 'crop-water-balance-v2',
    profileFingerprint: 'uninitialized',
  };
}

function provider({
  failPrecipitation = false,
  generatedAtIso = now.toISOString(),
  onRead = null,
} = {}) {
  let readCount = 0;
  return {
    get readCount() {
      return readCount;
    },
    id: 'nationalWeatherService',
    label: 'National Weather Service',
    getCurrentConditions: async () => {
      readCount += 1;
      await onRead?.();
      return {
        conditionSummary: 'Hot',
        humidityPercent: 55,
        observationTimeIso: now.toISOString(),
        providerId: 'nationalWeatherService',
        sourceLabel: 'National Weather Service',
        temperatureF: 92,
        windMph: 5,
      };
    },
    getForecast: async () => ({
      dailyHighF: 92,
      days: [
        {
          conditionSummary: 'Hot',
          date: '2026-06-21',
          expectedRainIn: 0,
          precipitationChancePercent: 0,
        },
      ],
      generatedAtIso,
      overnightLowF: 68,
      providerId: 'nationalWeatherService',
    }),
    getOptionalAgricultureMetrics: async () => ({
      evapotranspirationNext24hIn: 0.18,
      generatedAtIso,
      providerId: 'nationalWeatherService',
    }),
    getRecentPrecipitation: async () => {
      if (failPrecipitation) throw new Error('station unavailable');
      return {
        available: true,
        generatedAtIso,
        last24hIn: 0,
        last72hIn: 0,
        observations: [],
        providerId: 'nationalWeatherService',
        totalIn: 0,
      };
    },
    getWeatherAlerts: async () => [],
  };
}

function shared(overrides = {}) {
  return {
    tasks: [],
    waterApplications: [
      {
        appliedAtIso: '2026-06-19T12:00:00.000Z',
        cropGroupId: 'tomato-group',
        id: 'skip-a',
        method: 'hose',
        outcome: 'skipped',
        recordedAtIso: '2026-06-19T12:05:00.000Z',
        recordedByUserId: 'migration',
        revision: 1,
        skipReason: 'Rain expected',
      },
    ],
    waterBalances: [balance('tomato-group'), balance('lettuce-group')],
    wateringRecommendations: [],
    ...overrides,
  };
}

module.exports = { balance, now, plan, provider, shared };
