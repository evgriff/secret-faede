import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type Garden,
  type WaterRecommendation,
} from '../../domain/gardens/GardenRepository';
import {
  addManualTask,
  buildSuccessionRecommendations,
  completeTask,
  synchronizeGardenTasks,
} from './taskEngine';

describe('taskEngine', () => {
  it('generates climate, crop, support, harvest, and water tasks', () => {
    const garden = synchronizeGardenTasks(createTaskGarden(), {
      now: new Date('2026-04-20T12:00:00.000Z'),
    });

    expect(garden.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bedLabel: 'Main bed',
          dueDate: '2026-04-05',
          title: 'Start Tomato indoors',
          type: 'sow',
        }),
        expect.objectContaining({
          dueDate: '2026-05-17',
          title: 'Transplant Tomato',
          type: 'transplant',
        }),
        expect.objectContaining({
          title: 'Set support for Tomato',
          type: 'trellis',
        }),
        expect.objectContaining({
          title: 'Harvest Tomato',
          type: 'harvest',
        }),
        expect.objectContaining({
          source: 'waterRecommendation',
          title: 'Water Tomato',
          type: 'water',
        }),
      ]),
    );
  });

  it('completes planting and watering tasks into downstream state', () => {
    const garden = synchronizeGardenTasks(createTaskGarden(), {
      now: new Date('2026-04-20T12:00:00.000Z'),
    });
    const plantedGarden = completeTask(
      garden,
      'planting-tomato-1-plant',
      new Date('2026-05-17T12:00:00.000Z'),
    );
    const wateredGarden = completeTask(
      plantedGarden,
      'water-water-1',
      new Date('2026-05-18T12:00:00.000Z'),
    );

    expect(wateredGarden.plantings[0]).toMatchObject({
      plantedOn: '2026-05-17',
      status: 'growing',
    });
    expect(wateredGarden.waterRecommendations[0]).toMatchObject({
      status: 'completed',
    });
    expect(
      wateredGarden.tasks.find((task) => task.id === 'planting-tomato-1-plant'),
    ).toMatchObject({
      status: 'done',
    });
  });

  it('suggests a follow-on planting from remaining season and sun', () => {
    const garden = synchronizeGardenTasks(
      {
        ...createTaskGarden(),
        plantings: [
          {
            ...createDefaultPlanting({
              id: 'radish-1',
              label: 'Radish block',
              xFt: 3,
              yFt: 3,
            }),
            cropId: 'radish',
            plantedOn: '2026-04-01',
            status: 'growing',
            sunRequirement: 'fullSun',
          },
        ],
        waterRecommendations: [],
      },
      { now: new Date('2026-04-20T12:00:00.000Z') },
    );

    expect(
      buildSuccessionRecommendations(
        garden,
        new Date('2026-04-20T12:00:00.000Z'),
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cropId: 'bush-bean',
          targetLabel: 'Main bed',
        }),
      ]),
    );
  });

  it('adds a manual field task without changing generated task ownership', () => {
    const garden = addManualTask(
      createDefaultGarden('user-a'),
      {
        dueDate: '2026-04-20',
        notes: 'Check the north bed after work.',
        title: 'Scout for weeds',
        type: 'weed',
      },
      new Date('2026-04-20T12:00:00.000Z'),
    );

    expect(garden.tasks).toEqual([
      expect.objectContaining({
        dueDate: '2026-04-20',
        gardenId: 'user-a',
        notes: 'Check the north bed after work.',
        source: 'manual',
        title: 'Scout for weeds',
        type: 'weed',
      }),
    ]);
  });
});

function createTaskGarden(): Garden {
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
        mulched: false,
        status: 'planned',
        sunRequirement: 'fullSun',
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
    generatedAtIso: '2026-04-20T12:00:00.000Z',
    gardenId: 'user-a',
    id: 'water-1',
    inchesNeeded: 0.6,
    plantingId: 'tomato-1',
    rationale: ['Rain is unlikely today.'],
    reason: 'Dry soil',
    recommendationDate: '2026-04-20',
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
