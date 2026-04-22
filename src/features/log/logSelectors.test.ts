import {
  createDefaultGarden,
  createDefaultPlanting,
  type Garden,
} from '../../domain/gardens/GardenRepository';
import {
  buildIssueTimeline,
  filterHarvests,
  filterJournalEntries,
  getIssueLinkedTasks,
  getPhotoEntries,
} from './logSelectors';

describe('logSelectors', () => {
  it('filters journal entries by search, target, issue status, and photos', () => {
    const garden = createLogGarden();

    expect(
      filterJournalEntries(garden.journalEntries, {
        issueStatus: 'open',
        query: 'aphids',
        targetId: 'planting:tomato-1',
      }).map((entry) => entry.id),
    ).toEqual(['issue-1']);
    expect(
      getPhotoEntries(garden.journalEntries).map((entry) => entry.id),
    ).toEqual(['issue-1']);
  });

  it('filters harvests and links issue follow-up tasks', () => {
    const garden = createLogGarden();
    const issue = garden.journalEntries[0];

    expect(issue).toBeDefined();
    if (!issue) {
      return;
    }

    const linkedTasks = getIssueLinkedTasks(garden, issue);

    expect(
      filterHarvests(garden, garden.harvestEvents, {
        issueStatus: 'all',
        query: 'tomato',
        targetId: 'planting:tomato-1',
      }),
    ).toHaveLength(1);
    expect(linkedTasks[0]).toMatchObject({ sourceId: 'issue-1' });
    expect(
      buildIssueTimeline(issue, linkedTasks).map((event) => event.label),
    ).toEqual(expect.arrayContaining(['Opened on 2026-07-01']));
  });
});

function createLogGarden(): Garden {
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
        createdAtIso: '2026-07-01T12:00:00.000Z',
        gardenId: 'user-a',
        id: 'issue-1',
        issueCategory: 'pest',
        issueSeverity: 'high',
        issueStatus: 'open',
        occurredOn: '2026-07-01',
        photos: [
          {
            contentType: 'image/jpeg',
            downloadUrl: 'mock://photo',
            fileName: 'aphids.jpg',
            id: 'photo-1',
            sizeBytes: 1200,
            storagePath: 'mock/photo',
            uploadedAtIso: '2026-07-01T12:00:00.000Z',
          },
        ],
        plantingId: 'tomato-1',
        structureId: null,
        targetLabel: 'Tomato',
        targetType: 'planting',
        title: 'Aphids',
        type: 'issue',
        weatherSnapshotId: null,
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
    tasks: [
      {
        bedLabel: 'Main bed',
        completedAtIso: null,
        createdAtIso: '2026-07-01T12:05:00.000Z',
        deferredUntilDate: null,
        dueDate: '2026-07-01',
        gardenId: 'user-a',
        id: 'task-1',
        notes: '',
        plantingId: 'tomato-1',
        priority: 'high',
        snoozedUntilDate: null,
        source: 'manual',
        sourceId: 'issue-1',
        status: 'open',
        structureId: null,
        title: 'Follow up: Aphids',
        type: 'inspect',
      },
    ],
  };
}
