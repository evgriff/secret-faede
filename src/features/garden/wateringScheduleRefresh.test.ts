import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultUserProfile,
  createDefaultStructure,
  type Garden,
} from '../../domain/gardens/GardenRepository';
import { synchronizeGardenTasks } from '../tasks/taskEngine';
import {
  buildWateringSchedule,
  createWeatherSnapshot,
  type WeatherWateringContext,
} from './wateringEngine';
import { rebuildGardenWateringFromLatestSnapshot } from './wateringScheduleRefresh';

describe('wateringScheduleRefresh', () => {
  it('refreshes the watering schedule after a Plan planting change adds demand', () => {
    const now = new Date('2026-06-21T11:00:00.000Z');
    const garden = createGardenWithWeather();
    const context = createWeatherContext();
    const snapshot = createWeatherSnapshot(garden, context, now);
    const initialSchedule = buildWateringSchedule(
      garden,
      context,
      snapshot,
      now,
    );
    const gardenWithSchedule = {
      ...garden,
      wateringSchedule: initialSchedule,
      weatherSnapshots: [snapshot],
    };
    const expandedGarden = {
      ...gardenWithSchedule,
      plantings: [
        ...gardenWithSchedule.plantings,
        {
          ...createDefaultPlanting({
            id: 'basil-1',
            label: 'Basil',
            xFt: 4,
            yFt: 3,
          }),
          cropId: 'basil',
          status: 'growing' as const,
          weeklyWaterNeedInches: 0.8,
        },
      ],
      updatedAtIso: '2026-06-21T12:15:00.000Z',
    };
    const rebuiltGarden = rebuildGardenWateringFromLatestSnapshot(
      expandedGarden,
      {
        now: new Date('2026-06-21T12:15:00.000Z'),
      },
    );

    expect(rebuiltGarden.wateringSchedule).toHaveLength(1);
    expect(rebuiltGarden.wateringSchedule[0]?.targetAmountInches).not.toBe(
      initialSchedule[0]?.targetAmountInches,
    );
    expect(rebuiltGarden.wateringSchedule[0]?.reasonDetails).toContain(
      'This is rolled up for 2 active plantings in the same bed.',
    );
    expect(
      rebuiltGarden.tasks.find((task) => task.source === 'wateringSchedule'),
    ).toMatchObject({
      status: 'open',
      title: expect.stringContaining('Water main bed'),
    });
  });

  it('drops watering work when a crop is harvested and demand disappears', () => {
    const now = new Date('2026-06-21T11:00:00.000Z');
    const garden = createGardenWithWeather();
    const context = createWeatherContext();
    const snapshot = createWeatherSnapshot(garden, context, now);
    const wateringSchedule = buildWateringSchedule(
      garden,
      context,
      snapshot,
      now,
    );
    const gardenWithSchedule = synchronizeGardenTasks(
      {
        ...garden,
        updatedAtIso: now.toISOString(),
        wateringSchedule,
        weatherSnapshots: [snapshot],
      },
      {
        now,
        refreshOpenGenerated: true,
      },
    );
    const harvestedGarden = {
      ...gardenWithSchedule,
      plantings: gardenWithSchedule.plantings.map((planting) => ({
        ...planting,
        status: 'harvested' as const,
      })),
      updatedAtIso: new Date('2026-06-21T13:00:00.000Z').toISOString(),
    };
    const rebuiltGarden = rebuildGardenWateringFromLatestSnapshot(
      harvestedGarden,
      {
        now: new Date('2026-06-21T13:00:00.000Z'),
      },
    );

    expect(rebuiltGarden.wateringSchedule).toHaveLength(0);
    expect(
      rebuiltGarden.tasks.find((task) => task.source === 'wateringSchedule'),
    ).toMatchObject({
      status: 'skipped',
    });
  });

  it('reapplies the saved watering check time when settings change it', () => {
    const now = new Date('2026-06-21T11:00:00.000Z');
    const garden = createGardenWithWeather();
    const context = createWeatherContext();
    const snapshot = createWeatherSnapshot(garden, context, now);
    const wateringSchedule = buildWateringSchedule(
      garden,
      context,
      snapshot,
      now,
      {
        defaultWateringCheckTime: '07:00',
        timezone: 'America/Detroit',
      },
    );
    const gardenWithSchedule = {
      ...garden,
      wateringSchedule,
      weatherSnapshots: [snapshot],
    };
    const baseProfile = createDefaultUserProfile(
      'user-a',
      'user-a@example.com',
    );
    const updatedProfile = {
      ...baseProfile,
      notificationPreference: {
        ...baseProfile.notificationPreference,
        defaultWateringCheckTime: '09:30',
      },
      timezone: 'America/Detroit',
    };
    const rebuiltGarden = rebuildGardenWateringFromLatestSnapshot(
      gardenWithSchedule,
      {
        now,
        preserveDueWindowStart: false,
        profile: updatedProfile,
      },
    );

    expect(rebuiltGarden.wateringSchedule[0]).toMatchObject({
      dueWindowStartIso: '2026-06-21T13:30:00.000Z',
    });
  });
});

function createGardenWithWeather(overrides: Partial<Garden> = {}): Garden {
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
        weeklyWaterNeedInches: 1.1,
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
      },
    ],
    ...overrides,
  };
}

function createWeatherContext(): WeatherWateringContext {
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
      feelsLikeF: 85,
      humidityPercent: 55,
      observationTimeIso: '2026-06-21T10:50:00.000Z',
      precipitationLastHourIn: 0,
      providerId: 'nationalWeatherService',
      sourceLabel: 'National Weather Service',
      temperatureF: 85,
      windMph: 5,
    },
    forecast: {
      dailyHighF: 85,
      generatedAtIso: '2026-06-21T11:00:00.000Z',
      next24hPrecipIn: 0,
      next48hPrecipIn: 0,
      nextRainIso: null,
      overnightLowF: 64,
      periods: [],
      providerId: 'nationalWeatherService',
      summary: 'Sunny',
    },
    recentPrecipitation: {
      generatedAtIso: '2026-06-21T11:00:00.000Z',
      hours: 72,
      last24hIn: 0,
      last72hIn: 0,
      observations: [],
      providerId: 'nationalWeatherService',
      totalIn: 0,
    },
  };
}
