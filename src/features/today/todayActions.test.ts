import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type Garden,
  type Task,
  type WaterRecommendation,
} from '../../domain/gardens/GardenRepository';
import {
  logFieldHarvest,
  markWaterDone,
  reportFieldIssue,
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
            source: 'waterRecommendation',
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

    expect(updated.waterRecommendations[0]).toMatchObject({
      status: 'completed',
    });
    expect(
      updated.tasks.find((task) => task.id === 'water-water-1'),
    ).toMatchObject({
      completedAtIso: '2026-06-21T12:00:00.000Z',
      status: 'done',
    });
    expect(updated.journalEntries[0]).toMatchObject({
      body: expect.stringContaining('0.6 inches'),
      title: 'Watered Tomato',
      type: 'note',
    });
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
      createFieldGarden(),
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

function createFieldGarden(): Garden {
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
    waterRecommendations: [createWaterRecommendation()],
  };
}

function createWaterRecommendation(): WaterRecommendation {
  return {
    deficitInches: 0.6,
    generatedAtIso: '2026-06-21T11:00:00.000Z',
    gardenId: 'user-a',
    id: 'water-1',
    inchesNeeded: 0.6,
    plantingId: 'tomato-1',
    rationale: ['Dry soil.'],
    reason: 'Dry soil',
    recommendationDate: '2026-06-21',
    recommendedWaterInches: 0.6,
    status: 'active',
    suppressUntilIso: null,
    targetId: 'tomato-1',
    targetLabel: 'Tomato',
    targetType: 'planting',
    urgency: 'high',
    weatherSnapshotId: 'weather-1',
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
