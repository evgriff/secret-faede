import type { GardenSuggestionDecision } from '../../domain/gardens/gardenWorkspace';
import {
  toPlantPlacementMode,
  type Garden,
  type LayoutResolution,
  type LayoutResolutionAction,
  type LayoutResolutionOption,
  type LayoutResolutionOptionStatus,
} from '../../domain/gardens/GardenRepository';
import type { ReviewSuggestion } from '../garden/reviewSuggestions';
import {
  getLayoutResolutionOptionId,
  getVariantGroupIdForSuggestion,
} from './layoutProblemResolutionIds';
import {
  notRunValidation,
  validateResolutionOption,
} from './layoutProblemResolutionValidation';

export function buildLayoutResolutionOption({
  decision,
  problemId,
  suggestion,
}: {
  decision: GardenSuggestionDecision | null;
  problemId: string;
  suggestion: ReviewSuggestion;
}): LayoutResolutionOption {
  const actions = buildLayoutResolutionActions(suggestion);

  return {
    actions:
      actions.length > 0
        ? actions
        : [
            {
              reason: 'No draft-safe action is available for this problem.',
              type: 'dismissProblem',
            },
          ],
    description: suggestion.rationale,
    downstreamValidation: notRunValidation(),
    estimatedImpact: {
      affectedPlantCount: suggestion.itemIds.length,
      keepsExistingPlantCenters: suggestion.relocationImpact !== 'physicalMove',
      needsPhysicalMove: suggestion.relocationImpact === 'physicalMove',
    },
    id: getLayoutResolutionOptionId(suggestion.id),
    label: suggestion.title,
    problemId,
    sourceId: suggestion.id,
    status: getOptionStatus(decision),
    variantGroupId: getVariantGroupIdForSuggestion(suggestion),
  };
}

export function buildLayoutResolutionRecord({
  decision,
  option,
  problemIds,
}: {
  decision: GardenSuggestionDecision | null;
  option: LayoutResolutionOption | null;
  problemIds: Set<string>;
}): LayoutResolution[] {
  if (!decision || !option) {
    return [];
  }

  const accepted = decision.status === 'accepted';

  return [
    {
      appliedAtIso: accepted ? decision.decidedAtIso : null,
      downstreamValidation: validateResolutionOption(option, problemIds),
      id: `layout:resolution-record:${decision.id}`,
      ignoredAtIso:
        decision.status === 'snoozed' ? decision.decidedAtIso : null,
      optionId: option.id,
      problemId: option.problemId,
      status:
        decision.status === 'accepted'
          ? 'applied'
          : decision.status === 'snoozed'
            ? 'ignored'
            : 'rejected',
      variantGroupId: option.variantGroupId,
    },
  ];
}

function buildLayoutResolutionActions(
  suggestion: ReviewSuggestion,
): LayoutResolutionAction[] {
  return suggestion.actions.flatMap((action): LayoutResolutionAction[] => {
    switch (action.kind) {
      case 'addStructure':
        return [{ structure: action.structure, type: 'addStructure' }];
      case 'replaceAutoLayoutProposal':
        return [
          {
            type: 'useLayoutVariant',
            variantId: suggestion.id.replace('review:optimizer:', ''),
          },
        ];
      case 'updateStructure':
        return [
          {
            structureId: action.id,
            type: 'updateStructure',
            values: action.values,
          },
        ];
      case 'updatePlanting':
        return buildPlantingResolutionActions(action.id, action.values);
    }
  });
}

function buildPlantingResolutionActions(
  plantGroupId: string,
  values: Partial<Garden['plantings'][number]>,
): LayoutResolutionAction[] {
  const actions: LayoutResolutionAction[] = [];

  if (values.support) {
    actions.push({
      plantGroupId,
      support: values.support,
      type: 'assignPlantSupport',
    });
  }

  if (typeof values.plantCount === 'number') {
    actions.push({
      plantGroupId,
      quantity: values.plantCount,
      type: 'changePlantQuantity',
    });
  }

  if (values.mode) {
    actions.push({
      placementMode: toPlantPlacementMode(values.mode),
      plantGroupId,
      type: 'changePlacementMode',
    });
  }

  if (typeof values.xFt === 'number' && typeof values.yFt === 'number') {
    actions.push({
      plantGroupId,
      type: 'movePlantGroup',
      xFt: values.xFt,
      yFt: values.yFt,
    });
  }

  return actions;
}

function getOptionStatus(
  decision: GardenSuggestionDecision | null,
): LayoutResolutionOptionStatus {
  if (!decision) {
    return 'available';
  }

  if (decision.status === 'accepted') {
    return 'applied';
  }

  return decision.status === 'snoozed' ? 'ignored' : 'rejected';
}
