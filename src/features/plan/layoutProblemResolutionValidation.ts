import type {
  LayoutDownstreamValidation,
  LayoutProblem,
  LayoutResolutionOption,
} from '../../domain/gardens/GardenRepository';

export function notRunValidation(): LayoutDownstreamValidation {
  return {
    checkedAtIso: null,
    message: null,
    remainingProblemIds: [],
    status: 'notRun',
  };
}

export function validateProblem(
  problem: LayoutProblem,
  currentProblemIds: Set<string>,
): LayoutDownstreamValidation {
  if (problem.status !== 'applied') {
    return notRunValidation();
  }

  return currentProblemIds.has(problem.id)
    ? {
        checkedAtIso: null,
        message: 'A resolution was applied, but this problem is still present.',
        remainingProblemIds: [problem.id],
        status: 'failed',
      }
    : {
        checkedAtIso: null,
        message:
          'Applied resolution removed the problem from the current plan.',
        remainingProblemIds: [],
        status: 'passed',
      };
}

export function validateResolutionOption(
  option: LayoutResolutionOption,
  currentProblemIds: Set<string>,
): LayoutDownstreamValidation {
  if (option.status !== 'applied') {
    return notRunValidation();
  }

  return currentProblemIds.has(option.problemId)
    ? {
        checkedAtIso: null,
        message: 'Applied option needs another pass; the problem still exists.',
        remainingProblemIds: [option.problemId],
        status: 'failed',
      }
    : {
        checkedAtIso: null,
        message: 'Applied option validates against the current problem set.',
        remainingProblemIds: [],
        status: 'passed',
      };
}

export function getVariantValidation(
  problems: LayoutProblem[],
): LayoutDownstreamValidation {
  const remainingProblemIds = problems
    .filter((problem) => problem.severity === 'mustFix')
    .map((problem) => problem.id);

  return {
    checkedAtIso: null,
    message:
      remainingProblemIds.length > 0
        ? `${remainingProblemIds.length} must-fix problem remains.`
        : 'No must-fix problems are attached to this layout suggestion.',
    remainingProblemIds,
    status: remainingProblemIds.length > 0 ? 'failed' : 'passed',
  };
}
