import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type Garden,
} from '../../domain/gardens/GardenRepository';
import type { WeatherWateringContext } from './wateringEngine';
import {
  buildWaterRecommendations,
  createWeatherSnapshot,
} from './wateringEngine';

describe('wateringEngine', () => {
  it('creates planting recommendations from crop water needs and dry weather', () => {
    const garden = createWateringGarden();
    const context = createWeatherContext({
      dailyHighF: 91,
      next24hPrecipIn: 0,
      recentRainIn: 0.1,
    });
    const now = new Date('2026-06-21T11:00:00.000Z');
    const snapshot = createWeatherSnapshot(garden, context, now);
    const recommendations = buildWaterRecommendations(
      garden,
      context,
      snapshot,
      now,
    );

    expect(snapshot.heatRisk).toBe('watch');
    expect(recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recommendedWaterInches: expect.any(Number),
          status: 'active',
          targetId: 'tomato-1',
          targetType: 'planting',
          urgency: expect.stringMatching(/low|medium|high/),
        }),
      ]),
    );
  });

  it('suppresses watering when forecast rain covers the deficit', () => {
    const garden = createWateringGarden();
    const context = createWeatherContext({
      dailyHighF: 82,
      next24hPrecipIn: 1,
      nextRainIso: '2026-06-21T18:00:00.000Z',
      recentRainIn: 0,
    });
    const now = new Date('2026-06-21T11:00:00.000Z');
    const snapshot = createWeatherSnapshot(garden, context, now);
    const recommendations = buildWaterRecommendations(
      garden,
      context,
      snapshot,
      now,
    );

    expect(recommendations[0]).toMatchObject({
      recommendedWaterInches: 0,
      status: 'suppressed',
      suppressUntilIso: '2026-06-21T18:00:00.000Z',
    });
  });
});

function createWateringGarden(): Garden {
  return {
    ...createDefaultGarden('user-a'),
    plantings: [
      {
        ...createDefaultPlanting({
          id: 'tomato-1',
          label: 'Tomato',
          xFt: 3,
          yFt: 3,
        }),
        cropId: 'tomato',
        weeklyWaterNeedInches: 1.3,
      },
    ],
    structures: [
      {
        ...createDefaultStructure({
          id: 'bed-1',
          type: 'raisedBed',
          xFt: 1,
          yFt: 1,
        }),
        mulched: true,
      },
    ],
  };
}

function createWeatherContext({
  dailyHighF,
  next24hPrecipIn,
  nextRainIso = null,
  recentRainIn,
}: {
  dailyHighF: number;
  next24hPrecipIn: number;
  nextRainIso?: string | null;
  recentRainIn: number;
}): WeatherWateringContext {
  return {
    agricultureMetrics: {
      evapotranspirationIn: null,
      evapotranspirationNext24hIn: null,
      generatedAtIso: '2026-06-21T11:00:00.000Z',
      notes: [],
      providerId: 'nationalWeatherService',
    },
    alerts: [],
    currentConditions: {
      capturedAtIso: '2026-06-21T11:00:00.000Z',
      conditionSummary: 'Sunny',
      feelsLikeF: dailyHighF,
      humidityPercent: 55,
      observationTimeIso: '2026-06-21T10:50:00.000Z',
      precipitationLastHourIn: 0,
      providerId: 'nationalWeatherService',
      sourceLabel: 'National Weather Service',
      temperatureF: dailyHighF,
      windMph: 5,
    },
    forecast: {
      dailyHighF,
      generatedAtIso: '2026-06-21T11:00:00.000Z',
      next24hPrecipIn,
      next48hPrecipIn: next24hPrecipIn,
      nextRainIso,
      overnightLowF: 66,
      periods: [],
      providerId: 'nationalWeatherService',
      summary: 'Sunny',
    },
    recentPrecipitation: {
      generatedAtIso: '2026-06-21T11:00:00.000Z',
      hours: 72,
      last24hIn: recentRainIn,
      last72hIn: recentRainIn,
      observations: [],
      providerId: 'nationalWeatherService',
      totalIn: recentRainIn,
    },
  };
}
