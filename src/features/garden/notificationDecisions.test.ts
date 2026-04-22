import {
  createDefaultGarden,
  type Garden,
  type WaterRecommendation,
  type WeatherSnapshot,
} from '../../domain/gardens/GardenRepository';
import { buildInAppNotificationLogs } from './notificationDecisions';

describe('notificationDecisions', () => {
  it('creates watering and weather in-app logs with duplicate suppression', () => {
    const garden = createDefaultGarden('user-a');
    const snapshot = createWeatherSnapshot();
    const recommendation = createWaterRecommendation();
    const now = new Date('2026-06-21T11:00:00.000Z');

    const logs = buildInAppNotificationLogs(
      garden,
      [recommendation],
      snapshot,
      now,
    );

    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: 'Water Tomatoes in Bed A 0.62 in today. Rain is unlikely today.',
          channel: 'inApp',
          messageSummary: 'Water Tomatoes in Bed A today',
          status: 'sent',
          taskId: null,
          type: 'watering',
        }),
        expect.objectContaining({
          type: 'heatStress',
        }),
      ]),
    );

    expect(
      buildInAppNotificationLogs(
        {
          ...garden,
          notificationLogs: logs,
        },
        [recommendation],
        snapshot,
        now,
      ),
    ).toHaveLength(0);
  });

  it('suppresses watering alerts after same-day watering is logged', () => {
    const garden: Garden = {
      ...createDefaultGarden('user-a'),
      journalEntries: [
        {
          body: 'Watered Tomatoes in Bed A with 0.6 inches.',
          createdAtIso: '2026-06-21T10:30:00.000Z',
          gardenId: 'user-a',
          id: 'journal-1',
          issueCategory: null,
          issueSeverity: null,
          issueStatus: null,
          occurredOn: '2026-06-21',
          photos: [],
          plantingId: 'tomato-1',
          structureId: null,
          targetLabel: 'Tomatoes in Bed A',
          targetType: 'planting',
          title: 'Watered Tomatoes in Bed A',
          type: 'note',
          weatherSnapshotId: null,
        },
      ],
    };

    expect(
      buildInAppNotificationLogs(
        garden,
        [createWaterRecommendation()],
        createWeatherSnapshot(),
        new Date('2026-06-21T11:00:00.000Z'),
      ).filter((log) => log.type === 'watering'),
    ).toHaveLength(0);
  });

  it('respects snoozed notification history for repeat alerts', () => {
    const garden = createDefaultGarden('user-a');
    const recommendation = createWaterRecommendation();
    const firstLogs = buildInAppNotificationLogs(
      garden,
      [recommendation],
      createWeatherSnapshot(),
      new Date('2026-06-21T11:00:00.000Z'),
    );
    const wateringLog = firstLogs.find((log) => log.type === 'watering');

    expect(wateringLog).toBeDefined();
    expect(
      buildInAppNotificationLogs(
        {
          ...garden,
          notificationLogs: [
            {
              ...wateringLog!,
              createdAtIso: '2026-06-20T08:00:00.000Z',
              snoozedUntilIso: '2026-06-22T08:00:00.000Z',
            },
          ],
        },
        [recommendation],
        createWeatherSnapshot(),
        new Date('2026-06-21T12:00:00.000Z'),
      ).filter((log) => log.type === 'watering'),
    ).toHaveLength(0);
  });
});

function createWeatherSnapshot(): WeatherSnapshot {
  return {
    alertSummaries: [],
    capturedAtIso: '2026-06-21T11:00:00.000Z',
    conditionSummary: 'Sunny',
    evapotranspirationIn: null,
    forecastRainNext24In: 0,
    forecastRainNext48In: 0,
    frostRisk: 'none',
    gardenId: 'user-a',
    heatRisk: 'watch',
    humidityPercent: null,
    id: 'weather-1',
    nextRainIso: null,
    observedForDate: '2026-06-21',
    overnightLowF: 70,
    precipitationIn: 0,
    recentPrecipitation72hIn: 0,
    source: 'nationalWeatherService',
    temperatureF: 92,
    windMph: null,
  };
}

function createWaterRecommendation(): WaterRecommendation {
  return {
    deficitInches: 0.62,
    generatedAtIso: '2026-06-21T11:00:00.000Z',
    gardenId: 'user-a',
    id: 'water-1',
    inchesNeeded: 0.62,
    plantingId: 'tomato-1',
    rationale: ['Dry forecast.'],
    reason: 'Watering recommended',
    recommendationDate: '2026-06-21',
    recommendedWaterInches: 0.62,
    status: 'active',
    suppressUntilIso: null,
    targetId: 'tomato-1',
    targetLabel: 'Tomatoes in Bed A',
    targetType: 'planting',
    urgency: 'medium',
    weatherSnapshotId: 'weather-1',
  };
}
