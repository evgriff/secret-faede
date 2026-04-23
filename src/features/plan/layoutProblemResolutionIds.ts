import type { ReviewSuggestion } from '../garden/reviewSuggestions';

export function getLayoutProblemIdForWarning(warningId: string) {
  return `layout:problem:warning:${warningId}`;
}

export function getLayoutProblemIdForSuggestion(suggestion: ReviewSuggestion) {
  return suggestion.sourceWarningId
    ? getLayoutProblemIdForWarning(suggestion.sourceWarningId)
    : `layout:problem:suggestion:${suggestion.id}`;
}

export function getLayoutResolutionOptionId(suggestionId: string) {
  return `layout:resolution:${suggestionId}`;
}

export function getVariantGroupIdForSuggestion(suggestion: ReviewSuggestion) {
  if (suggestion.type === 'optimizerProposal') {
    return getVariantGroupIdForCandidate(
      suggestion.id.replace('review:optimizer:', ''),
    );
  }

  if (suggestion.sourceWarningId) {
    return getVariantGroupIdForWarning(suggestion.sourceWarningId);
  }

  return `layout:variant-group:${suggestion.type}:${
    suggestion.itemIds.join('+') || suggestion.id
  }`;
}

export function getVariantGroupIdForWarning(warningId: string) {
  return `layout:variant-group:warning:${warningId}`;
}

export function getVariantGroupIdForCandidate(candidateId: string) {
  return `layout:variant-group:optimizer:${candidateId}`;
}
