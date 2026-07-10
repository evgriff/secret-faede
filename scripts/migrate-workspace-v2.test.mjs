import { describe, expect, it, vi } from 'vitest';

import {
  migrateLegacyGarden,
  migrateLegacyOperations,
} from '../src/v2/data/legacyMigration';
import {
  currentCollections,
  legacyGarden,
  productionFixture,
  v2Published,
} from './migrate-workspace-v2-fixture.mjs';
import { FirestoreRestClient } from './migrate-workspace-v2-firestore.mjs';
import { addWaterCandidateWrites } from './migrate-workspace-v2-plan-actions.mjs';
import {
  buildMigrationPlan,
  migrationCollectionPaths,
  migrateLegacyProfile,
  parseMigrationOptions,
} from './migrate-workspace-v2.mjs';

const nowIso = '2026-07-09T12:00:00.000Z';

describe('workspace v2 production migration', () => {
  it('attributes converted legacy water to the migration actor', () => {
    const actions = [];
    const warnings = [];
    addWaterCandidateWrites(
      actions,
      [
        {
          actualAmountInches: 0.4,
          legacyJournalId: 'water-note-1',
          occurredOn: '2026-07-08',
          plantingGroupId: 'tomatoes',
        },
      ],
      nowIso,
      warnings,
    );

    expect(actions[0]).toMatchObject({
      data: {
        cropGroupId: 'tomatoes',
        recordedByUserId: 'migration',
      },
      path: 'gardenWorkspaces/main/waterApplications/migration-water-note-1',
    });
  });

  it('is dry-run by default and requires an explicit project', () => {
    expect(
      parseMigrationOptions([], { FIREBASE_PROJECT_ID: 'garden-prod' }),
    ).toEqual({ apply: false, dryRun: true, projectId: 'garden-prod' });
    expect(
      parseMigrationOptions(['--apply', '--project', 'chosen'], {}),
    ).toEqual({ apply: true, dryRun: false, projectId: 'chosen' });
    expect(() => parseMigrationOptions([], {})).toThrow(/project/i);
  });

  it('uses idempotent REST deletes for reviewed cleanup actions', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });
    vi.stubGlobal('fetch', fetchMock);
    try {
      await new FirestoreRestClient('garden-prod', 'token').delete(
        'gardenWorkspaces/main/notifications/old',
      );
    } finally {
      vi.unstubAllGlobals();
    }
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/gardenWorkspaces/main/notifications/old'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('is idempotent only when core and every client-read collection are v2', async () => {
    const migrateGarden = vi.fn();
    const migrateOperations = vi.fn();
    const published = v2Published();
    const result = await buildMigrationPlan({
      collections: currentCollections(published),
      migrateGarden,
      migrateOperations,
      nowIso,
      publishedDocument: published,
      workspace: {
        publishedRevisionId: published.revisionId,
        schemaVersion: 2,
      },
    });

    expect(result.alreadyCurrent).toBe(true);
    expect(result.actions).toEqual([]);
    expect(migrateGarden).not.toHaveBeenCalled();
    expect(migrateOperations).not.toHaveBeenCalled();
  });

  it('migrates the production-shaped root, history, drafts, and shared operations', async () => {
    const fixture = productionFixture();
    const result = await buildMigrationPlan({
      collections: fixture.collections,
      migrateGarden: migrateLegacyGarden,
      migrateOperations: migrateLegacyOperations,
      nowIso,
      publishedDocument: null,
      workspace: fixture.workspace,
    });

    expect(result.alreadyCurrent).toBe(false);
    expect(result.revisionId).toBe('migration-v2-revision-live');
    expect(paths(result, 'write', '/revisions/')).toEqual(
      expect.arrayContaining([
        'gardenWorkspaces/main/revisions/revision-1',
        'gardenWorkspaces/main/revisions/revision-2',
        'gardenWorkspaces/main/revisions/revision-3',
        'gardenWorkspaces/main/revisions/revision-live',
        'gardenWorkspaces/main/revisions/migration-v2-revision-live',
      ]),
    );
    expect(paths(result, 'delete', '/revisions/')).toEqual([]);
    expect(paths(result, 'write', '/tasks/')).toHaveLength(105);
    expect(paths(result, 'delete', '/weatherSnapshots/')).toHaveLength(8);
    expect(paths(result, 'delete', '/notifications/')).toHaveLength(1);
    expect(paths(result, 'delete', '/wateringSchedule/')).toHaveLength(1);
    expect(paths(result, 'write', '/legacyRevisionArchive/')).toHaveLength(4);
    expect(result.actions.at(-1)).toMatchObject({
      kind: 'write',
      path: 'gardenWorkspaces/main',
      phase: 'metadata',
    });
    expect(
      result.actions.every(
        (action) =>
          action.path === 'gardenWorkspaces/main' ||
          action.path === 'gardenWorkspaces/main/plans/published' ||
          Object.values(migrationCollectionPaths).some((collection) =>
            action.path.startsWith(`${collection}/`),
          ),
      ),
    ).toBe(true);
    expect(
      writeData(result, 'gardenWorkspaces/main/journal/issue-1'),
    ).toMatchObject({
      category: 'pest',
      photos: [
        expect.objectContaining({
          storagePath: 'gardenWorkspaces/main/journal/issue-1/user-a/photo.jpg',
        }),
      ],
      severity: 'high',
      status: 'open',
      type: 'issue',
    });
    expect(
      writeData(result, 'gardenWorkspaces/main/journal/water-unknown'),
    ).toEqual(expect.any(Object));
    expect(
      result.actions.some((action) =>
        action.path.includes('waterApplications/migration-water-unknown'),
      ),
    ).toBe(false);
    expect(result.archivedLegacy).toMatchObject({
      notifications: 1,
      revisions: 4,
      wateringSchedule: 1,
      weatherSnapshots: 8,
    });

    const finalDocuments = applyActions(fixture.collections, result.actions);
    expect(
      collectionValues(finalDocuments, 'revisions').every(
        (revision) =>
          revision.plan?.schemaVersion === 9 &&
          revision.revisionId === revision.__documentId,
      ),
    ).toBe(true);
    expect(
      collectionValues(finalDocuments, 'journal').every(
        (entry) =>
          ['garden', 'plantingGroup', 'structure'].includes(
            entry.target?.kind,
          ) &&
          (entry.type !== 'issue' ||
            Boolean(entry.category && entry.severity && entry.status)),
      ),
    ).toBe(true);
    expect(
      collectionValues(finalDocuments, 'tasks').every((task) =>
        Boolean(task.dueOn && task.updatedAtIso && task.target?.kind),
      ),
    ).toBe(true);
    expect(collectionValues(finalDocuments, 'notifications')).toEqual([]);
    expect(collectionValues(finalDocuments, 'wateringSchedule')).toEqual([]);
    expect(collectionValues(finalDocuments, 'weatherSnapshots')).toEqual([]);
  });

  it('does not report current while legacy leftovers remain beside a v2 core', async () => {
    const published = v2Published();
    const collections = currentCollections(published);
    collections.revisions.push({
      data: { garden: legacyGarden('Old history'), id: 'legacy-history' },
      id: 'legacy-history',
    });
    collections.journal.push({
      data: {
        body: 'Shared legacy note',
        createdAtIso: nowIso,
        id: 'legacy-note',
        occurredOn: '2026-07-08',
        title: 'Legacy note',
        type: 'note',
      },
      id: 'legacy-note',
    });
    collections.weatherSnapshots.push({
      data: { capturedAtIso: nowIso, id: 'legacy-weather', source: 'manual' },
      id: 'legacy-weather',
    });
    const result = await buildMigrationPlan({
      collections,
      migrateGarden: migrateLegacyGarden,
      migrateOperations: migrateLegacyOperations,
      nowIso,
      publishedDocument: published,
      workspace: {
        publishedRevisionId: published.revisionId,
        schemaVersion: 2,
      },
    });

    expect(result.alreadyCurrent).toBe(false);
    expect(
      writeData(result, 'gardenWorkspaces/main/revisions/legacy-history'),
    ).toMatchObject({
      plan: { schemaVersion: 9 },
      revisionId: 'legacy-history',
    });
    expect(
      writeData(result, 'gardenWorkspaces/main/journal/legacy-note'),
    ).toMatchObject({ target: { kind: 'garden' }, type: 'note' });
    expect(paths(result, 'delete', '/weatherSnapshots/')).toContain(
      'gardenWorkspaces/main/weatherSnapshots/legacy-weather',
    );
    expect(
      result.actions.some((action) => action.path === 'gardenWorkspaces/main'),
    ).toBe(false);
  });

  it('uses shared subcollection records over stale embedded duplicates', async () => {
    const garden = legacyGarden('Garden with embedded operations');
    garden.journalEntries = [
      {
        body: 'Stale embedded body',
        id: 'same-note',
        occurredOn: '2026-07-01',
        title: 'Embedded note',
        type: 'note',
      },
    ];
    const result = await buildMigrationPlan({
      collections: {
        drafts: [],
        journal: [
          {
            data: {
              body: 'Authoritative shared body',
              id: 'same-note',
              occurredOn: '2026-07-08',
              title: 'Shared note',
              type: 'note',
            },
            id: 'same-note',
          },
        ],
        profiles: [],
        revisions: [],
      },
      migrateGarden: migrateLegacyGarden,
      migrateOperations: migrateLegacyOperations,
      nowIso,
      publishedDocument: null,
      workspace: { garden, id: 'revision-shared' },
    });

    expect(
      writeData(result, 'gardenWorkspaces/main/journal/same-note'),
    ).toMatchObject({
      body: 'Authoritative shared body',
      occurredOn: '2026-07-08',
    });
  });

  it('normalizes legacy profiles without retaining old fields', () => {
    const migrated = migrateLegacyProfile(
      {
        email: 'grower@example.com',
        notificationPreference: {
          alertTypes: { watering: false },
          defaultWateringCheckTime: '06:15',
          quietHours: { endLocalTime: '08:00', startLocalTime: '22:00' },
          wateringAlertThresholdIn: 0.4,
        },
        timezone: 'Not/A-Timezone',
        uid: 'old-id',
      },
      'user-a',
      nowIso,
    );
    expect(migrated).toMatchObject({
      notificationPreferences: {
        alertKinds: { watering: false },
        dailyCheckTime: '06:15',
        minimumWateringDeficitInches: 0.4,
        quietHours: { end: '08:00', start: '22:00' },
      },
      schemaVersion: 2,
      timezone: 'UTC',
      userId: 'user-a',
    });
  });
});

function paths(result, kind, fragment) {
  return result.actions
    .filter((action) => action.kind === kind && action.path.includes(fragment))
    .map((action) => action.path);
}

function writeData(result, path) {
  return result.actions.find(
    (action) => action.kind === 'write' && action.path === path,
  )?.data;
}

function applyActions(collections, actions) {
  const prefixes = {
    harvests: 'gardenWorkspaces/main/harvests',
    journal: 'gardenWorkspaces/main/journal',
    notifications: 'gardenWorkspaces/main/notifications',
    revisions: 'gardenWorkspaces/main/revisions',
    tasks: 'gardenWorkspaces/main/tasks',
    waterApplications: 'gardenWorkspaces/main/waterApplications',
    wateringSchedule: 'gardenWorkspaces/main/wateringSchedule',
    weatherSnapshots: 'gardenWorkspaces/main/weatherSnapshots',
  };
  const documents = new Map();
  for (const [collection, prefix] of Object.entries(prefixes)) {
    for (const document of collections[collection] ?? []) {
      documents.set(`${prefix}/${document.id}`, document.data);
    }
  }
  for (const action of actions) {
    if (action.kind === 'delete') documents.delete(action.path);
    else documents.set(action.path, action.data);
  }
  return documents;
}

function collectionValues(documents, collection) {
  const prefix = `gardenWorkspaces/main/${collection}/`;
  return [...documents.entries()]
    .filter(([path]) => path.startsWith(prefix))
    .map(([path, data]) => ({
      ...data,
      __documentId: path.slice(prefix.length),
    }));
}
