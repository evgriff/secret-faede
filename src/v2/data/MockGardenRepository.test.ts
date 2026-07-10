import { describe, expect, it } from 'vitest';

import { createEmptyGardenPlan } from './defaultPlan';
import type { WaterApplication } from '../domain';
import {
  MockGardenRepository,
  type KeyValueStorage,
} from './MockGardenRepository';

class MemoryStorage implements KeyValueStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe('v2 mock garden repository', () => {
  it('keeps one published workspace and one private draft per user', async () => {
    const repository = createRepository();
    const primary = await repository.getWorkspace('primary');
    const plan = structuredClone(primary.published.plan);
    plan.name = 'Primary draft';

    await repository.saveDraft({
      expectedRevisionId: primary.published.revisionId,
      plan,
      userId: 'primary',
    });

    expect((await repository.getWorkspace('primary')).draft?.plan.name).toBe(
      'Primary draft',
    );
    expect((await repository.getWorkspace('partner')).draft).toBeNull();
    expect((await repository.getWorkspace('partner')).published.plan.name).toBe(
      'Home garden',
    );
  });

  it('rejects stale draft and publish writes with a conflict result', async () => {
    const repository = createRepository();
    const workspace = await repository.getWorkspace('primary');
    const plan = structuredClone(workspace.published.plan);
    plan.name = 'Draft';

    expect(
      await repository.saveDraft({
        expectedRevisionId: 'stale-revision',
        plan,
        userId: 'primary',
      }),
    ).toEqual(
      expect.objectContaining({
        actualRevisionId: workspace.published.revisionId,
        status: 'conflict',
      }),
    );
  });

  it('upserts only revisioned watering corrections with stable ownership', async () => {
    const repository = createRepository();
    const application: WaterApplication = {
      amount: { depthInches: 0.4, unit: 'inches' },
      appliedAtIso: '2026-07-09T12:00:00.000Z',
      cropGroupId: 'tomato-group',
      efficiency: {
        confidence: 'medium',
        fraction: 0.8,
        source: 'estimated',
      },
      id: 'water-1',
      method: 'hand',
      outcome: 'applied',
      recordedAtIso: '2026-07-09T12:01:00.000Z',
      recordedByUserId: 'primary',
      revision: 1,
    };

    await repository.recordWaterApplication(application);
    await repository.recordWaterApplication({
      ...application,
      outcome: 'partial',
      revision: 2,
    });
    expect(
      (await repository.getWorkspace('primary')).operations
        .waterApplications[0],
    ).toMatchObject({ outcome: 'partial', revision: 2 });
    await expect(
      repository.recordWaterApplication({
        ...application,
        recordedByUserId: 'partner',
        revision: 3,
      }),
    ).rejects.toThrow(/preserve/i);
    await expect(
      repository.recordWaterApplication({ ...application, revision: 2 }),
    ).rejects.toThrow(/increment/i);
  });

  it('publishes and reverts as new immutable revisions', async () => {
    const repository = createRepository();
    const initial = await repository.getWorkspace('primary');
    const plan = structuredClone(initial.published.plan);
    plan.name = 'Published once';
    await repository.saveDraft({
      expectedRevisionId: initial.published.revisionId,
      plan,
      userId: 'primary',
    });
    await repository.publishDraft({
      changeSummary: 'First publish',
      expectedRevisionId: initial.published.revisionId,
      userId: 'primary',
    });
    const afterPublish = await repository.getWorkspace('primary');

    await repository.revertPublished({
      expectedRevisionId: afterPublish.published.revisionId,
      revisionId: 'revision-initial',
      userId: 'primary',
    });

    const restored = await repository.getWorkspace('primary');
    expect(restored.published.plan.name).toBe('Home garden');
    expect(restored.published.revisionId).not.toBe('revision-initial');
    expect(restored.published.revisionId).not.toBe(
      afterPublish.published.revisionId,
    );
    expect(restored.recentRevisions[0]?.changeSummary).toContain('Restored');
  });

  it('reports authoritative mock storage writes as committed while offline', async () => {
    const repository = createRepository(false);
    const workspace = await repository.getWorkspace('primary');

    expect(
      await repository.saveDraft({
        expectedRevisionId: workspace.published.revisionId,
        plan: workspace.published.plan,
        userId: 'primary',
      }),
    ).toEqual(expect.objectContaining({ status: 'committed' }));
  });

  it('publishes only shared settings and rebases the private draft intact', async () => {
    const repository = createRepository();
    const initial = await repository.getWorkspace('primary');
    const privatePlan = structuredClone(initial.published.plan);
    privatePlan.name = 'Private planting work';
    privatePlan.plot.widthFt = 20;
    await repository.saveDraft({
      expectedRevisionId: initial.published.revisionId,
      plan: privatePlan,
      userId: 'primary',
    });
    const supplied = structuredClone(privatePlan);
    supplied.name = 'Must stay private';
    supplied.plot.widthFt = 30;
    supplied.plot.climate = {
      firstFrost: '10-20',
      hardinessZone: '7a',
      lastFrost: '04-20',
    };
    supplied.plot.location = {
      coordinates: { latitude: 42.3314, longitude: -83.0458 },
      label: 'Detroit garden',
      query: 'Detroit, MI',
      timezone: 'America/Detroit',
    };

    await repository.publishSharedSettings({
      expectedRevisionId: initial.published.revisionId,
      plan: supplied,
      userId: 'primary',
    });

    const workspace = await repository.getWorkspace('primary');
    expect(workspace.published.plan).toMatchObject({
      name: 'Home garden',
      plot: {
        climate: supplied.plot.climate,
        location: supplied.plot.location,
        widthFt: 12,
      },
    });
    expect(workspace.draft).toMatchObject({
      baseRevisionId: workspace.published.revisionId,
      plan: {
        name: 'Private planting work',
        plot: {
          climate: supplied.plot.climate,
          location: supplied.plot.location,
          widthFt: 20,
        },
      },
    });
    expect(workspace.recentRevisions[0]?.changeSummary).toBe(
      'Updated shared garden settings',
    );
  });

  it('rejects shared settings publication when the private draft base is stale', async () => {
    const repository = createRepository();
    const initial = await repository.getWorkspace('primary');
    await repository.saveDraft({
      expectedRevisionId: initial.published.revisionId,
      plan: { ...initial.published.plan, name: 'Primary private changes' },
      userId: 'primary',
    });
    await repository.saveDraft({
      expectedRevisionId: initial.published.revisionId,
      plan: { ...initial.published.plan, name: 'Partner publication' },
      userId: 'partner',
    });
    await repository.publishDraft({
      changeSummary: 'Partner update',
      expectedRevisionId: initial.published.revisionId,
      userId: 'partner',
    });
    const current = await repository.getWorkspace('primary');

    expect(
      await repository.publishSharedSettings({
        expectedRevisionId: current.published.revisionId,
        plan: current.published.plan,
        userId: 'primary',
      }),
    ).toEqual(
      expect.objectContaining({
        actualRevisionId: current.published.revisionId,
        status: 'conflict',
      }),
    );
    expect((await repository.getWorkspace('primary')).draft?.plan.name).toBe(
      'Primary private changes',
    );
  });

  it('normalizes older mock state without losing a valid published plan', async () => {
    const storage = new MemoryStorage();
    const plan = createEmptyGardenPlan(new Date('2026-07-01T12:00:00.000Z'));
    plan.name = 'Saved garden';
    storage.setItem(
      'secret-faeries:v2:workspace',
      JSON.stringify({
        drafts: {
          broken: {
            baseRevisionId: 'revision-saved',
            plan: { schemaVersion: 8 },
            updatedAtIso: 'not-a-date',
            userId: 'broken',
          },
        },
        published: {
          plan,
          publishedAtIso: '2026-07-01T12:00:00.000Z',
          publishedByUserId: 'primary',
          revisionId: 'revision-saved',
        },
        revisions: [],
      }),
    );
    const repository = new MockGardenRepository({ storage });

    const workspace = await repository.getWorkspace('primary');

    expect(workspace.published.plan.name).toBe('Saved garden');
    expect(workspace.draft).toBeNull();
    expect(workspace.operations).toEqual({
      harvests: [],
      journal: [],
      tasks: [],
      waterApplications: [],
      wateringRecommendations: [],
    });
    expect(workspace.recentRevisions[0]?.revisionId).toBe('revision-saved');
  });

  it('surfaces malformed shared operation records instead of dropping them', async () => {
    for (const collection of [
      'harvests',
      'journal',
      'tasks',
      'waterApplications',
      'wateringRecommendations',
    ]) {
      const storage = new MemoryStorage();
      const repository = new MockGardenRepository({ storage });
      await repository.getWorkspace('primary');
      const state = JSON.parse(
        storage.getItem('secret-faeries:v2:workspace')!,
      ) as Record<string, unknown>;
      state[collection] = [{ id: 'malformed-record' }];
      const corruptRaw = JSON.stringify(state);
      storage.setItem('secret-faeries:v2:workspace', corruptRaw);

      await expect(repository.getWorkspace('primary')).rejects.toThrow(
        /saved mock garden is corrupt/i,
      );
      expect(storage.getItem('secret-faeries:v2:workspace')).toBe(corruptRaw);
    }
  });

  it('preserves corrupt published state instead of resetting the workspace', async () => {
    const storage = new MemoryStorage();
    const repository = new MockGardenRepository({ storage });
    await repository.getWorkspace('primary');
    const raw = storage.getItem('secret-faeries:v2:workspace')!;
    const state = JSON.parse(raw) as {
      published: { plan: { schemaVersion: number } };
    };
    state.published.plan.schemaVersion = 8;
    const corruptRaw = JSON.stringify(state);
    storage.setItem('secret-faeries:v2:workspace', corruptRaw);

    await expect(repository.getWorkspace('primary')).rejects.toThrow(
      /original data was preserved/i,
    );
    expect(storage.getItem('secret-faeries:v2:workspace')).toBe(corruptRaw);
  });
});

function createRepository(online = true) {
  return new MockGardenRepository({
    isOnline: () => online,
    now: () => new Date('2026-07-09T12:00:00.000Z'),
    storage: new MemoryStorage(),
  });
}
