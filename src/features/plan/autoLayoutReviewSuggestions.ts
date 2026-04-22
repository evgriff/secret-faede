import type { ReviewSuggestion } from '../garden/reviewSuggestions';
import type { AutoLayoutCandidate } from './autoLayoutTypes';

export function buildAutoLayoutReviewSuggestions(
  candidates: AutoLayoutCandidate[],
): ReviewSuggestion[] {
  return candidates.map((candidate) => ({
    actions: [
      {
        kind: 'replaceAutoLayoutProposal',
        plantings: candidate.plantings,
        structures: candidate.structures,
      },
    ],
    canBatchAccept: false,
    confidence:
      candidate.hardConstraintViolations.length === 0 && candidate.score >= 70
        ? 'high'
        : 'medium',
    id: getAutoLayoutReviewSuggestionId(candidate.id),
    itemIds: [
      ...candidate.plantings.map((planting) => planting.id),
      ...candidate.structures.map((structure) => structure.id),
    ],
    preview: {
      after: `${candidate.plantings.length} planting${candidate.plantings.length === 1 ? '' : 's'}, ${candidate.structures.length} support${candidate.structures.length === 1 ? '' : 's'}`,
      before: 'Current draft layout',
    },
    relocationImpact: 'plannedOnly',
    rationale: [
      candidate.explanations[0],
      candidate.tradeoffs[0],
      candidate.tradeoffs.find((tradeoff) =>
        tradeoff.includes('stayed anchored'),
      ),
      candidate.hardConstraintViolations.length > 0
        ? `${candidate.hardConstraintViolations.length} hard constraint issue${candidate.hardConstraintViolations.length === 1 ? '' : 's'} remains.`
        : null,
    ]
      .filter(Boolean)
      .join(' '),
    severity:
      candidate.hardConstraintViolations.length > 0
        ? 'warning'
        : candidate.unplaced.some((entry) => entry.required)
          ? 'warning'
          : 'info',
    source: 'optimizer',
    sourceWarningId: null,
    title: `Use ${candidate.label} layout`,
    type: 'optimizerProposal',
  }));
}

export function getAutoLayoutReviewSuggestionId(candidateId: string) {
  return `review:optimizer:${candidateId}`;
}
