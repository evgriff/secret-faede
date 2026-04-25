import {
  createDefaultGarden,
  createDefaultPlanting,
  type Garden,
  type WateringScheduleEntry,
} from '../../domain/gardens/GardenRepository';
import {
  markWateringGroupDone,
  skipWateringGroupBecauseRainArrived,
  snoozeWateringGroup,
} from './todayWateringGroupActions';

describe('todayWateringGroupActions', () => {
  it('marks every member entry in a watering group done', () => {
    const updated = markWateringGroupDone(
      createGroupGarden(),
      ['water-1', 'water-2'],
      new Date('2026-06-21T12:00:00.000Z'),
    );

    expect(updated.wateringSchedule).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'water-1', status: 'completed' }),
        expect.objectContaining({ id: 'water-2', status: 'completed' }),
      ]),
    );
    expect(updated.journalEntries.slice(0, 2)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Watered Tomato' }),
        expect.objectContaining({ title: 'Watered Basil' }),
      ]),
    );
  });

  it('skips every member entry in a watering group when rain arrives', () => {
    const updated = skipWateringGroupBecauseRainArrived(
      createGroupGarden(),
      ['water-1', 'water-2'],
      new Date('2026-06-21T12:00:00.000Z'),
    );

    expect(updated.wateringSchedule).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'water-1', status: 'skipped' }),
        expect.objectContaining({ id: 'water-2', status: 'skipped' }),
      ]),
    );
  });

  it('snoozes every member entry in a watering group together', () => {
    const updated = snoozeWateringGroup(
      createGroupGarden(),
      ['water-1', 'water-2'],
      'tomorrow',
      new Date('2026-06-21T12:00:00.000Z'),
    );

    expect(updated.wateringSchedule).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dueDate: '2026-06-22',
          id: 'water-1',
          status: 'snoozed',
        }),
        expect.objectContaining({
          dueDate: '2026-06-22',
          id: 'water-2',
          status: 'snoozed',
        }),
      ]),
    );
  });
});

function createGroupGarden(overrides: Partial<Garden> = {}): Garden {
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
      },
      {
        ...createDefaultPlanting({
          id: 'basil-1',
          label: 'Basil',
          xFt: 4,
          yFt: 3,
        }),
        cropId: 'basil',
        status: 'growing',
      },
    ],
    wateringSchedule: [
      createWateringScheduleEntry({
        id: 'water-1',
        targetId: 'tomato-1',
        targetLabel: 'Tomato',
      }),
      createWateringScheduleEntry({
        id: 'water-2',
        targetId: 'basil-1',
        targetLabel: 'Basil',
      }),
    ],
    ...overrides,
  };
}

function createWateringScheduleEntry(
  overrides: Partial<WateringScheduleEntry> = {},
): WateringScheduleEntry {
  return {
    appliedAmountInches: null,
    createdAtIso: '2026-06-21T11:00:00.000Z',
    deficitInches: 0.6,
    dueDate: '2026-06-21',
    dueWindowEndIso: null,
    dueWindowStartIso: '2026-06-21T11:00:00.000Z',
    gardenId: 'user-a',
    id: 'water-1',
    lastWateredAtIso: null,
    nextRecalculationAtIso: null,
    reasonDetails: ['Dry soil.'],
    reasonSummary: 'Dry soil',
    status: 'due',
    targetId: 'tomato-1',
    targetAmountInches: 0.6,
    targetKind: 'planting',
    targetLabel: 'Tomato',
    updatedAtIso: '2026-06-21T11:00:00.000Z',
    urgency: 'high',
    wateringZoneId: 'zone-a',
    weatherSnapshotId: 'weather-1',
    ...overrides,
  };
}
