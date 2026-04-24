import type { GardenSuggestionDecision } from '../../domain/gardens/gardenWorkspace';
import type { ReviewSuggestion } from '../garden/reviewSuggestions';

export interface ReviewProposalInbox {
  batchableSuggestions: ReviewSuggestion[];
  decidedSuggestions: ReviewSuggestion[];
  decisionById: Map<string, GardenSuggestionDecision>;
  openSuggestions: ReviewSuggestion[];
  stats: {
    layoutCount: number;
    physicalMoveCount: number;
    placementCount: number;
    supportCount: number;
  };
}

export function buildReviewProposalInbox({
  reviewSuggestions,
  suggestionDecisions,
}: {
  reviewSuggestions: ReviewSuggestion[];
  suggestionDecisions: GardenSuggestionDecision[];
}): ReviewProposalInbox {
  const decisionById = new Map(
    suggestionDecisions.map((decision) => [decision.id, decision]),
  );
  const openSuggestions = reviewSuggestions.filter(
    (suggestion) => !decisionById.has(suggestion.id),
  );
  const decidedSuggestions = reviewSuggestions.filter((suggestion) =>
    decisionById.has(suggestion.id),
  );
  const batchableSuggestions = openSuggestions.filter(
    isBatchAcceptableReviewProposal,
  );

  return {
    batchableSuggestions,
    decidedSuggestions,
    decisionById,
    openSuggestions,
    stats: {
      layoutCount: openSuggestions.filter(
        (suggestion) => suggestion.type === 'optimizerProposal',
      ).length,
      physicalMoveCount: openSuggestions.filter(
        (suggestion) => suggestion.relocationImpact === 'physicalMove',
      ).length,
      placementCount: openSuggestions.filter(isPlacementProposal).length,
      supportCount: openSuggestions.filter(isSupportProposal).length,
    },
  };
}

export function getReviewProposalNextAction(inbox: ReviewProposalInbox): {
  detail: string;
  label: string;
} {
  if (inbox.openSuggestions.length === 0) {
    return {
      detail: 'Generate layouts or keep editing to surface problem decisions.',
      label: 'No draft decisions waiting',
    };
  }

  if (inbox.stats.physicalMoveCount > 0) {
    return {
      detail: `${inbox.stats.physicalMoveCount} physical move${inbox.stats.physicalMoveCount === 1 ? '' : 's'} touch planted crops. Review one at a time.`,
      label: 'Review physical moves first',
    };
  }

  if (inbox.batchableSuggestions.length > 0) {
    return {
      detail: `${inbox.batchableSuggestions.length} support proposal${inbox.batchableSuggestions.length === 1 ? '' : 's'} can be accepted without moving plants.`,
      label: 'Accept low-risk support',
    };
  }

  if (inbox.stats.layoutCount > 0) {
    return {
      detail: 'Preview the generated layout before applying it to the draft.',
      label: 'Walk through the layout proposal',
    };
  }

  return {
    detail: 'Check the before/after, then accept, reject, or snooze.',
    label: 'Review the next placement choice',
  };
}

export function isBatchAcceptableReviewProposal(suggestion: ReviewSuggestion) {
  return (
    suggestion.canBatchAccept &&
    suggestion.relocationImpact !== 'physicalMove' &&
    isSupportProposal(suggestion)
  );
}

export function getReviewProposalCategory(suggestion: ReviewSuggestion) {
  switch (suggestion.type) {
    case 'addAccessPath':
    case 'clearPathway':
    case 'widenPath':
      return 'Access';
    case 'addStakeCage':
    case 'addTrellis':
    case 'convertToTrellisedLayout':
      return 'Support';
    case 'addSupportMaterial':
      return 'Materials';
    case 'optimizerProposal':
      return 'Layout';
    case 'moveShadeTolerantCrop':
    case 'moveTallCropNorth':
    case 'reassignCropToBed':
    case 'splitOvercrowdedPlanting':
    case 'flagSunMismatch':
      return 'Placement';
    case 'flagRotationConcern':
    case 'flagWaterZoneMismatch':
      return 'Diagnostics';
  }
}

export function getReviewProposalChangeSummary(suggestion: ReviewSuggestion) {
  switch (suggestion.type) {
    case 'addAccessPath':
      return 'Add a saved access path near the bed.';
    case 'addStakeCage':
      return 'Assign a cage or stake to the plant group.';
    case 'addSupportMaterial':
      return 'Add the recommended support or material change to the draft.';
    case 'addTrellis':
      return 'Add a trellis structure to the draft.';
    case 'clearPathway':
      return 'Move the blocking item off a saved access path.';
    case 'convertToTrellisedLayout':
      return 'Convert the crop to a trellised planting layout.';
    case 'flagSunMismatch':
      return 'Move the crop to a sunnier or better-matched exposure.';
    case 'moveShadeTolerantCrop':
      return 'Move a shade-tolerant crop into a lower-sun pocket.';
    case 'moveTallCropNorth':
      return 'Move a tall crop north to reduce shade pressure.';
    case 'optimizerProposal':
      return 'Apply this generated layout candidate to the draft.';
    case 'reassignCropToBed':
      return 'Move the crop into a bed or container that fits it better.';
    case 'splitOvercrowdedPlanting':
      return 'Move one crop out of an overcrowded footprint.';
    case 'widenPath':
      return 'Widen a saved path to preserve access.';
    case 'flagRotationConcern':
    case 'flagWaterZoneMismatch':
      return 'Keep this diagnostic in Plan health until it has a concrete fix.';
  }
}

export function getReviewProposalUrgency(suggestion: ReviewSuggestion): {
  label: string;
  tone: 'danger' | 'neutral' | 'warning';
} {
  if (suggestion.relocationImpact === 'physicalMove') {
    return { label: 'Physical move', tone: 'warning' };
  }

  if (suggestion.severity === 'critical') {
    return { label: 'Urgent', tone: 'danger' };
  }

  if (suggestion.severity === 'warning') {
    return { label: 'Recommended', tone: 'warning' };
  }

  return { label: 'Optional', tone: 'neutral' };
}

function isSupportProposal(suggestion: ReviewSuggestion) {
  return ['addStakeCage', 'addSupportMaterial', 'addTrellis'].includes(
    suggestion.type,
  );
}

function isPlacementProposal(suggestion: ReviewSuggestion) {
  return [
    'addAccessPath',
    'clearPathway',
    'flagSunMismatch',
    'moveShadeTolerantCrop',
    'moveTallCropNorth',
    'reassignCropToBed',
    'splitOvercrowdedPlanting',
  ].includes(suggestion.type);
}
