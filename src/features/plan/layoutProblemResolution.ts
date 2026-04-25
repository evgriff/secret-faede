import type { GardenSuggestionDecision } from '../../domain/gardens/gardenWorkspace';
import type {
  Garden,
  LayoutProblem,
  LayoutResolution,
  LayoutResolutionOption,
  LayoutVariant,
} from '../../domain/gardens/GardenRepository';
import {
  isUserFacingPlanWarning,
  type PlanWarning,
} from '../garden/gardenPlanning';
import type { ReviewSuggestion } from '../garden/reviewSuggestions';
import type { AutoLayoutCandidate } from './autoLayoutTypes';
import {
  buildProblemSeedFromSuggestion,
  buildProblemSeedFromWarning,
  buildTargets,
  mergeProblemSeeds,
} from './layoutProblemMapping';
import {
  getLayoutProblemIdForSuggestion,
  getLayoutProblemIdForWarning,
} from './layoutProblemResolutionIds';
import {
  validateProblem,
  validateResolutionOption,
} from './layoutProblemResolutionValidation';
import { buildLayoutSuggestion } from './layoutProblemVariants';
import {
  buildLayoutResolutionOption,
  buildLayoutResolutionRecord,
} from './layoutResolutionOptions';

export interface LayoutProblemResolutionModel {
  problems: LayoutProblem[];
  resolutionOptions: LayoutResolutionOption[];
  resolutions: LayoutResolution[];
  suggestion: LayoutVariant | null;
}

export function buildLayoutProblemResolutionModel({
  candidate,
  garden,
  reviewSuggestions,
  suggestionDecisions,
  warnings,
}: {
  candidate: AutoLayoutCandidate | null;
  garden: Garden;
  reviewSuggestions: ReviewSuggestion[];
  suggestionDecisions: GardenSuggestionDecision[];
  warnings: PlanWarning[];
}): LayoutProblemResolutionModel {
  const decisionBySuggestionId = new Map(
    suggestionDecisions.map((decision) => [decision.id, decision]),
  );
  const warningById = new Map(warnings.map((warning) => [warning.id, warning]));
  const resolutionOptions = reviewSuggestions.map((suggestion) =>
    buildLayoutResolutionOption({
      decision: decisionBySuggestionId.get(suggestion.id) ?? null,
      problemId: getLayoutProblemIdForSuggestion(suggestion),
      suggestion,
    }),
  );
  const optionIdsByProblemId = groupOptionIdsByProblem(resolutionOptions);
  const visibleWarnings = warnings.filter(isUserFacingPlanWarning);
  const seeds = [
    ...visibleWarnings.map((warning) =>
      buildProblemSeedFromWarning({
        targets: buildTargets(garden, warning.itemIds),
        warning,
      }),
    ),
    ...reviewSuggestions
      .filter(
        (suggestion) =>
          !suggestion.sourceWarningId ||
          !warningById.has(suggestion.sourceWarningId),
      )
      .map((suggestion) =>
        buildProblemSeedFromSuggestion({
          decision: decisionBySuggestionId.get(suggestion.id) ?? null,
          suggestion,
          targets: buildTargets(garden, suggestion.itemIds),
        }),
      ),
  ];
  const problems = [...mergeProblemSeeds(seeds).values()];
  const currentProblemIds = new Set(problems.map((problem) => problem.id));
  const validatedOptions = resolutionOptions.map((option) => ({
    ...option,
    downstreamValidation: validateResolutionOption(option, currentProblemIds),
  }));
  const validatedProblems = problems.map((problem) => {
    const problemOptions = validatedOptions.filter(
      (option) => option.problemId === problem.id,
    );
    const appliedResolutionId =
      problem.appliedResolutionId ??
      getAppliedOptionId(optionIdsByProblemId.get(problem.id), problemOptions);
    const ignoredDecision = problemOptions
      .filter(
        (option) => option.status === 'ignored' || option.status === 'rejected',
      )
      .map((option) => decisionBySuggestionId.get(option.sourceId) ?? null)
      .find((decision) => decision !== null);
    const nextProblem = {
      ...problem,
      appliedResolutionId,
      ignoredAtIso: ignoredDecision?.decidedAtIso ?? problem.ignoredAtIso,
      status: appliedResolutionId
        ? ('applied' as const)
        : ignoredDecision
          ? ('ignored' as const)
          : problem.status,
    };

    return {
      ...nextProblem,
      downstreamValidation: validateProblem(nextProblem, currentProblemIds),
    };
  });
  const resolutions = reviewSuggestions.flatMap((suggestion) =>
    buildLayoutResolutionRecord({
      decision: decisionBySuggestionId.get(suggestion.id) ?? null,
      option:
        validatedOptions.find(
          (candidate) => candidate.sourceId === suggestion.id,
        ) ?? null,
      problemIds: currentProblemIds,
    }),
  );

  return {
    problems: validatedProblems,
    resolutionOptions: validatedOptions,
    resolutions,
    suggestion: buildLayoutSuggestion({
      candidate,
      garden,
      problems: validatedProblems,
      resolutionOptions: validatedOptions,
    }),
  };
}

export { getLayoutProblemIdForSuggestion, getLayoutProblemIdForWarning };

function groupOptionIdsByProblem(options: LayoutResolutionOption[]) {
  const optionIdsByProblemId = new Map<string, string[]>();

  for (const option of options) {
    optionIdsByProblemId.set(option.problemId, [
      ...(optionIdsByProblemId.get(option.problemId) ?? []),
      option.id,
    ]);
  }

  return optionIdsByProblemId;
}

function getAppliedOptionId(
  optionIds: string[] | undefined,
  options: LayoutResolutionOption[],
) {
  if (!optionIds) {
    return null;
  }

  return (
    options.find(
      (option) => optionIds.includes(option.id) && option.status === 'applied',
    )?.id ?? null
  );
}
