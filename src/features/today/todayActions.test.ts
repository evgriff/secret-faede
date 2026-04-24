import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type Garden,
  type Task,
  type WateringScheduleEntry,
} from '../../domain/gardens/GardenRepository';
import {
  adjustWateringAmount,
  logFieldHarvest,
  logPartialWatering,
  markWaterDone,
  reportFieldIssue,
  skipWateringBecauseRainArrived,
  snoozeWatering,
  updateIssueStatus,
  type TodayTarget,
} from './todayActions';
import { delayHarvestReminder } from './todayHarvestActions';
import { markPlantingLifecycle } from './todayLifecycleActions';

describe('todayActions', () => {
  it('marks watering done and writes a water journal entry', () => {
    const updated = markWaterDone(
      {
        ...createFieldGarden(),
        tasks: [
          {
            bedLabel: 'Main bed',
            completedAtIso: null,
            createdAtIso: '2026-06-21T11:00:00.000Z',
            deferredUntilDate: null,
            dueDate: '2026-06-21',
            gardenId: 'user-a',
            id: 'water-water-1',
            notes: 'Dry soil.',
            plantingId: 'tomato-1',
            priority: 'high',
            snoozedUntilDate: null,
            source: 'wateringSchedule',
            sourceId: 'water-1',
            status: 'open',
            structureId: null,
            title: 'Water Tomato',
            type: 'water',
          },
        ],
      },
      'water-1',
      new Date('2026-06-21T12:00:00.000Z'),
    );

    expect(updated.wateringSchedule[0]).toMatchObject({
      lastWateredAtIso: '2026-06-21T12:00:00.000Z',
      status: 'completed',
    });
    expect(
      updated.tasks.find((task) => task.id === 'water-water-1'),
    ).toMatchObject({
      completedAtIso: '2026-06-21T12:00:00.000Z',
      status: 'done',
    });
    expect(updated.journalEntries[0]).toMatchObject({
      body: expect.stringContaining('Applied 0.6 in to Tomato'),
      title: 'Watered Tomato',
      type: 'note',
    });
    expect(updated.journalEntries[0]?.body).toContain(
      'Watering is complete for now',
    );
    expect(updated.journalEntries[0]?.body).not.toContain('Dry soil');
  });

  it('adds the remaining amount onto a partial watering entry when marking it done', () => {
    const updated = markWaterDone(
      {
        ...createFieldGarden({
          wateringSchedule: [
            createWateringScheduleEntry({
              appliedAmountInches: 0.25,
              lastWateredAtIso: '2026-06-21T09:00:00.000Z',
              status: 'partial',
              targetAmountInches: 0.35,
              deficitInches: 0.35,
            }),
          ],
        }),
        tasks: [
          {
            bedLabel: 'Main bed',
            completedAtIso: null,
            createdAtIso: '2026-06-21T11:00:00.000Z',
            deferredUntilDate: null,
            dueDate: '2026-06-21',
            gardenId: 'user-a',
            id: 'water-water-1',
            notes: 'Dry soil.',
            plantingId: 'tomato-1',
            priority: 'high',
            snoozedUntilDate: null,
            source: 'wateringSchedule',
            sourceId: 'water-1',
            status: 'open',
            structureId: null,
            title: 'Water Tomato',
            type: 'water',
          },
        ],
      },
      'water-1',
      new Date('2026-06-21T12:00:00.000Z'),
    );

    expect(updated.wateringSchedule[0]).toMatchObject({
      appliedAmountInches: 0.6,
      lastWateredAtIso: '2026-06-21T12:00:00.000Z',
      status: 'completed',
    });
  });

  it('logs partial watering and keeps the remaining deficit due', () => {
    const updated = logPartialWatering(
      {
        ...createFieldGarden(),
        tasks: [
          {
            bedLabel: 'Main bed',
            completedAtIso: null,
            createdAtIso: '2026-06-21T11:00:00.000Z',
            deferredUntilDate: null,
            dueDate: '2026-06-21',
            gardenId: 'user-a',
            id: 'water-water-1',
            notes: 'Dry soil.',
            plantingId: 'tomato-1',
            priority: 'high',
            snoozedUntilDate: null,
            source: 'wateringSchedule',
            sourceId: 'water-1',
            status: 'open',
            structureId: null,
            title: 'Water Tomato',
            type: 'water',
          },
        ],
      },
      'water-1',
      { amountInches: 0.2, occurredOn: '2026-06-21' },
      new Date('2026-06-21T12:00:00.000Z'),
    );

    expect(updated.wateringSchedule[0]).toMatchObject({
      appliedAmountInches: 0.2,
      deficitInches: 0.4,
      lastWateredAtIso: '2026-06-21T12:00:00.000Z',
      status: 'partial',
      targetAmountInches: 0.4,
    });
    expect(
      updated.tasks.find((task) => task.id === 'water-water-1'),
    ).toMatchObject({
      sourceId: 'water-1',
      status: 'open',
      title: 'Water Tomato 0.40 in',
    });
    expect(updated.journalEntries[0]).toMatchObject({
      body: expect.stringContaining('Applied 0.2 in to Tomato'),
      title: 'Partially watered Tomato',
      type: 'note',
    });
    expect(updated.journalEntries[0]?.body).toContain(
      '0.4 inches are still due',
    );
    expect(updated.journalEntries[0]?.body).not.toContain('Dry soil');
  });

  it('adjusts the remaining watering amount without closing the work item', () => {
    const updated = adjustWateringAmount(
      createFieldGarden(),
      'water-1',
      0.35,
      new Date('2026-06-21T12:00:00.000Z'),
    );

    expect(updated.wateringSchedule[0]).toMatchObject({
      deficitInches: 0.35,
      reasonSummary: 'Remaining watering was adjusted to 0.35 inches.',
      status: 'due',
      targetAmountInches: 0.35,
    });
    expect(
      updated.tasks.find((task) => task.sourceId === 'water-1'),
    ).toMatchObject({
      notes: expect.stringContaining('0.35'),
      status: 'open',
      title: 'Water Tomato 0.35 in',
    });
  });

  it('skips watering when rain arrives and retires the related task', () => {
    const updated = skipWateringBecauseRainArrived(
      {
        ...createFieldGarden(),
        tasks: [
          {
            bedLabel: 'Main bed',
            completedAtIso: null,
            createdAtIso: '2026-06-21T11:00:00.000Z',
            deferredUntilDate: null,
            dueDate: '2026-06-21',
            gardenId: 'user-a',
            id: 'water-water-1',
            notes: 'Dry soil.',
            plantingId: 'tomato-1',
            priority: 'high',
            snoozedUntilDate: null,
            source: 'wateringSchedule',
            sourceId: 'water-1',
            status: 'open',
            structureId: null,
            title: 'Water Tomato',
            type: 'water',
          },
        ],
      },
      'water-1',
      new Date('2026-06-21T12:00:00.000Z'),
    );

    expect(updated.wateringSchedule[0]).toMatchObject({
      deficitInches: 0,
      status: 'skipped',
      targetAmountInches: 0,
    });
    expect(
      updated.tasks.find((task) => task.id === 'water-water-1'),
    ).toMatchObject({
      status: 'skipped',
    });
    expect(updated.journalEntries[0]).toMatchObject({
      body: 'Skipped watering Tomato. Watering was skipped because rain arrived before watering.',
      title: 'Skipped watering Tomato',
      type: 'note',
    });
  });

  it('snoozes watering to tomorrow without losing the remaining amount', () => {
    const now = new Date('2026-06-21T12:00:00.000Z');
    const updated = snoozeWatering(
      createFieldGarden(),
      'water-1',
      'tomorrow',
      now,
    );

    expect(updated.wateringSchedule[0]).toMatchObject({
      dueDate: '2026-06-22',
      status: 'snoozed',
      targetAmountInches: 0.6,
    });
    expect(
      Date.parse(updated.wateringSchedule[0]?.dueWindowStartIso ?? ''),
    ).toBeGreaterThan(now.getTime());
  });

  it('reports an issue and creates a linked follow-up task', () => {
    const updated = reportFieldIssue(
      createFieldGarden(),
      {
        body: 'Chewed leaves on lower growth.',
        category: 'pest',
        id: 'issue-1',
        occurredOn: '2026-06-21',
        photos: [],
        severity: 'high',
        status: 'open',
        target: plantingTarget,
        title: 'Tomato pest damage',
      },
      new Date('2026-06-21T12:00:00.000Z'),
    );

    expect(updated.journalEntries[0]).toMatchObject({
      id: 'issue-1',
      issueCategory: 'pest',
      issueSeverity: 'high',
      issueStatus: 'open',
      plantingId: 'tomato-1',
      type: 'issue',
    });
    expect(updated.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          plantingId: 'tomato-1',
          priority: 'high',
          sourceId: 'issue-1',
          title: 'Inspect Tomato: Tomato pest damage',
          type: 'inspect',
        }),
      ]),
    );
  });

  it('resolves an issue and completes its follow-up task', () => {
    const issueGarden = reportFieldIssue(
      createFieldGarden(),
      {
        body: 'Leaves are curling.',
        category: 'irrigation',
        id: 'issue-1',
        occurredOn: '2026-06-21',
        photos: [],
        severity: 'medium',
        status: 'open',
        target: plantingTarget,
        title: 'Water stress',
      },
      new Date('2026-06-21T12:00:00.000Z'),
    );
    const updated = updateIssueStatus(
      issueGarden,
      'issue-1',
      'resolved',
      new Date('2026-06-22T12:00:00.000Z'),
    );

    expect(updated.journalEntries[0]).toMatchObject({
      issueStatus: 'resolved',
    });
    expect(
      updated.tasks.find((task) => task.sourceId === 'issue-1'),
    ).toMatchObject({
      completedAtIso: '2026-06-22T12:00:00.000Z',
      status: 'done',
    });
  });

  it('logs harvests and only finishes a crop when requested', () => {
    const partial = logFieldHarvest(
      {
        ...createFieldGarden(),
        tasks: [createHarvestTask()],
      },
      {
        amountText: '3 count',
        cropFinished: false,
        harvestedOn: '2026-07-15',
        notes: 'First ripe fruit.',
        plantingId: 'tomato-1',
        quantity: 3,
        unit: 'count',
      },
      new Date('2026-07-15T12:00:00.000Z'),
    );
    const finished = logFieldHarvest(
      createFieldGarden(),
      {
        amountText: '2 lb',
        cropFinished: true,
        harvestedOn: '2026-09-20',
        notes: 'Cleared the plant.',
        plantingId: 'tomato-1',
        quantity: 2,
        unit: 'lb',
      },
      new Date('2026-09-20T12:00:00.000Z'),
    );

    expect(partial.plantings[0]).toMatchObject({
      status: 'harvest-ready',
    });
    expect(
      partial.tasks.find((task) => task.id === 'planting-tomato-1-harvest'),
    ).toMatchObject({
      completedAtIso: '2026-07-15T12:00:00.000Z',
      status: 'done',
    });
    expect(finished.plantings[0]).toMatchObject({
      status: 'harvested',
    });
    expect(finished.harvestEvents[0]).toMatchObject({
      amountText: '2 lb',
      cropId: 'tomato',
    });
  });

  it('reschedules harvest reminders when a crop is not ready', () => {
    const updated = delayHarvestReminder(
      {
        ...createFieldGarden(),
        plantings: [
          {
            ...createFieldGarden().plantings[0]!,
            status: 'harvest-ready',
          },
        ],
        tasks: [createHarvestTask()],
      },
      {
        delayUntilDate: '2026-06-24',
        plantingId: 'tomato-1',
        reason: 'Checked Tomato on 2026-06-21; not ready. Recheck 3 days.',
      },
      new Date('2026-06-21T12:00:00.000Z'),
    );
    const harvestTasks = updated.tasks.filter(
      (task) => task.type === 'harvest',
    );

    expect(updated.plantings[0]).toMatchObject({
      status: 'growing',
    });
    expect(harvestTasks).toHaveLength(1);
    expect(harvestTasks[0]).toMatchObject({
      delayReason: 'Checked Tomato on 2026-06-21; not ready. Recheck 3 days.',
      delaySetAtIso: '2026-06-21T12:00:00.000Z',
      deferredUntilDate: '2026-06-24',
      dueDate: '2026-06-24',
      notes: expect.stringContaining('Not ready: Checked Tomato'),
      snoozedUntilDate: null,
      status: 'open',
    });
  });

  it('marks crop lifecycle changes from the field dashboard', () => {
    const updated = markPlantingLifecycle(
      {
        ...createFieldGarden(),
        plantings: [
          {
            ...createDefaultPlanting({
              id: 'tomato-1',
              label: 'Tomato',
              xFt: 3,
              yFt: 3,
            }),
            cropId: 'tomato',
            plannedFor: '2026-06-21',
            status: 'planned',
          },
        ],
        tasks: [createSetupTask()],
      },
      'tomato-1',
      'planted',
      new Date('2026-06-21T12:00:00.000Z'),
    );

    expect(updated.plantings[0]).toMatchObject({
      plantedOn: '2026-06-21',
      status: 'planted',
    });
    expect(
      updated.tasks.find((task) => task.id === 'plant-tomato-1'),
    ).toMatchObject({
      completedAtIso: '2026-06-21T12:00:00.000Z',
      status: 'done',
    });
    expect(updated.journalEntries[0]).toMatchObject({
      plantingId: 'tomato-1',
      targetType: 'planting',
      title: 'Marked Tomato planted',
      type: 'note',
    });
  });
});

const plantingTarget: TodayTarget = {
  id: 'planting:tomato-1',
  label: 'Tomato',
  plantingId: 'tomato-1',
  structureId: null,
  type: 'planting',
};

function createFieldGarden(overrides: Partial<Garden> = {}): Garden {
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
    wateringSchedule: [createWateringScheduleEntry()],
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
    wateringZoneId: null,
    weatherSnapshotId: 'weather-1',
    ...overrides,
  };
}

function createHarvestTask(): Task {
  return {
    ...createSetupTask(),
    id: 'planting-tomato-1-harvest',
    notes: 'Pick ripe fruit before it softens.',
    title: 'Harvest Tomato',
    type: 'harvest',
  };
}

function createSetupTask(): Task {
  return {
    bedLabel: 'Main bed',
    completedAtIso: null,
    createdAtIso: '2026-06-21T11:00:00.000Z',
    deferredUntilDate: null,
    dueDate: '2026-06-21',
    gardenId: 'user-a',
    id: 'plant-tomato-1',
    notes: 'Set the transplant.',
    plantingId: 'tomato-1',
    priority: 'high',
    snoozedUntilDate: null,
    source: 'generated',
    sourceId: 'tomato-1',
    status: 'open',
    structureId: null,
    title: 'Plant Tomato',
    type: 'plant',
  };
}
