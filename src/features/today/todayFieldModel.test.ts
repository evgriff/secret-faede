import {
  appendPlantingEvent,
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type WeatherSnapshot,
  type WateringScheduleEntry,
} from '../../domain/gardens/GardenRepository';
import { buildTodayFieldModel } from './todayFieldModel';

describe('todayFieldModel', () => {
  it('derives harvest timing from planting events instead of harvest tasks', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        appendPlantingEvent(
          {
            ...createDefaultPlanting({
              id: 'radish-1',
              label: 'Radish row',
              xFt: 2,
              yFt: 2,
            }),
            cropId: 'radish',
            status: 'growing' as const,
          },
          {
            occurredOn: '2026-05-24',
            type: 'directSowed',
          },
        ),
      ],
    };

    expect(
      buildTodayFieldModel(garden, [], '2026-06-21', '2026-06-21')
        .harvestSchedule,
    ).toEqual([
      expect.objectContaining({
        cropName: 'Radish',
        expectedHarvestDate: '2026-06-21',
        status: 'opening',
      }),
    ]);
  });

  it('hides watering snoozed until later tonight until the due window opens', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      wateringSchedule: [
        createWateringScheduleEntry({
          dueDate: '2026-06-21',
          dueWindowStartIso: '2026-06-21T18:00:00.000Z',
          status: 'snoozed',
          targetAmountInches: 0.35,
        }),
      ],
    };

    expect(
      buildTodayFieldModel(
        garden,
        [],
        '2026-06-21',
        '2026-06-21',
        new Date('2026-06-21T14:00:00.000Z'),
      ).wateringGroups,
    ).toEqual([]);
    expect(
      buildTodayFieldModel(
        garden,
        [],
        '2026-06-21',
        '2026-06-21',
        new Date('2026-06-21T19:00:00.000Z'),
      ).wateringGroups,
    ).toHaveLength(1);
  });

  it('groups multiple targets in the same watering zone into one watering run', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'tomato-1',
            label: 'Tomato',
            xFt: 2,
            yFt: 2,
          }),
          cropId: 'tomato',
          status: 'growing' as const,
        },
        {
          ...createDefaultPlanting({
            id: 'basil-1',
            label: 'Basil',
            xFt: 3,
            yFt: 2,
          }),
          cropId: 'basil',
          status: 'growing' as const,
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
          depthFt: 4,
          label: 'Main bed',
          widthFt: 6,
        },
      ],
      wateringSchedule: [
        createWateringScheduleEntry({
          id: 'water-1',
          targetId: 'bed-1',
          targetLabel: 'Main bed',
          wateringZoneId: 'zone-a',
        }),
        createWateringScheduleEntry({
          id: 'water-2',
          targetId: 'basil-1',
          targetKind: 'planting',
          targetLabel: 'Basil',
          wateringZoneId: 'zone-a',
        }),
      ],
    };

    expect(
      buildTodayFieldModel(garden, [], '2026-06-21', '2026-06-21')
        .wateringGroups,
    ).toEqual([
      expect.objectContaining({
        entryIds: ['water-1', 'water-2'],
        label: 'Main bed',
        memberLabels: ['Basil', 'Tomato'],
        targetCount: 2,
      }),
    ]);
  });

  it('shows the next watering window when nothing is due right now', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'basil-1',
            label: 'Basil',
            xFt: 3,
            yFt: 3,
          }),
          cropId: 'basil',
          status: 'growing' as const,
          weeklyWaterNeedInches: 0.9,
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
      weatherSnapshots: [createSnapshot()],
    };

    const model = buildTodayFieldModel(
      garden,
      [],
      '2026-06-21',
      '2026-06-21',
      new Date('2026-06-21T11:00:00.000Z'),
    );

    expect(model.wateringGroups).toEqual([]);
    expect(model.nextWateringRun).toMatchObject({
      bestDate: expect.any(String),
      headline: expect.stringContaining('Water Main bed'),
      label: 'Main bed',
    });
  });

  it('uses observed weather today and selected-day forecast weather for future dates', () => {
    const snapshot: WeatherSnapshot = {
      ...createSnapshot(),
      forecastDays: [
        {
          conditionSummary: 'Warm and dry',
          date: '2026-06-21',
          expectedRainIn: 0,
          highF: 88,
          precipitationChancePercent: 10,
        },
        {
          conditionSummary: 'Mostly Cloudy',
          date: '2026-06-22',
          expectedRainIn: 0.25,
          highF: 60,
          precipitationChancePercent: 3,
        },
      ],
    };
    const garden = {
      ...createDefaultGarden('user-a'),
      weatherSnapshots: [snapshot],
    };

    expect(
      buildTodayFieldModel(garden, [], '2026-06-21', '2026-06-21')
        .selectedWeather,
    ).toMatchObject({
      conditionSummary: 'Sunny and dry',
      displayDateLabel: 'Observed',
      mode: 'observed',
      recentPrecipitation72hIn: 0.1,
      temperatureF: 82,
    });
    expect(
      buildTodayFieldModel(garden, [], '2026-06-22', '2026-06-21')
        .selectedWeather,
    ).toMatchObject({
      conditionSummary: 'Mostly Cloudy',
      displayDateLabel: 'Forecast for',
      forecastRainIn: 0.25,
      mode: 'forecast',
      precipitationChancePercent: 3,
      temperatureF: 60,
    });
  });

  it('uses the selected day forecast when the saved observation is stale', () => {
    const snapshot: WeatherSnapshot = {
      ...createSnapshot(),
      forecastDays: [
        {
          conditionSummary: 'Mostly Cloudy',
          date: '2026-06-22',
          expectedRainIn: 0.08,
          highF: 66,
          precipitationChancePercent: 42,
          rainLikely: true,
          rainWindowStartIso: '2026-06-22T12:00:00.000Z',
        },
      ],
      nextRainIso: '2026-06-21T12:00:00.000Z',
      observedForDate: '2026-06-21',
    };
    const garden = {
      ...createDefaultGarden('user-a'),
      weatherSnapshots: [snapshot],
    };

    const selectedWeather = buildTodayFieldModel(
      garden,
      [],
      '2026-06-22',
      '2026-06-22',
    ).selectedWeather;

    expect(selectedWeather).toMatchObject({
      conditionSummary: 'Mostly Cloudy',
      displayDateLabel: 'Forecast for',
      forecastRainIn: 0.08,
      mode: 'forecast',
      nextRainIso: '2026-06-22T12:00:00.000Z',
      precipitationChancePercent: 42,
    });
  });

  it('does not carry an earlier global next-rain time into later selected days', () => {
    const snapshot: WeatherSnapshot = {
      ...createSnapshot(),
      forecastDays: [
        {
          conditionSummary: 'Mostly Sunny',
          date: '2026-06-24',
          expectedRainIn: 0,
          highF: 74,
          precipitationChancePercent: 13,
        },
      ],
      nextRainIso: '2026-06-21T12:00:00.000Z',
    };
    const garden = {
      ...createDefaultGarden('user-a'),
      weatherSnapshots: [snapshot],
    };

    expect(
      buildTodayFieldModel(garden, [], '2026-06-24', '2026-06-21')
        .selectedWeather,
    ).toMatchObject({
      conditionSummary: 'Mostly Sunny',
      nextRainIso: null,
    });
  });

  it('surfaces qualitative NWS rain signals without inventing rain inches', () => {
    const snapshot: WeatherSnapshot = {
      ...createSnapshot(),
      forecastDays: [
        {
          conditionSummary: 'Rain Showers Likely',
          date: '2026-06-23',
          expectedRainIn: 0,
          highF: 72,
          precipitationChancePercent: 78,
          rainAmountSource: 'none',
          rainLikely: true,
          rainSignalSource: 'probabilityOfPrecipitation',
          rainSummary: '78% rain chance; amount not published by NWS.',
          rainWindowEndIso: '2026-06-23T16:00:00.000Z',
          rainWindowStartIso: '2026-06-23T10:00:00.000Z',
        },
      ],
      nextRainIso: '2026-06-23T10:00:00.000Z',
    };
    const garden = {
      ...createDefaultGarden('user-a'),
      weatherSnapshots: [snapshot],
    };

    const model = buildTodayFieldModel(garden, [], '2026-06-23', '2026-06-21');

    expect(model.selectedWeather).toMatchObject({
      forecastRainIn: 0,
      rainLikely: true,
      rainSummary: '78% rain chance; amount not published by NWS.',
    });
    expect(model.weekRain).toEqual([
      expect.objectContaining({
        date: '2026-06-23',
        expectedRainIn: 0,
        rainSummary: '78% rain chance; amount not published by NWS.',
      }),
    ]);
  });

  it('keeps all visible forecast days in the week rain summary data', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      weatherSnapshots: [createSnapshot()],
    };

    const model = buildTodayFieldModel(garden, [], '2026-06-21', '2026-06-21');

    expect(model.weekRain).toHaveLength(7);
    expect(model.weekRain[0]).toMatchObject({
      date: '2026-06-21',
      rainLikely: false,
      rainSummary: 'No rain expected.',
    });
    expect(model.weekRain[3]).toMatchObject({
      date: '2026-06-24',
      expectedRainIn: 0.35,
      rainLikely: true,
    });
  });
});

function createWateringScheduleEntry(
  overrides: Partial<WateringScheduleEntry> = {},
): WateringScheduleEntry {
  return {
    appliedAmountInches: null,
    createdAtIso: '2026-06-21T11:00:00.000Z',
    deficitInches: 0.35,
    dueDate: '2026-06-21',
    dueWindowEndIso: null,
    dueWindowStartIso: '2026-06-21T11:00:00.000Z',
    gardenId: 'user-a',
    id: 'water-1',
    lastWateredAtIso: null,
    nextRecalculationAtIso: null,
    reasonDetails: ['Bed is below its weekly water target.'],
    reasonSummary: 'Bed is below its weekly water target.',
    status: 'due',
    targetId: 'bed-1',
    targetAmountInches: 0.35,
    targetKind: 'bed',
    targetLabel: 'Spring greens bed',
    updatedAtIso: '2026-06-21T11:00:00.000Z',
    urgency: 'medium',
    wateringZoneId: 'bed-1',
    weatherSnapshotId: 'weather-1',
    ...overrides,
  };
}

function createSnapshot(): WeatherSnapshot {
  return {
    alertSummaries: [],
    capturedAtIso: '2026-06-21T11:00:00.000Z',
    conditionSummary: 'Sunny and dry',
    evapotranspirationIn: 0.08,
    forecastDays: Array.from({ length: 14 }, (_, index) => ({
      conditionSummary: 'Sunny and dry',
      date: new Date(Date.UTC(2026, 5, 21 + index)).toISOString().slice(0, 10),
      expectedRainIn: index === 3 ? 0.35 : 0,
      highF: index < 2 ? 88 : 84,
    })),
    forecastRainNext24In: 0,
    forecastRainNext48In: 0,
    frostRisk: 'none',
    gardenId: 'user-a',
    heatRisk: 'watch',
    humidityPercent: 42,
    id: 'weather-1',
    nextRainIso: null,
    observedForDate: '2026-06-21',
    overnightLowF: 60,
    precipitationIn: 0,
    providerDecision: null,
    providerLabel: 'National Weather Service',
    recentPrecipitation72hIn: 0.1,
    source: 'nationalWeatherService',
    temperatureF: 82,
    windMph: 5,
  };
}
