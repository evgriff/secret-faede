import { describe, expect, it } from 'vitest';

import {
  createDefaultGarden,
  createDefaultPlanting,
} from '../../domain/gardens/GardenRepository';
import type { ReviewSuggestion } from '../garden/reviewSuggestionModel';
import { findPlanWarnings } from '../garden/gardenPlanning';
import { generateAutoLayoutCandidates } from './autoLayoutEngine';
import { createLayoutFixture, createSunLayer } from './autoLayoutTestFixtures';
import {
  buildAutoLayoutProposalDiffOverlay,
  buildReviewSuggestionDiffOverlay,
} from './proposalDiffOverlay';

describe('proposal diff overlay', () => {
  it('shows generated layout additions as draft-safe overlay geometry', () => {
    const garden = createLayoutFixture();
    const sunLayer = createSunLayer(garden);
    const [candidate] = generateAutoLayoutCandidates(garden, { sunLayer });

    if (!candidate) {
      throw new Error('Expected a layout suggestion.');
    }

    const overlay = buildAutoLayoutProposalDiffOverlay({
      candidate,
      currentWarnings: findPlanWarnings(garden, {
        sunLayer,
        sunSeason: 'summer',
      }),
      garden,
      sunLayer,
      sunSeason: 'summer',
    });

    expect(overlay.title).toBe('Layout suggestion');
    expect(overlay.summary.addedCount).toBeGreaterThan(0);
    expect(overlay.afterRects.some((rect) => rect.kind === 'added')).toBe(true);
  });

  it('connects review proposal before and after positions in feet', () => {
    const planting = createDefaultPlanting({
      id: 'tomato-1',
      label: 'Tomato',
      xFt: 1,
      yFt: 1,
    });
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [planting],
    };
    const suggestion: ReviewSuggestion = {
      actions: [
        {
          id: planting.id,
          kind: 'updatePlanting',
          values: { xFt: 3, yFt: 2 },
        },
      ],
      canBatchAccept: false,
      id: 'review:move-tomato',
      itemIds: [planting.id],
      preview: { after: 'Move to 3, 2 ft', before: '1, 1 ft' },
      rationale: 'Move tomato to improve access.',
      severity: 'warning',
      source: 'selfFix',
      sourceWarningId: null,
      title: 'Move tomato',
      type: 'reassignCropToBed',
    };

    const overlay = buildReviewSuggestionDiffOverlay({
      garden,
      suggestion,
    });

    expect(overlay.summary.movedCount).toBe(1);
    expect(overlay.connectors).toEqual([
      expect.objectContaining({
        from: expect.objectContaining({ xFt: 1, yFt: 1 }),
        to: expect.objectContaining({ xFt: 3, yFt: 2 }),
      }),
    ]);
  });
});
