import {
  createDefaultGarden,
  createDefaultPlanting,
  type JournalEntry,
} from '../../../domain/gardens/GardenRepository';
import { MockGardenRepository } from './mockGardenRepository';

describe('MockGardenRepository', () => {
  it('persists per-user drafts without publishing immediately', async () => {
    const repository = new MockGardenRepository();
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        createDefaultPlanting({
          id: 'planting-1',
          label: 'Tomato',
          xFt: 3.5,
          yFt: 2,
        }),
      ],
    };

    await repository.saveGarden(garden);

    expect(await repository.getGarden('user-a')).toEqual(garden);

    const workspaceA = await repository.getWorkspace('user-a');
    const workspaceB = await repository.getWorkspace('user-b');

    expect(workspaceA.draftChanged).toBe(true);
    expect(workspaceA.published.garden.plantings).toHaveLength(0);
    expect(workspaceB.draft.garden.plantings).toHaveLength(0);
  });

  it('publishes a draft as a versioned shared revision', async () => {
    const repository = new MockGardenRepository();
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        createDefaultPlanting({
          id: 'planting-1',
          label: 'Tomato',
          xFt: 3.5,
          yFt: 2,
        }),
      ],
    };

    await repository.saveGarden(garden);

    const result = await repository.publishDraft({
      userEmail: 'primary.gardener@example.com',
      userId: 'user-a',
    });
    const workspaceB = await repository.getWorkspace('user-b');

    expect(result.status).toBe('published');
    expect(result.revision?.changesetSummary.plantingsAdded).toBe(1);
    expect(workspaceB.published.id).toBe(result.revision?.id);
    expect(workspaceB.draft.garden.plantings).toHaveLength(1);
  });

  it('shares feed operations immediately while keeping plan drafts private', async () => {
    const repository = new MockGardenRepository();
    const primaryWorkspace = await repository.getWorkspace('user-primary');
    const partnerWorkspace = await repository.getWorkspace('user-partner');
    const issue: JournalEntry = {
      body: 'Aphids under the leaves.',
      createdAtIso: '2026-07-01T12:00:00.000Z',
      gardenId: partnerWorkspace.draft.garden.id,
      id: 'issue-partner',
      issueCategory: 'pest',
      issueSeverity: 'medium',
      issueStatus: 'open',
      occurredOn: '2026-07-01',
      photos: [],
      plantingId: null,
      structureId: null,
      targetLabel: 'Whole garden',
      targetType: 'garden',
      title: 'Aphids',
      type: 'issue',
      weatherSnapshotId: null,
    };

    await repository.saveDraft({
      ...primaryWorkspace.draft,
      garden: {
        ...primaryWorkspace.draft.garden,
        plantings: [
          createDefaultPlanting({
            id: 'primary-private-tomato',
            label: 'Private tomato',
            xFt: 2,
            yFt: 2,
          }),
        ],
      },
    });
    await repository.saveSharedOperations({
      actor: {
        displayName: 'Partner Gardener',
        email: 'partner.gardener@example.com',
        userId: 'user-partner',
      },
      baseGarden: partnerWorkspace.draft.garden,
      updatedGarden: {
        ...partnerWorkspace.draft.garden,
        journalEntries: [issue],
      },
      userId: 'user-partner',
    });

    const primaryAfterIssue = await repository.getWorkspace('user-primary');
    const partnerAfterIssue = await repository.getWorkspace('user-partner');

    expect(primaryAfterIssue.draft.garden.journalEntries).toMatchObject([
      {
        createdByDisplayName: 'Partner Gardener',
        id: 'issue-partner',
        title: 'Aphids',
      },
    ]);
    expect(partnerAfterIssue.draft.garden.journalEntries).toMatchObject([
      {
        createdByDisplayName: 'Partner Gardener',
        id: 'issue-partner',
      },
    ]);
    expect(partnerAfterIssue.draft.garden.plantings).toHaveLength(0);
    expect(primaryAfterIssue.draft.garden.plantings).toHaveLength(1);
  });

  it('returns a stale-base conflict when published changed after draft start', async () => {
    const repository = new MockGardenRepository();
    const draftA = await repository.getWorkspace('user-a');
    const draftB = await repository.getWorkspace('user-b');

    await repository.saveDraft({
      ...draftA.draft,
      garden: {
        ...draftA.draft.garden,
        plantings: [
          createDefaultPlanting({
            id: 'planting-a',
            label: 'Tomato',
            xFt: 2,
            yFt: 2,
          }),
        ],
      },
    });
    await repository.saveDraft({
      ...draftB.draft,
      garden: {
        ...draftB.draft.garden,
        structures: [],
      },
    });
    await repository.publishDraft({
      userEmail: 'primary.gardener@example.com',
      userId: 'user-a',
    });

    const conflict = await repository.publishDraft({
      userEmail: 'partner.gardener@example.com',
      userId: 'user-b',
    });

    expect(conflict.status).toBe('conflict');
    expect(conflict.conflict?.draftBaseRevisionId).toBe('revision-initial');
  });

  it('reverts a prior published revision cleanly', async () => {
    const repository = new MockGardenRepository();
    const initial = await repository.getWorkspace('user-a');
    const garden = {
      ...initial.draft.garden,
      plantings: [
        createDefaultPlanting({
          id: 'planting-1',
          label: 'Tomato',
          xFt: 3.5,
          yFt: 2,
        }),
      ],
    };

    await repository.saveGarden(garden);
    await repository.publishDraft({
      userEmail: 'primary.gardener@example.com',
      userId: 'user-a',
    });

    const revert = await repository.revertToRevision({
      revisionId: initial.published.id,
      userEmail: 'partner.gardener@example.com',
      userId: 'user-b',
    });

    expect(revert.status).toBe('published');
    expect(revert.revision?.action).toBe('revert');
    expect(revert.workspace.published.garden.plantings).toHaveLength(0);
    expect(revert.workspace.draft.garden.userId).toBe('user-b');
  });
});
