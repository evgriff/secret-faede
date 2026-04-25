import {
  appendPlantingEvent,
  createDefaultGarden,
  createDefaultPlanting,
} from '../../domain/gardens/GardenRepository';
import { buildLogFeedItems } from '../log/logFeedItems';
import { synchronizeGardenTasks } from '../tasks/taskEngine';
import { buildTodayFieldModel } from '../today/todayFieldModel';
import { applyPlantingEventEffects } from './plantingEventEffects';

describe('applyPlantingEventEffects', () => {
  it('turns a recorded sowing event into Today follow-up work and a Feed memory', () => {
    const baseGarden = synchronizeGardenTasks(
      {
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
          },
        ],
      },
      { now: new Date('2026-04-22T14:00:00.000Z') },
    );
    const nextPlantings = baseGarden.plantings.map((planting) =>
      planting.id === 'tomato-1'
        ? appendPlantingEvent(planting, {
            occurredOn: '2026-04-22',
            type: 'directSowed',
          })
        : planting,
    );
    const updatedGarden = applyPlantingEventEffects({
      garden: baseGarden,
      nextPlantings,
      now: new Date('2026-04-22T14:00:00.000Z'),
    });
    const openTasks = updatedGarden.tasks.filter(
      (task) => task.status === 'open',
    );
    const todayModel = buildTodayFieldModel(
      updatedGarden,
      openTasks,
      '2026-04-22',
      '2026-04-22',
      new Date('2026-04-22T14:00:00.000Z'),
    );
    const feedItems = buildLogFeedItems({
      garden: updatedGarden,
      revisions: [],
    });

    expect(openTasks.map((task) => task.title)).not.toContain(
      'Start Tomato indoors',
    );
    expect(openTasks.map((task) => task.title)).not.toContain('Plant Tomato');
    expect(openTasks.map((task) => task.title)).toEqual(
      expect.arrayContaining(['Set support for Tomato', 'Mulch Tomato']),
    );
    expect(todayModel.cropStageActions).toEqual([
      expect.objectContaining({
        cropName: 'Tomato',
        summary: 'Direct sowed 2026-04-22',
      }),
    ]);
    expect(feedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: 'Tomato was direct sowed on 2026-04-22.',
          targetLabel: 'Tomato',
          title: 'Direct sowed Tomato',
          type: 'note',
        }),
      ]),
    );
  });

  it('clears stale setup tasks and writes one Feed memory per planting after a bulk planted action', () => {
    const baseGarden = synchronizeGardenTasks(
      {
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
          },
          {
            ...createDefaultPlanting({
              id: 'basil-1',
              label: 'Basil',
              xFt: 4,
              yFt: 2,
            }),
            cropId: 'basil',
          },
        ],
      },
      { now: new Date('2026-05-10T14:00:00.000Z') },
    );
    const nextPlantings = baseGarden.plantings.map((planting) =>
      appendPlantingEvent(planting, {
        occurredOn: '2026-05-10',
        type: 'plantedOut',
      }),
    );
    const updatedGarden = applyPlantingEventEffects({
      garden: baseGarden,
      nextPlantings,
      now: new Date('2026-05-10T14:00:00.000Z'),
    });
    const openTasks = updatedGarden.tasks.filter(
      (task) => task.status === 'open',
    );

    expect(
      openTasks.filter(
        (task) =>
          task.plantingId === 'tomato-1' || task.plantingId === 'basil-1',
      ),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'plant' }),
        expect.objectContaining({ type: 'sow' }),
        expect.objectContaining({ type: 'transplant' }),
      ]),
    );
    expect(updatedGarden.journalEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          plantingId: 'tomato-1',
          title: 'Planted out Tomato',
        }),
        expect.objectContaining({
          plantingId: 'basil-1',
          title: 'Planted out Basil',
        }),
      ]),
    );
  });
});
