import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type Garden,
  type PlantSupportPlan,
} from '../../domain/gardens/GardenRepository';
import type { GardenSuggestionDecision } from '../../domain/gardens/gardenWorkspace';
import type { PlanWarning } from '../garden/gardenPlanning';
import type { ReviewSuggestion } from '../garden/reviewSuggestions';
import {
  buildLayoutProblemResolutionModel,
  getLayoutProblemIdForWarning,
} from './layoutProblemResolution';
import { createPendingSearchReport } from './autoLayoutCandidateBuilder';
import type { AutoLayoutCandidate } from './autoLayoutTypes';

describe('layoutProblemResolution', () => {
  it('models a support problem with structured resolution state', () => {
    const garden = makeGarden();
    const warning = makeWarning({
      fix: 'Assign a cage or stake to this plant group.',
      id: 'trellis-tomato-1',
      itemIds: ['tomato-1'],
      kind: 'trellis',
      message: 'Tomato group needs a cage, but no support is assigned.',
      title: 'Cage missing',
    });
    const support: PlantSupportPlan = {
      installedAtIso: null,
      notes: 'Install before flowering.',
      perPlant: true,
      quantity: 3,
      required: true,
      type: 'cage',
    };
    const suggestion = makeSuggestion({
      actions: [
        {
          id: 'tomato-1',
          kind: 'updatePlanting',
          values: { support },
        },
      ],
      id: 'review:addStakeCage:tomato-1',
      itemIds: ['tomato-1'],
      sourceWarningId: warning.id,
      title: 'Add tomato cage',
      type: 'addStakeCage',
    });

    const model = buildLayoutProblemResolutionModel({
      candidates: [],
      garden,
      reviewSuggestions: [suggestion],
      suggestionDecisions: [],
      warnings: [warning],
    });

    expect(model.problems).toHaveLength(1);
    expect(model.problems[0]).toMatchObject({
      category: 'support',
      id: getLayoutProblemIdForWarning(warning.id),
      kind: 'supportMissing',
      status: 'open',
      targets: [{ id: 'tomato-1', plantGroupId: 'tomato-1' }],
    });
    expect(model.resolutionOptions[0]).toMatchObject({
      problemId: model.problems[0]?.id,
      sourceId: suggestion.id,
      status: 'available',
      variantGroupId: model.problems[0]?.variantGroupId,
    });
    expect(model.resolutionOptions[0]?.actions).toEqual([
      {
        plantGroupId: 'tomato-1',
        support,
        type: 'assignPlantSupport',
      },
    ]);
  });

  it('keeps ignored and applied states separate from validation', () => {
    const garden = makeGarden();
    const warning = makeWarning({
      id: 'path-width-path-1',
      itemIds: ['path-1'],
    });
    const suggestion = makeSuggestion({
      actions: [
        {
          id: 'path-1',
          kind: 'updateStructure',
          values: { widthFt: 3 },
        },
      ],
      id: 'review:widen-path:path-1',
      itemIds: ['path-1'],
      sourceWarningId: warning.id,
      title: 'Widen path',
      type: 'widenPath',
    });
    const decision: GardenSuggestionDecision = {
      decidedAtIso: '2026-04-23T00:00:00.000Z',
      id: suggestion.id,
      impact: 'planned',
      label: suggestion.title,
      note: null,
      status: 'accepted',
    };

    const model = buildLayoutProblemResolutionModel({
      candidates: [],
      garden,
      reviewSuggestions: [suggestion],
      suggestionDecisions: [decision],
      warnings: [warning],
    });

    expect(model.problems[0]).toMatchObject({
      appliedResolutionId: model.resolutionOptions[0]?.id,
      downstreamValidation: {
        remainingProblemIds: [model.problems[0]?.id],
        status: 'failed',
      },
      status: 'applied',
    });
    expect(model.resolutions[0]).toMatchObject({
      appliedAtIso: decision.decidedAtIso,
      optionId: model.resolutionOptions[0]?.id,
      status: 'applied',
    });
  });

  it('groups optimizer variants with their complete solution option', () => {
    const garden = makeGarden();
    const candidate: AutoLayoutCandidate = {
      explanations: ['Moves sun-hungry crops into the sunniest open bed.'],
      hardConstraintViolations: ['Carrot group still overlaps the boundary.'],
      id: 'sun-first',
      label: 'Sun-first',
      materials: [],
      plantings: garden.plantings,
      scoreBreakdown: {
        seasonalSuitability: 80,
        shadeManagement: 70,
        spacingQuality: 90,
        waterGrouping: 60,
      },
      search: createPendingSearchReport(),
      strategy: 'sunFirst',
      structures: garden.structures,
      tradeoffs: ['Keeps access path clear.'],
      unplaced: [],
      wholePlot: {
        accessPathIds: [],
        heuristics: [],
        plantZones: [],
      },
    };
    const suggestion = makeSuggestion({
      actions: [
        {
          kind: 'replaceAutoLayoutProposal',
          plantings: candidate.plantings,
          structures: candidate.structures,
        },
      ],
      id: 'review:optimizer:sun-first',
      itemIds: ['tomato-1', 'path-1'],
      source: 'optimizer',
      title: 'Use Sun-first layout',
      type: 'optimizerProposal',
    });

    const model = buildLayoutProblemResolutionModel({
      candidates: [candidate],
      garden,
      reviewSuggestions: [suggestion],
      suggestionDecisions: [],
      warnings: [],
    });

    expect(model.variants[0]).toMatchObject({
      id: candidate.id,
      problemIds: expect.arrayContaining([
        'layout:problem:sun-first:constraint-1',
      ]),
      resolutionOptionIds: [model.resolutionOptions[0]?.id],
    });
    expect(model.variants[0]?.downstreamValidation).toMatchObject({
      remainingProblemIds: ['layout:problem:sun-first:constraint-1'],
      status: 'failed',
    });
  });
});

function makeGarden(): Garden {
  return {
    ...createDefaultGarden('test-user'),
    plantings: [
      createDefaultPlanting({
        id: 'tomato-1',
        label: 'Tomato group',
        xFt: 3,
        yFt: 3,
      }),
    ],
    structures: [
      {
        ...createDefaultStructure({
          id: 'path-1',
          type: 'pathway',
          xFt: 1,
          yFt: 1,
        }),
        label: 'Narrow path',
        widthFt: 1.5,
      },
    ],
  };
}

function makeWarning(overrides: Partial<PlanWarning> = {}): PlanWarning {
  return {
    acknowledgeable: false,
    fix: 'Use a concrete layout change.',
    id: 'warning-1',
    itemIds: ['tomato-1'],
    kind: 'pathway',
    message: 'A saved layout problem needs resolution.',
    severity: 'warning',
    title: 'Layout problem',
    ...overrides,
  };
}

function makeSuggestion(
  overrides: Partial<ReviewSuggestion> = {},
): ReviewSuggestion {
  return {
    actions: [],
    canBatchAccept: false,
    id: 'review:problem',
    itemIds: ['tomato-1'],
    preview: {
      after: 'Concrete fix',
      before: 'Current issue',
    },
    rationale: 'A real problem has a concrete resolution option.',
    severity: 'warning',
    source: 'selfFix',
    sourceWarningId: null,
    title: 'Resolve problem',
    type: 'splitOvercrowdedPlanting',
    ...overrides,
  };
}
