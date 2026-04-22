import type {
  Garden,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import type { PlanWarning } from './gardenPlanning';
import {
  buildShadeCropSuggestions,
  buildTallCropSuggestions,
  buildWaterZoneSuggestions,
} from './reviewAmbientSuggestions';
import {
  compareSuggestions,
  getSuggestionRelocationImpact,
  hasDraftProposalAction,
  type ReviewSuggestion,
} from './reviewSuggestionModel';
import { buildWarningSuggestions } from './reviewWarningSuggestions';

export {
  applyReviewSuggestionActions,
  describeSuggestionDecision,
  type ReviewSuggestion,
  type ReviewSuggestionAction,
  type ReviewSuggestionPreview,
  type ReviewSuggestionType,
} from './reviewSuggestionModel';

export function buildReviewSuggestions({
  garden,
  sunLayer,
  warnings,
}: {
  garden: Garden;
  sunLayer: SunShadeLayer | null;
  warnings: PlanWarning[];
}): ReviewSuggestion[] {
  const suggestions = [
    ...warnings.flatMap((warning) =>
      buildWarningSuggestions(garden, warning, sunLayer),
    ),
    ...buildTallCropSuggestions(garden),
    ...buildShadeCropSuggestions(garden, sunLayer),
    ...buildWaterZoneSuggestions(garden),
  ];
  const uniqueSuggestions = new Map<string, ReviewSuggestion>();

  for (const suggestion of suggestions) {
    uniqueSuggestions.set(suggestion.id, suggestion);
  }

  return [...uniqueSuggestions.values()]
    .filter(hasDraftProposalAction)
    .map((suggestion) => ({
      ...suggestion,
      relocationImpact: getSuggestionRelocationImpact(garden, suggestion),
    }))
    .sort(compareSuggestions);
}
