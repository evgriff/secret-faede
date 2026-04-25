import type {
  Garden,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import type { GardenSuggestionDecision } from '../../domain/gardens/gardenWorkspace';
import { findPlanWarnings } from '../garden/gardenPlanning';
import { buildReviewSuggestions } from '../garden/reviewSuggestions';
import type { SunSeason } from '../garden/sunShadeEngine';
import { buildLayoutProblemResolutionModel } from './layoutProblemResolution';
import { buildAutoLayoutReviewSuggestions } from './autoLayoutReviewSuggestions';
import type {
  AutoLayoutCandidate,
  AutoLayoutRunStatus,
} from './autoLayoutTypes';
import { buildAutoLayoutProposalDiffOverlay } from './proposalDiffOverlay';

export interface PlanAutoLayoutGenerationResult {
  includesDraftSave: boolean;
  message: string;
  status: AutoLayoutRunStatus;
  suggestion: AutoLayoutCandidate | null;
}

export async function runPlanAutoLayoutGeneration({
  acknowledgedWarningIds,
  currentGarden,
  dirty,
  onStage,
  saveDraftGarden,
  sourceGarden,
  suggestionDecisions,
  sunLayer,
  sunSeason,
}: {
  acknowledgedWarningIds: string[];
  currentGarden: Garden | null;
  dirty: boolean;
  onStage(status: AutoLayoutRunStatus, message: string): Promise<void> | void;
  saveDraftGarden(garden: Garden): Promise<boolean>;
  sourceGarden: Garden;
  suggestionDecisions: GardenSuggestionDecision[];
  sunLayer: SunShadeLayer | null;
  sunSeason: SunSeason;
}): Promise<PlanAutoLayoutGenerationResult> {
  const shouldSaveDraft = sourceGarden !== currentGarden || dirty;

  if (shouldSaveDraft) {
    await onStage(
      'savingDraft',
      'Saving the current draft before checking another arrangement.',
    );
    const saved = await saveDraftGarden(sourceGarden);

    if (!saved) {
      return {
        includesDraftSave: shouldSaveDraft,
        message:
          'Unable to save the draft before checking another arrangement.',
        status: 'error',
        suggestion: null,
      };
    }
  }

  await onStage(
    'collectingConstraints',
    'Collecting the current spacing, access, and support constraints.',
  );

  const sourcePlanWarnings = findPlanWarnings(
    sourceGarden,
    sunLayer
      ? {
          sunLayer,
          sunSeason,
        }
      : { sunSeason },
  );
  const sourceActiveWarnings = sourcePlanWarnings.filter(
    (warning) => !acknowledgedWarningIds.includes(warning.id),
  );
  const sourceReviewSuggestions = [
    ...buildReviewSuggestions({
      garden: sourceGarden,
      sunLayer,
      warnings: sourceActiveWarnings,
    }),
  ];

  const { generateAutoLayoutSuggestion } = await import('./autoLayoutEngine');
  await onStage(
    'generatingSuggestion',
    'Generating one checked whole-plot suggestion.',
  );

  const nextSuggestion = generateAutoLayoutSuggestion(sourceGarden, {
    ignoredWarningIds: acknowledgedWarningIds,
    sunLayer,
    sunSeason,
  });

  if (!nextSuggestion) {
    const hasLayoutRequests = sourceGarden.seasonPlan.wantedCrops.length > 0;

    return {
      includesDraftSave: shouldSaveDraft,
      message: hasLayoutRequests
        ? 'No better layout found right now. Keep the current layout or adjust the plan, then check again.'
        : 'Add plants before generating a layout suggestion.',
      status: 'noBetterLayout',
      suggestion: null,
    };
  }

  await onStage(
    'validatingSuggestion',
    'Validating the suggestion against the current must-fix issues.',
  );

  const validationModel = buildLayoutProblemResolutionModel({
    candidate: nextSuggestion,
    garden: sourceGarden,
    reviewSuggestions: [
      ...buildAutoLayoutReviewSuggestions(nextSuggestion),
      ...sourceReviewSuggestions,
    ],
    suggestionDecisions,
    warnings: sourceActiveWarnings,
  });

  if (!validationModel.suggestion) {
    return {
      includesDraftSave: shouldSaveDraft,
      message:
        'No better layout found right now. Keep the current layout or adjust the plan, then check again.',
      status: 'noBetterLayout',
      suggestion: null,
    };
  }

  await onStage(
    'preparingPreview',
    'Preparing the before-and-after preview for review.',
  );
  buildAutoLayoutProposalDiffOverlay({
    candidate: nextSuggestion,
    currentWarnings: sourcePlanWarnings,
    garden: sourceGarden,
    sunLayer,
    sunSeason,
  });

  return {
    includesDraftSave: shouldSaveDraft,
    message: 'One checked layout suggestion is ready to review.',
    status: 'ready',
    suggestion: nextSuggestion,
  };
}
