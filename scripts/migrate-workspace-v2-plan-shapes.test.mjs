import { describe, expect, it } from 'vitest';

import {
  collectionsAreCurrent,
  isCurrentCore,
  isV2Draft,
  isV2Revision,
} from './migrate-workspace-v2-plan-shapes.mjs';

describe('workspace v2 current-plan detection', () => {
  it.each([
    ['wateringStage', { wateringStageSource: 'manual' }],
    ['wateringStageSource', { wateringStage: 'mature' }],
  ])('rejects a schema-9 planting missing %s', (_missingField, stageFields) => {
    const plan = {
      id: 'garden-main',
      plantings: [{ id: 'tomatoes', lifecycle: 'growing', ...stageFields }],
      schemaVersion: 9,
    };
    const published = {
      plan,
      publishedAtIso: '2026-07-09T12:00:00.000Z',
      publishedByUserId: 'user-a',
      revisionId: 'revision-current',
    };
    const revision = {
      data: { ...published, changeSummary: 'Current' },
      id: published.revisionId,
    };
    const draft = {
      data: {
        baseRevisionId: published.revisionId,
        plan,
        userId: 'user-a',
      },
      id: 'user-a',
    };

    expect(
      isCurrentCore(
        {
          publishedRevisionId: published.revisionId,
          schemaVersion: 2,
        },
        published,
      ),
    ).toBe(false);
    expect(isV2Revision(revision)).toBe(false);
    expect(isV2Draft(draft)).toBe(false);
    expect(
      collectionsAreCurrent(
        {
          drafts: [draft],
          revisions: [revision],
        },
        published.revisionId,
      ),
    ).toBe(false);
  });
});
