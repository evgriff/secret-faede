import {
  createDefaultGarden,
  createDefaultPlanting,
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
