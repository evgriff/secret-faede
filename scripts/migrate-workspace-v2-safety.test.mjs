import { describe, expect, it, vi } from 'vitest';

import {
  migrateLegacyGarden,
  migrateLegacyOperations,
} from '../src/v2/data/legacyMigration';
import {
  currentCollections,
  legacyGarden,
  v2Published,
} from './migrate-workspace-v2-fixture.mjs';
import {
  buildMigrationPlan,
  executeMigrationPlan,
} from './migrate-workspace-v2.mjs';
import { buildMigrationReport } from './migrate-workspace-v2-report.mjs';

const nowIso = '2026-07-09T12:00:00.000Z';

describe('workspace v2 migration safety', () => {
  it('never executes writes for a dry run or a blocked apply plan', async () => {
    const firestore = {
      delete: vi.fn(),
      write: vi.fn(),
    };
    const action = {
      data: { private: 'value' },
      kind: 'write',
      path: 'users/private-user',
    };

    await expect(
      executeMigrationPlan({
        firestore,
        options: { apply: false, dryRun: true },
        plan: { actions: [action], blockers: [], canApply: true },
      }),
    ).resolves.toBe('dry-run');
    await expect(
      executeMigrationPlan({
        firestore,
        options: { apply: true, dryRun: false },
        plan: {
          actions: [action],
          blockers: [{ code: 'missing-growing-area' }],
          canApply: false,
        },
      }),
    ).resolves.toBe('refused');
    expect(firestore.delete).not.toHaveBeenCalled();
    expect(firestore.write).not.toHaveBeenCalled();
  });

  it('redacts document identities and warning text from the report', () => {
    const report = buildMigrationReport({
      applyStatus: 'dry-run',
      backupPath: 'output/production-backups/workspace-v2-test.json',
      options: { dryRun: true, projectId: 'garden-prod' },
      plan: {
        actions: [
          {
            data: {},
            kind: 'write',
            path: 'users/private-user-id',
            phase: 'data',
          },
          {
            data: {},
            kind: 'write',
            path: 'gardenWorkspaces/main/revisions/private-revision-id',
            phase: 'data',
          },
        ],
        alreadyCurrent: false,
        archivedLegacy: {},
        blockers: [],
        canApply: true,
        revisionId: 'private-revision-id',
        warnings: ['private-entry-id: photo path was archived only'],
      },
    });
    const serialized = JSON.stringify(report);

    expect(serialized).not.toContain('private-user-id');
    expect(serialized).not.toContain('private-revision-id');
    expect(serialized).not.toContain('private-entry-id');
    expect(report.actionPlan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ target: 'users/<redacted>' }),
        expect.objectContaining({
          target: 'gardenWorkspaces/main/revisions/<redacted>',
        }),
      ]),
    );
    expect(report.warningSummary).toEqual([
      { category: 'legacy-photo-archived', count: 1 },
    ]);
  });

  it('returns a non-applying plan when the garden has no growing areas', async () => {
    const garden = legacyGarden('Blocked garden');
    garden.structures = [
      {
        depthFt: 1,
        id: 'path-1',
        label: 'Path',
        type: 'pathway',
        widthFt: 4,
        xFt: 0,
        yFt: 0,
      },
    ];
    const result = await buildMigrationPlan({
      collections: { drafts: [], profiles: [], revisions: [] },
      migrateGarden: migrateLegacyGarden,
      migrateOperations: migrateLegacyOperations,
      nowIso,
      publishedDocument: null,
      workspace: { garden, id: 'legacy-publication' },
    });

    expect(result.actions).toEqual([]);
    expect(result.canApply).toBe(false);
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'missing-growing-area',
          scope: 'published',
        }),
      ]),
    );
  });

  it('blocks an unconvertible revision before any cleanup action', async () => {
    const published = v2Published();
    const collections = currentCollections(published);
    collections.revisions.push({
      data: { garden: null, id: 'broken-history' },
      id: 'broken-history',
    });
    const result = await buildMigrationPlan({
      collections,
      migrateGarden: () => {
        throw new Error('malformed historical plan');
      },
      migrateOperations: migrateLegacyOperations,
      nowIso,
      publishedDocument: published,
      workspace: {
        publishedRevisionId: published.revisionId,
        schemaVersion: 2,
      },
    });

    expect(result.actions).toEqual([]);
    expect(result.canApply).toBe(false);
    expect(result.blockers).toEqual([
      {
        code: 'missing-legacy-source',
        scope: 'revision',
        sourceNumber: 1,
      },
    ]);
  });
});
