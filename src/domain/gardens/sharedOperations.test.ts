import {
  applyActorToNewSharedOperations,
  applySharedGardenOperationsPatch,
  createDefaultGarden,
  getSharedGardenOperations,
  type JournalEntry,
} from './GardenRepository';

describe('sharedOperations', () => {
  it('adds durable actor metadata to new Feed entries', () => {
    const baseGarden = createDefaultGarden('user-evan');
    const entry: JournalEntry = {
      body: 'Slug damage on lettuce.',
      createdAtIso: '2026-07-01T12:00:00.000Z',
      gardenId: 'user-emma',
      id: 'issue-emma',
      issueCategory: 'pest',
      issueSeverity: 'medium',
      issueStatus: 'open',
      occurredOn: '2026-07-01',
      photos: [],
      plantingId: null,
      structureId: null,
      targetLabel: 'Whole garden',
      targetType: 'garden',
      title: 'Slug damage',
      type: 'issue',
      weatherSnapshotId: null,
    };

    const updatedGarden = applyActorToNewSharedOperations({
      actor: {
        displayName: 'Partner Gardener',
        email: 'partner.gardener@example.com',
        userId: 'user-emma',
      },
      baseGarden,
      updatedGarden: {
        ...baseGarden,
        journalEntries: [entry],
      },
    });

    expect(updatedGarden.journalEntries[0]).toMatchObject({
      createdByDisplayName: 'Partner Gardener',
      createdByEmail: 'partner.gardener@example.com',
      createdByUserId: 'user-emma',
    });
  });

  it('keeps operation patches from deleting unseen newer shared entries', () => {
    const baseGarden = createDefaultGarden('user-evan');
    const emmaEntry = {
      body: 'Partner Gardener issue',
      createdAtIso: '2026-07-01T12:00:00.000Z',
      gardenId: 'user-emma',
      id: 'issue-emma',
      issueCategory: 'pest' as const,
      issueSeverity: 'medium' as const,
      issueStatus: 'open' as const,
      occurredOn: '2026-07-01',
      photos: [],
      plantingId: null,
      structureId: null,
      targetLabel: 'Whole garden',
      targetType: 'garden' as const,
      title: 'Partner Gardener issue',
      type: 'issue' as const,
      weatherSnapshotId: null,
    };
    const evanEntry = {
      ...emmaEntry,
      body: 'Primary Gardener issue',
      id: 'issue-evan',
      title: 'Primary Gardener issue',
    };

    const nextOperations = applySharedGardenOperationsPatch({
      base: getSharedGardenOperations(baseGarden),
      current: getSharedGardenOperations({
        ...baseGarden,
        journalEntries: [emmaEntry],
      }),
      updated: getSharedGardenOperations({
        ...baseGarden,
        journalEntries: [evanEntry],
      }),
    });

    expect(nextOperations.journalEntries.map((entry) => entry.id)).toEqual([
      'issue-emma',
      'issue-evan',
    ]);
  });
});
