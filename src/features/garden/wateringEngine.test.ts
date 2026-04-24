import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type Garden,
} from '../../domain/gardens/GardenRepository';
import type { WeatherWateringContext } from './wateringEngine';
import {
  buildWateringSchedule,
  createWeatherSnapshot,
  mergeWateringSchedule,
} from './wateringEngine';

describe('wateringEngine', () => {
  it('rolls plantings in the same bed into one watering target', () => {
    const garden = createWateringGarden();
    const context = createWeatherContext({
      dailyHighF: 91,
      next24hPrecipIn: 0,
      recentRainIn: 0.1,
    });
    const now = new Date('2026-06-21T11:00:00.000Z');
    const snapshot = createWeatherSnapshot(garden, context, now);
    const recommendations = buildWateringSchedule(
      garden,
      context,
      snapshot,
      now,
    );

    expect(snapshot.heatRisk).toBe('watch');
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0]).toMatchObject({
      status: 'due',
      targetId: 'bed-1',
      targetKind: 'bed',
      targetLabel: 'Main bed',
      urgency: expect.stringMatching(/low|medium|high/),
    });
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
    const recommendations = buildWateringSchedule(
      garden,
      context,
      snapshot,
      now,
    );

    expect(recommendations[0]).toMatchObject({
      nextRecalculationAtIso: '2026-06-21T18:00:00.000Z',
      status: 'suppressed',
      targetAmountInches: 0,
    });
  });

  it('tracks partial watering from recent manual logs and leaves only the remainder due', () => {
    const garden = createWateringGarden({
      journalEntries: [
        {
          body: 'Watered Main bed 0.25 inches',
          createdAtIso: '2026-06-21T09:00:00.000Z',
          gardenId: 'user-a',
          id: 'note-1',
          issueCategory: null,
          issueSeverity: null,
          issueStatus: null,
          occurredOn: '2026-06-21',
          photos: [],
          plantingId: null,
          structureId: 'bed-1',
          targetLabel: 'Main bed',
          targetType: 'structure',
          title: 'Watered Main bed',
          type: 'note',
          weatherSnapshotId: null,
        },
      ],
    });
    const context = createWeatherContext({
      dailyHighF: 88,
      next24hPrecipIn: 0,
      recentRainIn: 0,
    });
    const now = new Date('2026-06-21T11:00:00.000Z');
    const snapshot = createWeatherSnapshot(garden, context, now);
    const recommendations = buildWateringSchedule(
      garden,
      context,
      snapshot,
      now,
    );

    expect(recommendations[0]).toMatchObject({
      appliedAmountInches: 0.25,
      lastWateredAtIso: '2026-06-21T09:00:00.000Z',
      status: 'partial',
      targetId: 'bed-1',
      targetKind: 'bed',
    });
    expect(recommendations[0]?.targetAmountInches ?? 0).toBeGreaterThan(0);
  });

  it('reactivates a suppressed target when the rain forecast drops out', () => {
    const garden = createWateringGarden();
    const now = new Date('2026-06-21T11:00:00.000Z');
    const suppressedContext = createWeatherContext({
      dailyHighF: 82,
      next24hPrecipIn: 1,
      nextRainIso: '2026-06-21T18:00:00.000Z',
      recentRainIn: 0,
    });
    const dueContext = createWeatherContext({
      dailyHighF: 82,
      next24hPrecipIn: 0,
      recentRainIn: 0,
    });
    const suppressed = buildWateringSchedule(
      garden,
      suppressedContext,
      createWeatherSnapshot(garden, suppressedContext, now),
      now,
    );
    const refreshed = buildWateringSchedule(
      garden,
      dueContext,
      createWeatherSnapshot(garden, dueContext, now),
      new Date('2026-06-21T12:30:00.000Z'),
    );
    const merged = mergeWateringSchedule(suppressed, refreshed);

    expect(merged[0]).toMatchObject({
      dueWindowStartIso: '2026-06-21T11:00:00.000Z',
      status: 'due',
      targetAmountInches: expect.any(Number),
    });
  });

  it('holds watering until the saved watering check time', () => {
    const garden = createWateringGarden();
    const context = createWeatherContext({
      dailyHighF: 88,
      next24hPrecipIn: 0,
      recentRainIn: 0,
    });
    const now = new Date('2026-06-21T10:30:00.000Z');
    const snapshot = createWeatherSnapshot(garden, context, now);
    const recommendations = buildWateringSchedule(
      garden,
      context,
      snapshot,
      now,
      {
        defaultWateringCheckTime: '08:00',
        timezone: 'America/Detroit',
      },
    );

    expect(recommendations[0]).toMatchObject({
      dueWindowStartIso: '2026-06-21T12:00:00.000Z',
      status: 'scheduled',
      targetAmountInches: expect.any(Number),
    });
  });
});

function createWateringGarden(overrides: Partial<Garden> = {}): Garden {
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
        status: 'growing',
        weeklyWaterNeedInches: 1.3,
      },
      {
        ...createDefaultPlanting({
          id: 'basil-1',
          label: 'Basil',
          xFt: 5,
          yFt: 3,
        }),
        cropId: 'basil',
        status: 'growing',
        weeklyWaterNeedInches: 0.8,
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
        label: 'Main bed',
        mulched: true,
      },
    ],
    ...overrides,
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
