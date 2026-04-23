import type { GardenSuggestionDecision } from '../../domain/gardens/gardenWorkspace';
import type {
  Garden,
  LayoutProblem,
  LayoutProblemCategory,
  LayoutProblemKind,
  LayoutProblemSeverity,
  LayoutProblemSource,
  LayoutProblemTarget,
} from '../../domain/gardens/GardenRepository';
import {
  getPlanWarningDecisionCategory,
  type PlanWarning,
} from '../garden/gardenPlanning';
import type { ReviewSuggestion } from '../garden/reviewSuggestions';
import {
  getLayoutProblemIdForSuggestion,
  getLayoutProblemIdForWarning,
  getLayoutResolutionOptionId,
  getVariantGroupIdForSuggestion,
  getVariantGroupIdForWarning,
} from './layoutProblemResolutionIds';
import { notRunValidation } from './layoutProblemResolutionValidation';

export interface ProblemSeed {
  appliedResolutionId: string | null;
  category: LayoutProblemCategory;
  description: string;
  evidence: LayoutProblem['evidence'];
  id: string;
  ignoredAtIso: string | null;
  kind: LayoutProblemKind;
  severity: LayoutProblemSeverity;
  source: LayoutProblemSource;
  status: LayoutProblem['status'];
  targets: LayoutProblemTarget[];
  title: string;
  variantGroupId: string | null;
}

export function buildProblemSeedFromWarning({
  targets,
  warning,
}: {
  targets: LayoutProblemTarget[];
  warning: PlanWarning;
}): ProblemSeed {
  return {
    appliedResolutionId: null,
    category: categoryFromWarning(warning),
    description: warning.message,
    evidence: [
      {
        label: 'Reason',
        sourceId: warning.id,
        type: 'text',
        unit: null,
        value: warning.message,
      },
      {
        label: 'Resolution prompt',
        sourceId: warning.id,
        type: 'text',
        unit: null,
        value: warning.fix,
      },
    ],
    id: getLayoutProblemIdForWarning(warning.id),
    ignoredAtIso: null,
    kind: kindFromWarning(warning),
    severity: severityFromWarning(warning),
    source: sourceFromWarning(warning),
    status: 'open',
    targets,
    title: warning.title,
    variantGroupId: getVariantGroupIdForWarning(warning.id),
  };
}

export function buildProblemSeedFromSuggestion({
  decision,
  suggestion,
  targets,
}: {
  decision: GardenSuggestionDecision | null;
  suggestion: ReviewSuggestion;
  targets: LayoutProblemTarget[];
}): ProblemSeed {
  return {
    appliedResolutionId:
      decision?.status === 'accepted'
        ? getLayoutResolutionOptionId(suggestion.id)
        : null,
    category: categoryFromSuggestion(suggestion),
    description: suggestion.rationale,
    evidence: buildSuggestionEvidence(suggestion),
    id: getLayoutProblemIdForSuggestion(suggestion),
    ignoredAtIso:
      decision?.status === 'rejected' || decision?.status === 'snoozed'
        ? decision.decidedAtIso
        : null,
    kind: kindFromSuggestion(suggestion),
    severity: severityFromSuggestion(suggestion),
    source: sourceFromSuggestion(suggestion),
    status:
      decision?.status === 'accepted'
        ? 'applied'
        : decision?.status === 'rejected' || decision?.status === 'snoozed'
          ? 'ignored'
          : 'open',
    targets,
    title: suggestion.title,
    variantGroupId: getVariantGroupIdForSuggestion(suggestion),
  };
}

export function buildTargets(
  garden: Garden,
  itemIds: string[],
): LayoutProblemTarget[] {
  return itemIds.map((itemId) => {
    const isStructure = garden.structures.some(
      (structure) => structure.id === itemId,
    );

    return {
      id: itemId,
      plantGroupId: isStructure ? null : itemId,
      type: isStructure ? 'structure' : 'plantGroup',
    };
  });
}

export function mergeProblemSeeds(seeds: ProblemSeed[]) {
  const problemById = new Map<string, LayoutProblem>();

  for (const seed of seeds) {
    const existing = problemById.get(seed.id);
    const problem = materializeProblem(seed);

    problemById.set(
      seed.id,
      existing ? mergeProblems(existing, problem) : problem,
    );
  }

  return problemById;
}

function materializeProblem(seed: ProblemSeed): LayoutProblem {
  return {
    ...seed,
    downstreamValidation: notRunValidation(),
  };
}

function mergeProblems(
  left: LayoutProblem,
  right: LayoutProblem,
): LayoutProblem {
  return {
    ...left,
    appliedResolutionId: right.appliedResolutionId ?? left.appliedResolutionId,
    evidence: dedupeEvidence([...left.evidence, ...right.evidence]),
    ignoredAtIso: right.ignoredAtIso ?? left.ignoredAtIso,
    status: right.status === 'open' ? left.status : right.status,
    targets: dedupeTargets([...left.targets, ...right.targets]),
    variantGroupId: left.variantGroupId ?? right.variantGroupId,
  };
}

function buildSuggestionEvidence(
  suggestion: ReviewSuggestion,
): LayoutProblem['evidence'] {
  const evidence: LayoutProblem['evidence'] = [];

  if (suggestion.preview) {
    evidence.push(
      {
        label: 'Current state',
        sourceId: suggestion.id,
        type: 'text',
        unit: null,
        value: suggestion.preview.before,
      },
      {
        label: 'Proposed state',
        sourceId: suggestion.id,
        type: 'text',
        unit: null,
        value: suggestion.preview.after,
      },
    );
  }

  evidence.push({
    label: 'Reason',
    sourceId: suggestion.sourceWarningId ?? suggestion.id,
    type: 'text',
    unit: null,
    value: suggestion.rationale,
  });

  return evidence;
}

function categoryFromWarning(warning: PlanWarning): LayoutProblemCategory {
  switch (getPlanWarningDecisionCategory(warning)) {
    case 'bedFit':
      return 'placement';
    case 'boundary':
      return 'boundary';
    case 'care':
      return 'care';
    case 'pathway':
      return 'access';
    case 'rotation':
      return 'rotation';
    case 'shade':
      return 'shade';
    case 'spacing':
      return 'spacing';
    case 'structure':
      return 'structure';
    case 'sun':
      return 'sun';
    case 'support':
      return 'support';
  }
}

function categoryFromSuggestion(
  suggestion: ReviewSuggestion,
): LayoutProblemCategory {
  switch (suggestion.type) {
    case 'addAccessPath':
    case 'clearPathway':
      return 'access';
    case 'addStakeCage':
    case 'addSupportMaterial':
    case 'addTrellis':
    case 'convertToTrellisedLayout':
      return 'support';
    case 'flagRotationConcern':
      return 'rotation';
    case 'flagSunMismatch':
      return 'sun';
    case 'flagWaterZoneMismatch':
      return 'water';
    case 'moveShadeTolerantCrop':
    case 'moveTallCropNorth':
      return 'shade';
    case 'optimizerProposal':
    case 'reassignCropToBed':
      return 'placement';
    case 'splitOvercrowdedPlanting':
      return 'spacing';
    case 'widenPath':
      return 'access';
  }
}

function kindFromWarning(warning: PlanWarning): LayoutProblemKind {
  switch (warning.kind) {
    case 'bedFit':
    case 'container':
      return 'bedFit';
    case 'bounds':
      return 'bounds';
    case 'pathway':
      return 'pathAccess';
    case 'rotation':
      return 'rotationRisk';
    case 'shade':
      return 'shadeCompetition';
    case 'spacing':
      return 'spacingConflict';
    case 'structure':
      return 'structureConflict';
    case 'sun':
      return 'sunMismatch';
    case 'trellis':
      return 'supportMissing';
  }
}

function kindFromSuggestion(suggestion: ReviewSuggestion): LayoutProblemKind {
  switch (suggestion.type) {
    case 'addAccessPath':
    case 'clearPathway':
      return 'pathAccess';
    case 'addStakeCage':
    case 'addSupportMaterial':
    case 'addTrellis':
    case 'convertToTrellisedLayout':
      return 'supportMissing';
    case 'flagRotationConcern':
      return 'rotationRisk';
    case 'flagSunMismatch':
    case 'moveShadeTolerantCrop':
      return 'sunMismatch';
    case 'flagWaterZoneMismatch':
      return 'waterAccess';
    case 'moveTallCropNorth':
      return 'shadeCompetition';
    case 'optimizerProposal':
      return 'structureConflict';
    case 'reassignCropToBed':
      return 'bedFit';
    case 'splitOvercrowdedPlanting':
      return 'spacingConflict';
    case 'widenPath':
      return 'pathAccess';
  }
}

function severityFromWarning(warning: PlanWarning): LayoutProblemSeverity {
  return warning.severity === 'critical'
    ? 'mustFix'
    : warning.severity === 'warning'
      ? 'recommended'
      : 'caution';
}

function severityFromSuggestion(
  suggestion: ReviewSuggestion,
): LayoutProblemSeverity {
  return suggestion.severity === 'critical'
    ? 'mustFix'
    : suggestion.severity === 'warning'
      ? 'recommended'
      : 'caution';
}

function sourceFromWarning(warning: PlanWarning): LayoutProblemSource {
  return warning.kind === 'sun' || warning.kind === 'shade'
    ? 'sunModel'
    : 'planHealth';
}

function sourceFromSuggestion(
  suggestion: ReviewSuggestion,
): LayoutProblemSource {
  return suggestion.source === 'optimizer'
    ? 'optimizer'
    : suggestion.source === 'planHealth'
      ? 'planHealth'
      : 'userReview';
}

function dedupeEvidence(evidence: LayoutProblem['evidence']) {
  const seen = new Set<string>();

  return evidence.filter((item) => {
    const key = `${item.label}:${item.sourceId}:${item.type}:${item.value}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function dedupeTargets(targets: LayoutProblemTarget[]) {
  const seen = new Set<string>();

  return targets.filter((target) => {
    const key = `${target.type}:${target.id}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
