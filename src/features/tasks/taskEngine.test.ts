import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type Garden,
  type WateringScheduleEntry,
  type WeatherSnapshot,
} from '../../domain/gardens/GardenRepository';
import {
  addManualTask,
  addSuccessionPlanting,
  buildSuccessionRecommendations,
  completeTask,
  synchronizeGardenTasks,
} from './taskEngine';

describe('taskEngine', () => {
  it('generates climate, crop, support, and water tasks', () => {
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
          source: 'wateringSchedule',
          title: 'Water Tomato 0.60 in',
          type: 'water',
        }),
      ]),
    );
    expect(garden.tasks.map((task) => task.title)).not.toContain(
      'Transplant Tomato',
    );
    expect(garden.tasks.map((task) => task.title)).not.toContain(
      'Set support for Tomato',
    );
  });

  it('creates generated planting tasks inside one week but not after it', () => {
    const insideWindow = synchronizeGardenTasks(
      {
        ...createTaskGarden(),
        plantings: [
          {
            ...createDefaultPlanting({
              id: 'radish-1',
              label: 'Radish row',
              xFt: 3,
              yFt: 3,
            }),
            cropId: 'radish',
            plannedFor: '2026-04-26',
            status: 'planned',
          },
        ],
        wateringSchedule: [],
      },
      { now: new Date('2026-04-20T12:00:00.000Z') },
    );
    const outsideWindow = synchronizeGardenTasks(
      {
        ...createTaskGarden(),
        plantings: [
          {
            ...createDefaultPlanting({
              id: 'radish-1',
              label: 'Radish row',
              xFt: 3,
              yFt: 3,
            }),
            cropId: 'radish',
            plannedFor: '2026-04-27',
            status: 'planned',
          },
        ],
        wateringSchedule: [],
      },
      { now: new Date('2026-04-20T12:00:00.000Z') },
    );

    expect(insideWindow.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dueDate: '2026-04-26',
          title: 'Direct sow Radish row',
        }),
      ]),
    );
    expect(outsideWindow.tasks.map((task) => task.title)).not.toContain(
      'Direct sow Radish row',
    );
  });

  it('generates seedling, thinning, and weather-prep tasks when the garden implies them', () => {
    const garden = synchronizeGardenTasks(
      {
        ...createTaskGarden(),
        plantings: [
          {
            ...createDefaultPlanting({
              id: 'radish-1',
              label: 'Radish row',
              xFt: 3,
              yFt: 3,
            }),
            cropId: 'radish',
            mode: 'row',
            plantCount: 12,
            status: 'planned',
          },
        ],
        wateringSchedule: [],
        weatherSnapshots: [createWeatherSnapshot()],
      },
      { now: new Date('2026-04-20T12:00:00.000Z') },
    );

    expect(garden.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dueDate: '2026-04-19',
          notes: expect.stringContaining('Check germination'),
          title: 'Check Radish row seedlings',
          type: 'inspect',
        }),
        expect.objectContaining({
          dueDate: '2026-04-26',
          notes: expect.stringContaining('spacing'),
          title: 'Thin Radish row',
          type: 'thin',
        }),
        expect.objectContaining({
          dueDate: '2026-04-20',
          title: 'Cover tender crops before frost risk',
          type: 'inspect',
        }),
        expect.objectContaining({
          dueDate: '2026-04-20',
          title: 'Check heat-stressed crops',
          type: 'inspect',
        }),
      ]),
    );
  });

  it('derives direct-sow follow-up from recorded planting events', () => {
    const garden = synchronizeGardenTasks(
      {
        ...createTaskGarden(),
        plantings: [
          {
            ...createDefaultPlanting({
              id: 'radish-1',
              label: 'Radish row',
              xFt: 3,
              yFt: 3,
            }),
            cropId: 'radish',
            mode: 'row',
            plantCount: 12,
            plannedFor: '2026-04-19',
            plantingEvents: [
              {
                id: 'planting-event:directSowed:2026-04-12',
                occurredOn: '2026-04-12',
                type: 'directSowed',
              },
            ],
            status: 'planted',
          },
        ],
        wateringSchedule: [],
      },
      { now: new Date('2026-04-20T12:00:00.000Z') },
    );

    expect(garden.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dueDate: '2026-04-19',
          title: 'Check Radish row seedlings',
          type: 'inspect',
        }),
        expect.objectContaining({
          dueDate: '2026-04-26',
          title: 'Thin Radish row',
          type: 'thin',
        }),
      ]),
    );
  });

  it('derives harden-off and plant-out timing from recorded indoor starts', () => {
    const garden = synchronizeGardenTasks(
      {
        ...createTaskGarden(),
        plantings: [
          {
            ...createDefaultPlanting({
              id: 'tomato-1',
              label: 'Tomato',
              xFt: 3,
              yFt: 3,
            }),
            cropId: 'tomato',
            plantingEvents: [
              {
                id: 'planting-event:startedInside:2026-04-10',
                occurredOn: '2026-04-10',
                type: 'startedInside',
              },
            ],
            status: 'planned',
            sunRequirement: 'fullSun',
          },
        ],
      },
      { now: new Date('2026-05-11T12:00:00.000Z') },
    );

    expect(garden.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dueDate: '2026-05-10',
          title: 'Harden off Tomato',
          type: 'inspect',
        }),
        expect.objectContaining({
          dueDate: '2026-05-17',
          title: 'Plant out Tomato',
          type: 'transplant',
        }),
      ]),
    );
  });

  it('retires stale generated tasks when their source no longer applies', () => {
    const garden = synchronizeGardenTasks(createTaskGarden(), {
      now: new Date('2026-04-20T12:00:00.000Z'),
    });
    const recommendation = garden.wateringSchedule[0];

    if (!recommendation) {
      throw new Error('Expected a water recommendation.');
    }

    const withoutWaterNeed = synchronizeGardenTasks(
      {
        ...garden,
        wateringSchedule: [
          {
            ...recommendation,
            status: 'completed',
          },
        ],
      },
      { now: new Date('2026-04-21T12:00:00.000Z') },
    );

    expect(
      withoutWaterNeed.tasks.find((task) => task.id === 'water-water-1'),
    ).toMatchObject({
      status: 'skipped',
    });
  });

  it('retires legacy generated harvest tasks now that harvest is schedule context only', () => {
    const garden = synchronizeGardenTasks(
      {
        ...createTaskGarden(),
        tasks: [
          {
            bedLabel: 'Main bed',
            completedAtIso: null,
            createdAtIso: '2026-04-20T07:00:00.000Z',
            deferredUntilDate: null,
            dueDate: '2026-06-18',
            gardenId: 'user-a',
            id: 'planting-tomato-1-harvest',
            notes: 'Check the bed before clearing it.',
            plantingId: 'tomato-1',
            priority: 'medium',
            snoozedUntilDate: null,
            source: 'generated',
            sourceId: 'tomato-1',
            status: 'open',
            structureId: null,
            title: 'Harvest Tomato',
            type: 'harvest',
          },
        ],
      },
      { now: new Date('2026-04-20T12:00:00.000Z') },
    );

    expect(
      garden.tasks.find((task) => task.id === 'planting-tomato-1-harvest'),
    ).toMatchObject({
      status: 'skipped',
    });
  });

  it('does not duplicate preexisting water tasks with the same recommendation source', () => {
    const garden = synchronizeGardenTasks(
      {
        ...createTaskGarden(),
        tasks: [
          {
            bedLabel: 'Main bed',
            completedAtIso: null,
            createdAtIso: '2026-04-20T07:00:00.000Z',
            deferredUntilDate: null,
            dueDate: '2026-04-20',
            gardenId: 'user-a',
            id: 'custom-water-task',
            notes: '',
            plantingId: 'tomato-1',
            priority: 'medium',
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
      {
        now: new Date('2026-04-20T12:00:00.000Z'),
        refreshOpenGenerated: true,
      },
    );

    const waterTasks = garden.tasks.filter((task) => task.type === 'water');
    expect(waterTasks).toHaveLength(1);
    expect(waterTasks[0]).toMatchObject({
      id: 'custom-water-task',
      title: 'Water Tomato 0.60 in',
    });
  });

  it('completes planting and watering tasks into downstream state', () => {
    const garden = synchronizeGardenTasks(createTaskGarden(), {
      now: new Date('2026-05-17T12:00:00.000Z'),
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
      plantingEvents: [
        expect.objectContaining({
          occurredOn: '2026-05-17',
          type: 'plantedOut',
        }),
      ],
      plantedOn: '2026-05-17',
      status: 'growing',
    });
    expect(wateredGarden.wateringSchedule[0]).toMatchObject({
      lastWateredAtIso: '2026-05-18T12:00:00.000Z',
      status: 'completed',
    });
    expect(
      wateredGarden.tasks.find((task) => task.id === 'planting-tomato-1-plant'),
    ).toMatchObject({
      status: 'done',
    });
    expect(wateredGarden.journalEntries[0]).toMatchObject({
      title: 'Planted out Tomato',
      type: 'note',
    });
  });

  it('accumulates previously applied water when a partial schedule entry is completed', () => {
    const garden = synchronizeGardenTasks(
      {
        ...createTaskGarden(),
        wateringSchedule: [
          createWateringScheduleEntry({
            appliedAmountInches: 0.25,
            lastWateredAtIso: '2026-04-20T09:00:00.000Z',
            status: 'partial',
            targetAmountInches: 0.35,
            deficitInches: 0.35,
          }),
        ],
      },
      {
        now: new Date('2026-04-20T12:00:00.000Z'),
        refreshOpenGenerated: true,
      },
    );
    const wateredGarden = completeTask(
      garden,
      'water-water-1',
      new Date('2026-04-20T15:00:00.000Z'),
    );

    expect(wateredGarden.wateringSchedule[0]).toMatchObject({
      appliedAmountInches: 0.6,
      lastWateredAtIso: '2026-04-20T15:00:00.000Z',
      status: 'completed',
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
        wateringSchedule: [],
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

  it('keeps future manual tasks stored even when they are outside the generated horizon', () => {
    const garden = addManualTask(
      createDefaultGarden('user-a'),
      {
        dueDate: '2026-05-20',
        notes: 'Buy stakes after payday.',
        title: 'Buy tomato stakes',
        type: 'other',
      },
      new Date('2026-04-20T12:00:00.000Z'),
    );

    expect(garden.tasks).toEqual([
      expect.objectContaining({
        dueDate: '2026-05-20',
        source: 'manual',
        title: 'Buy tomato stakes',
      }),
    ]);
  });

  it('preserves snoozed generated tasks that have moved beyond the generated horizon', () => {
    const garden = synchronizeGardenTasks(
      {
        ...createTaskGarden(),
        tasks: [
          {
            bedLabel: 'Main bed',
            completedAtIso: null,
            createdAtIso: '2026-04-20T07:00:00.000Z',
            deferredUntilDate: null,
            dueDate: '2026-05-20',
            gardenId: 'user-a',
            id: 'planting-tomato-1-plant',
            notes: 'User moved this later.',
            plantingId: 'tomato-1',
            priority: 'medium',
            snoozedUntilDate: '2026-05-20',
            source: 'generated',
            sourceId: 'tomato-1',
            status: 'open',
            structureId: null,
            title: 'Transplant Tomato',
            type: 'transplant',
          },
        ],
      },
      { now: new Date('2026-04-20T12:00:00.000Z') },
    );

    expect(
      garden.tasks.find((task) => task.id === 'planting-tomato-1-plant'),
    ).toMatchObject({
      dueDate: '2026-05-20',
      snoozedUntilDate: '2026-05-20',
      status: 'open',
    });
  });

  it('approves a succession recommendation into a future planned planting', () => {
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
        wateringSchedule: [],
      },
      { now: new Date('2026-04-20T12:00:00.000Z') },
    );
    const recommendation = buildSuccessionRecommendations(
      garden,
      new Date('2026-04-20T12:00:00.000Z'),
    )[0];

    if (!recommendation) {
      throw new Error('Expected a succession recommendation.');
    }

    const updatedGarden = addSuccessionPlanting(
      garden,
      recommendation,
      new Date('2026-04-20T12:00:00.000Z'),
    );

    expect(updatedGarden.plantings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cropId: recommendation.cropId,
          plannedFor: recommendation.earliestDate,
          status: 'planned',
        }),
      ]),
    );
    expect(updatedGarden.tasks).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({
          plantingId: expect.stringContaining('succession-planting-'),
        }),
      ]),
    );
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
    wateringSchedule: [createWateringScheduleEntry()],
  };
}

function createWateringScheduleEntry(
  overrides: Partial<WateringScheduleEntry> = {},
): WateringScheduleEntry {
  return {
    appliedAmountInches: null,
    createdAtIso: '2026-04-20T12:00:00.000Z',
    deficitInches: 0.6,
    dueDate: '2026-04-20',
    dueWindowEndIso: null,
    dueWindowStartIso: '2026-04-20T12:00:00.000Z',
    gardenId: 'user-a',
    id: 'water-1',
    lastWateredAtIso: null,
    nextRecalculationAtIso: null,
    reasonDetails: ['Rain is unlikely today.'],
    reasonSummary: 'Dry soil',
    status: 'due',
    targetId: 'tomato-1',
    targetAmountInches: 0.6,
    targetKind: 'planting',
    targetLabel: 'Tomato',
    updatedAtIso: '2026-04-20T12:00:00.000Z',
    urgency: 'high',
    wateringZoneId: null,
    weatherSnapshotId: 'weather-1',
    ...overrides,
  };
}

function createWeatherSnapshot(): WeatherSnapshot {
  return {
    alertSummaries: ['Strong wind may knock over unsupported seedlings.'],
    capturedAtIso: '2026-04-20T11:00:00.000Z',
    conditionSummary: 'Cold morning, hot afternoon',
    evapotranspirationIn: null,
    forecastRainNext24In: null,
    forecastRainNext48In: null,
    frostRisk: 'watch',
    gardenId: 'user-a',
    heatRisk: 'warning',
    humidityPercent: null,
    id: 'weather-1',
    nextRainIso: null,
    observedForDate: '2026-04-20',
    overnightLowF: 34,
    precipitationIn: null,
    recentPrecipitation72hIn: null,
    source: 'manual',
    temperatureF: 82,
    windMph: 14,
  };
}
