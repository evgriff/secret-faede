import { describe, expect, it } from 'vitest';

import { getCropById } from '../../domain/crops/cropCatalog';
import type { PlantingGroup } from '../domain';
import {
  migrateLegacyGarden,
  migrateLegacyOperations,
} from './legacyMigration';

describe('legacy v8 to v2 migration', () => {
  it('clears blank coordinates instead of turning them into zero', () => {
    const result = migrateLegacyGarden({
      id: 'garden',
      name: 'Garden',
      plot: {
        depthFt: 8,
        location: { latitude: '', longitude: '', timezone: 'America/Detroit' },
        widthFt: 12,
      },
    });

    expect(result.plan.plot.location.coordinates).toBeNull();
  });

  it('never credits skipped watering as an application', () => {
    const result = migrateLegacyGarden({
      id: 'garden',
      journalEntries: [
        {
          body: 'Skipped watering because rain arrived.',
          id: 'skip-1',
          occurredOn: '2026-07-09',
          title: 'Skipped watering',
        },
      ],
      name: 'Garden',
      plot: {
        depthFt: 8,
        location: { timezone: 'America/Detroit' },
        widthFt: 12,
      },
    });

    expect(result.waterApplications).toEqual([]);
    expect(result.warnings.join(' ')).toContain('not converted');
  });

  it('migrates only explicit water amounts using occurredOn', () => {
    const result = migrateLegacyGarden({
      id: 'garden',
      journalEntries: [
        {
          body: 'Applied 0.4 in by hand.',
          createdAtIso: '2026-07-10T01:00:00.000Z',
          id: 'water-1',
          occurredOn: '2026-07-08',
          plantingId: 'tomatoes',
          title: 'Watered tomatoes',
        },
      ],
      name: 'Garden',
      plot: {
        depthFt: 8,
        location: { timezone: 'America/Detroit' },
        widthFt: 12,
      },
    });

    expect(result.waterApplications).toEqual([
      expect.objectContaining({
        actualAmountInches: 0.4,
        occurredOn: '2026-07-08',
        plantingGroupId: 'tomatoes',
      }),
    ]);
    expect(result.operations.journal).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'water-1' })]),
    );
  });

  it('assigns a growing area only when the full footprint is unambiguous', () => {
    const result = migrateLegacyGarden({
      id: 'garden',
      name: 'Garden',
      plantings: [
        {
          blockDepthFt: 2,
          blockWidthFt: 2,
          cropId: 'basil',
          id: 'basil-group',
          label: 'Basil',
          xFt: 3,
          yFt: 3,
        },
      ],
      plot: {
        depthFt: 8,
        location: { timezone: 'America/Detroit' },
        widthFt: 12,
      },
      structures: [
        {
          depthFt: 4,
          id: 'bed-1',
          label: 'Bed',
          type: 'raisedBed',
          widthFt: 4,
          xFt: 1,
          yFt: 1,
        },
      ],
    });

    expect(result.plan.plantings[0]?.growingAreaStructureId).toBe('bed-1');
  });

  it.each([
    {
      source: 'manual',
      stage: 'flowering',
      status: 'growing',
    },
    {
      source: 'plantingEvent',
      stage: 'fruiting',
      status: 'growing',
    },
    {
      source: 'lifecycleFallback',
      stage: 'establishing',
      status: 'planted',
    },
  ] as const)(
    'preserves an explicit valid $source watering stage',
    ({ source, stage, status }) => {
      const planting = migrateOnePlanting({
        status,
        wateringStage: stage,
        wateringStageSource: source,
      });

      expect(planting).toMatchObject({
        lifecycle: status,
        wateringStage: stage,
        wateringStageSource: source,
      });
    },
  );

  it.each([
    ['planned', 'establishing'],
    ['planted', 'establishing'],
    ['growing', 'mature'],
    ['harvestReady', 'fruiting'],
    ['harvested', 'mature'],
    ['removed', 'mature'],
  ] as const)(
    'deterministically maps the %s lifecycle to the %s watering stage',
    (status, wateringStage) => {
      expect(migrateOnePlanting({ status })).toMatchObject({
        lifecycle: status,
        wateringStage,
        wateringStageSource: 'lifecycleFallback',
      });
    },
  );

  it('keeps a manual weekly water input at medium confidence for a partial crop profile', () => {
    expect(getCropById('strawberry-alpine')?.profileCompleteness).toBe(
      'partial',
    );

    expect(
      migrateOnePlanting({
        cropId: 'strawberry-alpine',
        weeklyWaterNeedInches: 0.65,
      }).waterProfile,
    ).toMatchObject({
      baseWeeklyInches: 0.65,
      confidence: 'medium',
      source: 'manual',
    });
  });

  it('converts issue photos, harvests, and tasks into complete v2 operation shapes', () => {
    const result = migrateLegacyOperations(
      {
        harvestEvents: [
          {
            cropId: 'tomato',
            harvestedOn: '2026-07-08',
            id: 'harvest-1',
            plantingId: 'tomatoes',
            quantity: 3,
            unit: 'count',
          },
        ],
        journalEntries: [
          {
            body: 'Aphids under leaves',
            createdAtIso: '2026-07-08T12:00:00.000Z',
            id: 'issue-1',
            issueCategory: 'pest',
            issueSeverity: 'high',
            issueStatus: 'open',
            occurredOn: '2026-07-08',
            photos: [
              {
                contentType: 'image/jpeg',
                fileName: 'aphids.jpg',
                id: 'photo-1',
                sizeBytes: 500,
                storagePath:
                  'gardenWorkspaces/main/journal/issue-1/user-a/aphids.jpg',
                uploadedAtIso: '2026-07-08T12:00:00.000Z',
              },
            ],
            plantingId: 'tomatoes',
            targetLabel: 'Tomatoes',
            title: 'Aphids',
            type: 'issue',
          },
        ],
        tasks: [
          {
            createdAtIso: '2026-07-08T12:00:00.000Z',
            dueDate: '2026-07-10',
            id: 'task-1',
            plantingId: 'tomatoes',
            priority: 'high',
            source: 'generated',
            status: 'open',
            title: 'Trellis tomatoes',
            type: 'trellis',
          },
        ],
      },
      new Date('2026-07-09T12:00:00.000Z'),
    );

    expect(result.operations.journal[0]).toMatchObject({
      category: 'pest',
      photos: [
        expect.objectContaining({
          height: null,
          storagePath:
            'gardenWorkspaces/main/journal/issue-1/user-a/aphids.jpg',
          width: null,
        }),
      ],
      severity: 'high',
      status: 'open',
      target: { id: 'tomatoes', kind: 'plantingGroup' },
      type: 'issue',
    });
    expect(result.operations.harvests[0]).toMatchObject({
      cropId: 'tomato',
      occurredOn: '2026-07-08',
      plantingGroupId: 'tomatoes',
    });
    expect(result.operations.tasks[0]).toMatchObject({
      dueOn: '2026-07-10',
      kind: 'support',
      status: 'open',
      target: { id: 'tomatoes', kind: 'plantingGroup' },
    });
  });

  it('retains unknown water notes without creating credit', () => {
    const result = migrateLegacyOperations({
      journalEntries: [
        {
          body: 'Watered thoroughly but did not measure the amount.',
          id: 'unknown-water',
          occurredOn: '2026-07-08',
          plantingId: 'tomatoes',
          title: 'Watered tomatoes',
          type: 'note',
        },
      ],
    });

    expect(result.operations.journal[0]).toMatchObject({ id: 'unknown-water' });
    expect(result.waterApplications).toEqual([]);
    expect(result.warnings.join(' ')).toMatch(/not credited/i);
  });

  it('keeps legacy persisted partial water with an honest legacy actor', () => {
    const result = migrateLegacyOperations({
      waterApplications: [
        {
          amount: { depthInches: 0.2, unit: 'inches' },
          appliedAtIso: '2026-07-08T12:00:00.000Z',
          cropGroupId: 'tomatoes',
          efficiency: {
            confidence: 'low',
            fraction: 0.8,
            source: 'estimated',
          },
          id: 'legacy-partial-water',
          method: 'hand',
          outcome: 'partial',
          recordedAtIso: '2026-07-08T12:05:00.000Z',
          revision: 1,
        },
      ],
    });

    expect(result.operations.waterApplications).toEqual([
      expect.objectContaining({
        id: 'legacy-partial-water',
        outcome: 'partial',
        recordedByUserId: 'legacy',
      }),
    ]);
  });

  it('archives unsafe photo metadata instead of exposing an obsolete path', () => {
    const result = migrateLegacyOperations({
      journalEntries: [
        {
          id: 'photo-note',
          occurredOn: '2026-07-08',
          photos: [
            {
              contentType: 'image/jpeg',
              id: 'unsafe-photo',
              storagePath: 'users/user-a/journal/photo.jpg',
            },
          ],
          title: 'Old photo',
          type: 'note',
        },
      ],
    });

    expect(result.operations.journal[0]?.photos).toEqual([]);
    expect(result.warnings.join(' ')).toMatch(/archived only/i);
  });
});

function migrateOnePlanting(overrides: Record<string, unknown>): PlantingGroup {
  const result = migrateLegacyGarden({
    id: 'garden',
    name: 'Garden',
    plantings: [
      {
        blockDepthFt: 1,
        blockWidthFt: 1,
        cropId: 'basil',
        id: 'test-planting',
        label: 'Test planting',
        xFt: 2,
        yFt: 2,
        ...overrides,
      },
    ],
    plot: {
      depthFt: 8,
      location: { timezone: 'America/Detroit' },
      widthFt: 12,
    },
    structures: [
      {
        depthFt: 4,
        id: 'bed-1',
        label: 'Bed',
        type: 'raisedBed',
        widthFt: 4,
        xFt: 0,
        yFt: 0,
      },
    ],
  });
  const planting = result.plan.plantings[0];
  if (!planting) throw new Error('Migration did not create a planting.');
  return planting;
}
