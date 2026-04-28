import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type Garden,
  type WeatherSnapshot,
} from '../../domain/gardens/GardenRepository';
import { buildWateringOutlook } from './wateringOutlook';

describe('wateringOutlook', () => {
  it('projects grouped watering as one human watering window', () => {
    const garden: Garden = {
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
          status: 'growing',
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

    const outlook = buildWateringOutlook(
      garden,
      garden.weatherSnapshots[0] ?? null,
      new Date('2026-06-21T11:00:00.000Z'),
    );

    expect(outlook[0]).toMatchObject({
      bestDate: expect.any(String),
      headline: expect.stringContaining('Water Main bed'),
      label: 'Main bed',
      memberLabels: ['Basil'],
    });
    expect(outlook[0]?.amountInches ?? 0).toBeGreaterThanOrEqual(0.5);
  });

  it('collapses consecutive projected dates for the same target into a range', () => {
    const garden: Garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'melon-1',
            label: 'Muskmelon',
            xFt: 3,
            yFt: 3,
          }),
          cropId: 'muskmelon',
          status: 'growing',
          weeklyWaterNeedInches: 2.2,
        },
      ],
      weatherSnapshots: [createDrySnapshot()],
    };

    const outlook = buildWateringOutlook(
      garden,
      garden.weatherSnapshots[0] ?? null,
      new Date('2026-06-21T11:00:00.000Z'),
    );

    const firstWindow = outlook[0];

    expect(firstWindow).toMatchObject({
      kind: 'dateRange',
      label: 'Muskmelon',
      startDate: '2026-06-22',
    });
    expect(firstWindow && firstWindow.endDate > firstWindow.startDate).toBe(
      true,
    );
    expect(firstWindow?.headline).toMatch(/^Water Muskmelon /);
  });
});

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

function createDrySnapshot(): WeatherSnapshot {
  return {
    ...createSnapshot(),
    forecastDays: Array.from({ length: 14 }, (_, index) => ({
      conditionSummary: 'Sunny and dry',
      date: new Date(Date.UTC(2026, 5, 21 + index)).toISOString().slice(0, 10),
      expectedRainIn: 0,
      highF: 96,
    })),
    recentPrecipitation72hIn: 0,
    temperatureF: 96,
  };
}
