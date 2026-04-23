import type {
  Garden,
  LayoutProblem,
  LayoutResolutionOption,
  LayoutVariant,
} from '../../domain/gardens/GardenRepository';
import { buildPlantGroups } from '../garden/gardenPlanningState';
import type { AutoLayoutCandidate } from './autoLayoutTypes';
import { getVariantGroupIdForCandidate } from './layoutProblemResolutionIds';
import { getVariantValidation } from './layoutProblemResolutionValidation';

export function buildLayoutVariants({
  candidates,
  garden,
  problems,
  resolutionOptions,
}: {
  candidates: AutoLayoutCandidate[];
  garden: Garden;
  problems: LayoutProblem[];
  resolutionOptions: LayoutResolutionOption[];
}): LayoutVariant[] {
  return candidates.map((candidate) => {
    const variantGroupId = getVariantGroupIdForCandidate(candidate.id);
    const variantProblems = [
      ...problems.filter(
        (problem) => problem.variantGroupId === variantGroupId,
      ),
      ...candidate.hardConstraintViolations.map((violation, index) =>
        buildHardConstraintProblem(candidate, violation, index),
      ),
    ];
    const variantOptions = resolutionOptions.filter(
      (option) => option.variantGroupId === variantGroupId,
    );

    return {
      assumptions: [
        `Strategy: ${candidate.strategy}`,
        `Recursive search: ${candidate.search.status}, ${candidate.search.evaluatedStates} states checked, depth ${candidate.search.reachedDepth}/${candidate.search.maxDepth}.`,
        ...candidate.tradeoffs.slice(0, 3),
        ...candidate.unplaced.map(
          (item) => `${item.cropName} unplaced: ${item.reason}`,
        ),
      ],
      downstreamValidation: getVariantValidation(variantProblems),
      id: candidate.id,
      label: candidate.label,
      plantGroups: buildPlantGroups({
        ...garden,
        plantings: candidate.plantings,
        structures: candidate.structures,
      }),
      problemIds: variantProblems.map((problem) => problem.id),
      problems: variantProblems,
      resolutionOptionIds: variantOptions.map((option) => option.id),
      resolutionOptions: variantOptions,
      score: {
        components: {
          access: candidate.scoreBreakdown.waterGrouping,
          spacing: candidate.scoreBreakdown.spacingQuality,
          sun: Math.max(
            candidate.scoreBreakdown.seasonalSuitability,
            candidate.scoreBreakdown.shadeManagement,
          ),
          support:
            candidate.strategy === 'supportFirst'
              ? candidate.scoreBreakdown.spacingQuality
              : candidate.scoreBreakdown.waterGrouping,
        },
        total: Math.round(
          (candidate.scoreBreakdown.seasonalSuitability +
            candidate.scoreBreakdown.shadeManagement +
            candidate.scoreBreakdown.spacingQuality +
            candidate.scoreBreakdown.waterGrouping) /
            4,
        ),
      },
      structures: candidate.structures,
      summary: candidate.explanations.join(' '),
      variantGroupId,
    };
  });
}

function buildHardConstraintProblem(
  candidate: AutoLayoutCandidate,
  violation: string,
  index: number,
): LayoutProblem {
  const id = `layout:problem:${candidate.id}:constraint-${index + 1}`;

  return {
    appliedResolutionId: null,
    category: 'boundary',
    description: violation,
    downstreamValidation: {
      checkedAtIso: null,
      message: violation,
      remainingProblemIds: [id],
      status: 'failed',
    },
    evidence: [
      {
        label: 'Optimizer constraint',
        sourceId: candidate.id,
        type: 'text',
        unit: null,
        value: violation,
      },
    ],
    id,
    ignoredAtIso: null,
    kind: 'bounds',
    severity: 'mustFix',
    source: 'optimizer',
    status: 'open',
    targets: [],
    title: 'Hard layout constraint',
    variantGroupId: getVariantGroupIdForCandidate(candidate.id),
  };
}
