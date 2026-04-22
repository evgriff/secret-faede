import { describe, expect, it } from 'vitest';

import type { GardenSuggestionDecision } from '../../domain/gardens/gardenWorkspace';
import {
  describeSuggestionDecision,
  type ReviewSuggestion,
} from '../garden/reviewSuggestions';
import {
  buildReviewProposalInbox,
  getReviewProposalCategory,
  getReviewProposalNextAction,
  isBatchAcceptableReviewProposal,
} from './reviewProposalInbox';

describe('reviewProposalInbox', () => {
  it('separates open proposals from accepted, rejected, and snoozed decisions', () => {
    const support = createSuggestion({
      canBatchAccept: true,
      id: 'review:add-trellis:tomato-1',
      type: 'addTrellis',
    });
    const move = createSuggestion({
      id: 'review:move-tall-north:tomato-1',
      relocationImpact: 'plannedOnly',
      type: 'moveTallCropNorth',
    });
    const rejectedDecision: GardenSuggestionDecision = {
      decidedAtIso: '2026-04-21T12:00:00.000Z',
      id: move.id,
      impact: 'planned',
      label: move.title,
      note: move.rationale,
      status: 'rejected',
    };
    const inbox = buildReviewProposalInbox({
      reviewSuggestions: [support, move],
      suggestionDecisions: [rejectedDecision],
    });

    expect(inbox.openSuggestions).toEqual([support]);
    expect(inbox.decidedSuggestions).toEqual([move]);
    expect(inbox.batchableSuggestions).toEqual([support]);
    expect(inbox.stats).toMatchObject({
      layoutCount: 0,
      physicalMoveCount: 0,
      placementCount: 0,
      supportCount: 1,
    });
  });

  it('keeps geometry moves and physical moves out of batch acceptance', () => {
    const physicalMove = createSuggestion({
      canBatchAccept: true,
      relocationImpact: 'physicalMove',
      type: 'addTrellis',
    });
    const placementMove = createSuggestion({
      canBatchAccept: true,
      relocationImpact: 'plannedOnly',
      type: 'moveShadeTolerantCrop',
    });

    expect(isBatchAcceptableReviewProposal(physicalMove)).toBe(false);
    expect(isBatchAcceptableReviewProposal(placementMove)).toBe(false);
  });

  it('recommends reviewing physical moves before batch support actions', () => {
    const support = createSuggestion({
      canBatchAccept: true,
      id: 'review:add-trellis:tomato-1',
      type: 'addTrellis',
    });
    const physicalMove = createSuggestion({
      id: 'review:move-tall-north:tomato-1',
      relocationImpact: 'physicalMove',
      type: 'moveTallCropNorth',
    });
    const inbox = buildReviewProposalInbox({
      reviewSuggestions: [support, physicalMove],
      suggestionDecisions: [],
    });

    expect(getReviewProposalNextAction(inbox)).toMatchObject({
      label: 'Review physical moves first',
    });
  });

  it('records proposal impact for publish review audit trails', () => {
    expect(
      describeSuggestionDecision(
        createSuggestion({
          canBatchAccept: true,
          type: 'addTrellis',
        }),
      ).impact,
    ).toBe('support');
    expect(
      describeSuggestionDecision(
        createSuggestion({
          relocationImpact: 'physicalMove',
          type: 'moveTallCropNorth',
        }),
      ).impact,
    ).toBe('move');
  });

  it('labels proposal cards by decision category', () => {
    expect(
      getReviewProposalCategory(createSuggestion({ type: 'widenPath' })),
    ).toBe('Access');
    expect(
      getReviewProposalCategory(
        createSuggestion({ type: 'optimizerProposal' }),
      ),
    ).toBe('Layout');
    expect(
      getReviewProposalCategory(
        createSuggestion({ type: 'splitOvercrowdedPlanting' }),
      ),
    ).toBe('Placement');
  });
});

function createSuggestion(
  overrides: Partial<ReviewSuggestion> = {},
): ReviewSuggestion {
  return {
    actions: [],
    canBatchAccept: false,
    id: 'review:add-trellis:default',
    itemIds: ['tomato-1'],
    preview: {
      after: 'After',
      before: 'Before',
    },
    rationale: 'The draft can be improved.',
    relocationImpact: 'none',
    severity: 'warning',
    source: 'selfFix',
    sourceWarningId: 'warning-1',
    title: 'Proposal',
    type: 'addTrellis',
    ...overrides,
  };
}
