import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type Garden,
} from '../../domain/gardens/GardenRepository';
import { createInitialGardenRevision } from '../../domain/gardens/gardenWorkspace';
import {
  buildLogFeedFilterOptions,
  buildLogFeedItems,
  filterLogFeedItems,
} from './logFeedItems';

describe('logFeedItems', () => {
  it('builds a unified activity feed with real event types', () => {
    const garden = createFeedGarden();
    const items = buildLogFeedItems({
      garden,
      revisions: [
        createInitialGardenRevision('user-a', '2026-06-01T12:00:00.000Z'),
      ],
    });

    expect(items.map((item) => item.type)).toEqual(
      expect.arrayContaining([
        'harvest',
        'issue',
        'publish',
        'task',
        'watering',
      ]),
    );
    expect(items.find((item) => item.type === 'issue')).toMatchObject({
      authorLabel: 'Partner Gardener',
      cropId: 'tomato',
      targetLabel: 'Tomato',
    });
    expect(items.map((item) => item.id)).not.toContain('task-task-water-1');
  });

  it('filters feed items by type, crop, bed, and season', () => {
    const garden = createFeedGarden();
    const items = buildLogFeedItems({ garden, revisions: [] });
    const filterOptions = buildLogFeedFilterOptions(garden, items);

    expect(filterOptions.crops).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'tomato' })]),
    );
    expect(filterOptions.beds).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'bed-1' })]),
    );
    expect(
      filterLogFeedItems(items, {
        bedId: 'bed-1',
        cropId: 'tomato',
        issueStatus: 'all',
        query: '',
        season: '2026',
        targetId: 'all',
        type: 'issue',
      }).map((item) => item.id),
    ).toEqual(['journal-issue-1']);
  });

  it('formats watering history as a feed item and omits duplicate watering tasks', () => {
    const garden = createFeedGarden();
    const items = buildLogFeedItems({ garden, revisions: [] });
    const wateringItem = items.find((item) => item.type === 'watering');

    expect(wateringItem).toMatchObject({
      body: 'Watered Tomato with 0.4 inches.',
      id: 'journal-water-1',
      targetLabel: 'Tomato',
      title: 'Watered Tomato',
      type: 'watering',
    });
    expect(items.map((item) => item.id)).not.toContain('task-task-water-1');
  });

  it('dates publish activity in the garden timezone instead of UTC', () => {
    const garden = createFeedGarden();
    const items = buildLogFeedItems({
      garden,
      revisions: [
        createInitialGardenRevision('user-a', '2026-05-16T02:30:00.000Z'),
      ],
    });

    expect(items.find((item) => item.type === 'publish')).toMatchObject({
      date: '2026-05-15',
      title: 'Published plan',
    });
  });
});

function createFeedGarden(): Garden {
  return {
    ...createDefaultGarden('user-a'),
    harvestEvents: [
      {
        amountText: '2 lb',
        cropId: 'tomato',
        gardenId: 'user-a',
        harvestedOn: '2026-08-01',
        id: 'harvest-1',
        notes: 'Good flavor.',
        plantingId: 'tomato-1',
        quantity: 2,
        unit: 'lb',
      },
    ],
    journalEntries: [
      {
        body: 'Aphids on tomato leaves.',
        createdByDisplayName: 'Partner Gardener',
        createdByEmail: 'partner.gardener@example.com',
        createdByUserId: 'user-partner',
        createdAtIso: '2026-07-01T12:00:00.000Z',
        gardenId: 'user-a',
        id: 'issue-1',
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
      {
        body: 'Watered Tomato with 0.4 inches.',
        createdAtIso: '2026-07-02T12:00:00.000Z',
        gardenId: 'user-a',
        id: 'water-1',
        issueCategory: null,
        issueSeverity: null,
        issueStatus: null,
        occurredOn: '2026-07-02',
        photos: [],
        plantingId: 'tomato-1',
        structureId: null,
        targetLabel: 'Tomato',
        targetType: 'planting',
        title: 'Watered Tomato',
        type: 'note',
        weatherSnapshotId: 'weather-1',
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
        widthFt: 6,
        depthFt: 4,
      },
    ],
    tasks: [
      {
        bedLabel: 'Main bed',
        completedAtIso: '2026-07-03T12:00:00.000Z',
        createdAtIso: '2026-07-01T12:05:00.000Z',
        deferredUntilDate: null,
        dueDate: '2026-07-03',
        gardenId: 'user-a',
        id: 'task-1',
        notes: '',
        plantingId: 'tomato-1',
        priority: 'high',
        snoozedUntilDate: null,
        source: 'manual',
        sourceId: 'issue-1',
        status: 'done',
        structureId: null,
        title: 'Follow up: Aphids',
        type: 'inspect',
      },
      {
        bedLabel: 'Main bed',
        completedAtIso: '2026-07-03T13:00:00.000Z',
        createdAtIso: '2026-07-01T12:10:00.000Z',
        deferredUntilDate: null,
        dueDate: '2026-07-03',
        gardenId: 'user-a',
        id: 'task-water-1',
        notes: 'Routine watering was already captured by the watering note.',
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
  };
}
