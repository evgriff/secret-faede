import { describe, expect, it } from 'vitest';

import {
  calculate,
  makePlanting,
  target,
} from '../domain/watering/wateringTestFixtures';
import {
  assertValidHarvestRecord,
  assertValidJournalRecord,
  assertValidTaskRecord,
  assertValidWaterApplicationRecord,
} from './operationRecordValidation';
import { assertValidWateringRecommendationRecord } from './wateringRecommendationRecordValidation';

const nowIso = '2026-07-09T12:00:00.000Z';

describe('persisted operation-record validation', () => {
  it('accepts complete journal, harvest, task, and water records', () => {
    expect(() =>
      assertValidJournalRecord(journal(), 'journal-1'),
    ).not.toThrow();
    expect(() =>
      assertValidHarvestRecord(harvest(), 'harvest-1'),
    ).not.toThrow();
    expect(() => assertValidTaskRecord(task(), 'task-1')).not.toThrow();
    expect(() =>
      assertValidWaterApplicationRecord(waterApplication(), 'water-1'),
    ).not.toThrow();
    expect(() =>
      assertValidWaterApplicationRecord({
        ...waterApplication(),
        outcome: 'partial',
      }),
    ).not.toThrow();
  });

  it('rejects malformed shared fields and document-id mismatches', () => {
    expect(() =>
      assertValidJournalRecord(
        {
          ...journal(),
          photos: [
            {
              contentType: 'image/jpeg',
              fileName: 'leaf.jpg',
              height: null,
              id: 'photo-1',
              sizeBytes: 'large',
              storagePath: 'gardenWorkspaces/main/journal/journal-1/u/leaf.jpg',
              uploadedAtIso: nowIso,
              width: null,
            },
          ],
        },
        'journal-1',
      ),
    ).toThrow(/photo.*size/i);
    expect(() => assertValidHarvestRecord(harvest(), 'different-id')).toThrow(
      /document id/i,
    );
    expect(() =>
      assertValidTaskRecord({ ...task(), dueOn: '2026-02-30' }),
    ).toThrow(/due date/i);
    expect(() =>
      assertValidWaterApplicationRecord({
        ...waterApplication(),
        amount: { depthInches: 0, unit: 'inches' },
      }),
    ).toThrow(/water depth/i);
    expect(() =>
      assertValidWaterApplicationRecord({
        ...waterApplication(),
        recordedByUserId: '',
      }),
    ).toThrow(/recorder/i);
  });

  it('accepts a complete deterministic crop-group recommendation', () => {
    const recommendation = persistedRecommendation();

    expect(() =>
      assertValidWateringRecommendationRecord(recommendation, 'tomato-group'),
    ).not.toThrow();
  });

  it('rejects malformed or cross-crop recommendation documents', () => {
    const recommendation = persistedRecommendation();

    expect(() =>
      assertValidWateringRecommendationRecord(
        { ...recommendation, forecastRainCreditInches: Number.NaN },
        'tomato-group',
      ),
    ).toThrow(/forecast rain/i);
    expect(() =>
      assertValidWateringRecommendationRecord(
        recommendation,
        'different-crop-group',
      ),
    ).toThrow(/document id/i);
    expect(() =>
      assertValidWateringRecommendationRecord({
        ...recommendation,
        workspaceRevisionId: undefined,
      }),
    ).toThrow(/workspace revision/i);
  });
});

function journal() {
  return {
    body: 'Checked the north bed.',
    createdAtIso: nowIso,
    createdByUserId: 'user-1',
    id: 'journal-1',
    occurredOn: '2026-07-09',
    photos: [],
    target: { id: null, kind: 'garden', label: 'Garden' },
    title: 'Field note',
    type: 'note',
  };
}

function harvest() {
  return {
    amount: 2,
    createdAtIso: nowIso,
    createdByUserId: 'user-1',
    cropId: 'tomato',
    id: 'harvest-1',
    notes: '',
    occurredOn: '2026-07-09',
    plantingGroupId: 'tomato-group',
    unit: 'lb',
  };
}

function task() {
  return {
    completedAtIso: null,
    createdAtIso: nowIso,
    dueOn: '2026-07-09',
    id: 'task-1',
    kind: 'inspect',
    notes: '',
    priority: 'medium',
    reason: 'Routine check',
    sourceId: null,
    status: 'open',
    target: {
      id: 'tomato-group',
      kind: 'plantingGroup',
      label: 'Tomato',
    },
    title: 'Inspect tomato',
    updatedAtIso: nowIso,
  };
}

function waterApplication() {
  return {
    amount: { depthInches: 0.5, unit: 'inches' },
    appliedAtIso: nowIso,
    cropGroupId: 'tomato-group',
    efficiency: { confidence: 'high', fraction: 0.9, source: 'calibrated' },
    id: 'water-1',
    method: 'drip',
    outcome: 'applied',
    recordedAtIso: nowIso,
    recordedByUserId: 'user-1',
    revision: 1,
  };
}

function persistedRecommendation() {
  return {
    ...calculate({ targets: [target(makePlanting('tomato-group', 'Tomato'))] })
      .recommendations[0]!,
    workspaceRevisionId: 'revision-1',
  };
}
