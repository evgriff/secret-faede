import {
  createDefaultGarden,
  createDefaultPlanting,
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
