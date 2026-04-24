import {
  createDefaultGarden,
  createDefaultPlanting,
  type WateringScheduleEntry,
  type Task,
} from '../../domain/gardens/GardenRepository';
import { buildTodayFieldModel } from './todayFieldModel';

describe('todayFieldModel', () => {
  it('hides harvest-ready crops after a not-ready delay until the new due date', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
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
      ],
      tasks: [
        createHarvestTask({
          delayReason: 'Checked Radish row on 2026-06-21; not ready.',
          deferredUntilDate: '2026-06-24',
          dueDate: '2026-06-24',
        }),
      ],
    };

    expect(
      buildTodayFieldModel(garden, garden.tasks, '2026-06-21').harvestReady,
    ).toEqual([]);
    expect(
      buildTodayFieldModel(garden, garden.tasks, '2026-06-24').harvestReady,
    ).toEqual([
      expect.objectContaining({
        delayReason: 'Checked Radish row on 2026-06-21; not ready.',
        dueDate: '2026-06-24',
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
        new Date('2026-06-21T14:00:00.000Z'),
      ).activeWatering,
    ).toEqual([]);
    expect(
      buildTodayFieldModel(
        garden,
        [],
        '2026-06-21',
        new Date('2026-06-21T19:00:00.000Z'),
      ).activeWatering,
    ).toHaveLength(1);
  });
});

function createHarvestTask(overrides: Partial<Task> = {}): Task {
  return {
    bedLabel: 'Main bed',
    completedAtIso: null,
    createdAtIso: '2026-06-21T12:00:00.000Z',
    deferredUntilDate: null,
    dueDate: '2026-06-21',
    gardenId: 'user-a',
    id: 'planting-radish-1-harvest',
    notes: 'Check roots.',
    plantingId: 'radish-1',
    priority: 'medium',
    snoozedUntilDate: null,
    source: 'generated',
    sourceId: 'radish-1',
    status: 'open',
    structureId: null,
    title: 'Harvest Radish row',
    type: 'harvest',
    ...overrides,
  };
}

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
