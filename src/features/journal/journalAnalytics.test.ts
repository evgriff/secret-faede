import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type Garden,
} from '../../domain/gardens/GardenRepository';
import { buildJournalAnalytics } from './journalAnalytics';

describe('journalAnalytics', () => {
  it('summarizes harvests, issue backlog, active beds, and water alerts', () => {
    const analytics = buildJournalAnalytics(createAnalyticsGarden(), 2026);

    expect(analytics.harvestTotals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'lb', value: '2.5' }),
        expect.objectContaining({ label: 'count', value: '4' }),
      ]),
    );
    expect(analytics.yieldByCrop).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cropName: 'Tomato',
          total: '2.5 lb',
        }),
      ]),
    );
    expect(analytics.activeBeds[0]).toMatchObject({
      label: 'Main bed',
    });
    expect(analytics.issues).toEqual({
      highSeverity: 1,
      inProgress: 0,
      open: 1,
      resolved: 0,
      unresolved: 1,
    });
    expect(analytics.impact).toMatchObject({
      estimatedValueLabel: '$13',
      harvestedPlantings: 2,
      harvestEvents: 2,
      seedOrSeedlingCount: 2,
    });
    expect(analytics.yieldByBed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bedName: 'Main bed',
          total: expect.stringContaining('2.5 lb'),
        }),
      ]),
    );
    expect(analytics.performance.bestPerformers[0]).toMatchObject({
      label: 'Tomato',
    });
    expect(analytics.waterAlerts).toEqual({
      acknowledged: 1,
      acknowledgementRate: 100,
      sent: 1,
    });
  });
});

function createAnalyticsGarden(): Garden {
  return {
    ...createDefaultGarden('user-a'),
    harvestEvents: [
      {
        amountText: '2.5 lb',
        cropId: 'tomato',
        gardenId: 'user-a',
        harvestedOn: '2026-07-20',
        id: 'harvest-1',
        notes: '',
        plantingId: 'tomato-1',
        quantity: 2.5,
        unit: 'lb',
      },
      {
        amountText: '4 count',
        cropId: 'radish',
        gardenId: 'user-a',
        harvestedOn: '2026-05-20',
        id: 'harvest-2',
        notes: '',
        plantingId: 'radish-1',
        quantity: 4,
        unit: 'count',
      },
    ],
    journalEntries: [
      {
        body: 'Aphids on new growth.',
        createdAtIso: '2026-07-01T12:00:00.000Z',
        gardenId: 'user-a',
        id: 'journal-1',
        issueCategory: 'pest',
        issueSeverity: 'high',
        issueStatus: 'open',
        occurredOn: '2026-07-01',
        photos: [],
        plantingId: 'tomato-1',
        structureId: null,
        targetLabel: 'Tomato',
        targetType: 'planting',
        title: 'Aphids',
        type: 'issue',
        weatherSnapshotId: null,
      },
    ],
    notificationLogs: [
      {
        body: 'Water tomato.',
        channel: 'inApp',
        createdAtIso: '2026-07-01T12:00:00.000Z',
        dryRun: false,
        errorMessage: null,
        gardenId: 'user-a',
        id: 'log-1',
        messageSummary: 'Water tomato.',
        provider: 'inApp',
        recipientRedacted: 'in-app',
        sentAtIso: '2026-07-01T12:00:00.000Z',
        status: 'sent',
        taskId: null,
        type: 'watering',
        userId: 'user-a',
      },
    ],
    plantings: [
      {
        ...createDefaultPlanting({
          id: 'tomato-1',
          label: 'Tomato',
          xFt: 3,
          yFt: 3,
        }),
        cropId: 'tomato',
      },
      {
        ...createDefaultPlanting({
          id: 'radish-1',
          label: 'Radish',
          xFt: 4,
          yFt: 3,
        }),
        cropId: 'radish',
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
    tasks: [
      {
        bedLabel: 'Main bed',
        completedAtIso: '2026-07-01T12:00:00.000Z',
        createdAtIso: '2026-07-01T11:00:00.000Z',
        deferredUntilDate: null,
        dueDate: '2026-07-01',
        gardenId: 'user-a',
        id: 'water-task-1',
        notes: '',
        plantingId: 'tomato-1',
        priority: 'medium',
        snoozedUntilDate: null,
        source: 'wateringSchedule',
        sourceId: 'water-1',
        status: 'done',
        structureId: null,
        title: 'Water Tomato',
        type: 'water',
      },
    ],
    wateringSchedule: [
      {
        appliedAmountInches: 0.5,
        createdAtIso: '2026-07-01T11:00:00.000Z',
        deficitInches: 0.5,
        dueDate: '2026-07-01',
        dueWindowEndIso: null,
        dueWindowStartIso: '2026-07-01T11:00:00.000Z',
        gardenId: 'user-a',
        id: 'water-1',
        lastWateredAtIso: '2026-07-01T12:00:00.000Z',
        nextRecalculationAtIso: null,
        reasonDetails: [],
        reasonSummary: '',
        status: 'completed',
        targetId: 'tomato-1',
        targetAmountInches: 0.5,
        targetKind: 'planting',
        targetLabel: 'Tomato',
        updatedAtIso: '2026-07-01T12:00:00.000Z',
        urgency: 'medium',
        wateringZoneId: null,
        weatherSnapshotId: null,
      },
    ],
  };
}
