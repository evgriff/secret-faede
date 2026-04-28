import {
  createDefaultPlanting,
  createPlantGroupFromPlanting,
  derivePlantDots,
  derivePlantGroupFootprint,
  toPlantPlacementMode,
  type LayoutProblem,
  type LayoutResolutionOption,
  type LayoutVariant,
  type PlantGroup,
  type PlantSpecies,
  type PlantSupportPlan,
} from './GardenRepository';

describe('plant planning domain model', () => {
  it('derives row dots and footprint from quantity, spacing, and placement mode', () => {
    const group = makePlantGroup({
      placementMode: 'row',
      quantity: 4,
      spacingInches: 24,
      xFt: 5,
      yFt: 4,
    });

    expect(
      derivePlantDots(group).map(({ xFt, yFt }) => ({ xFt, yFt })),
    ).toEqual([
      { xFt: 2, yFt: 4 },
      { xFt: 4, yFt: 4 },
      { xFt: 6, yFt: 4 },
      { xFt: 8, yFt: 4 },
    ]);
    expect(derivePlantGroupFootprint(group)).toMatchObject({
      depthFt: 2,
      widthFt: 8,
      xFt: 1,
      yFt: 3,
    });
  });

  it('derives block dots using row spacing without stored pixel or width fields', () => {
    const group = makePlantGroup({
      placementMode: 'block',
      quantity: 6,
      rowSpacingInches: 24,
      spacingInches: 12,
      xFt: 10,
      yFt: 8,
    });

    expect(
      derivePlantDots(group).map(({ xFt, yFt }) => ({ xFt, yFt })),
    ).toEqual([
      { xFt: 9, yFt: 7 },
      { xFt: 10, yFt: 7 },
      { xFt: 11, yFt: 7 },
      { xFt: 9, yFt: 9 },
      { xFt: 10, yFt: 9 },
      { xFt: 11, yFt: 9 },
    ]);
    expect(derivePlantGroupFootprint(group)).toMatchObject({
      depthFt: 3,
      widthFt: 3,
      xFt: 8.5,
      yFt: 6.5,
    });
  });

  it('adapts legacy planting records into quantity-first plant groups', () => {
    const planting = {
      ...createDefaultPlanting({
        id: 'tomato-row',
        label: 'Tomato',
        xFt: 6,
        yFt: 4,
      }),
      cropId: 'tomato',
      instances: [],
      mode: 'row' as const,
      plantCount: 3,
      rowSpacingInches: 36,
      spacingInches: 24,
      status: 'growing' as const,
    };
    const group = createPlantGroupFromPlanting(planting, tomatoSpecies);

    expect(group).toMatchObject({
      id: 'tomato-row',
      placementMode: 'row',
      quantity: 3,
      rowSpacingInches: 36,
      spacingInches: 24,
      species: {
        commonName: 'Tomato',
        source: 'catalog',
      },
      status: {
        lifecycle: 'growing',
      },
      support: {
        perPlant: true,
        quantity: 3,
        type: 'cage',
      },
    });
    expect(derivePlantDots(group)).toHaveLength(3);
  });

  it('maps legacy single and trellis-line modes to grouped placement modes', () => {
    expect(toPlantPlacementMode('single')).toBe('cluster');
    expect(toPlantPlacementMode('trellisLine')).toBe('row');
  });

  it('keeps optimizer problems, options, and variants structured', () => {
    const support = makeSupportPlan({ type: 'stake' });
    const validation = {
      checkedAtIso: null,
      message: null,
      remainingProblemIds: [],
      status: 'notRun' as const,
    };
    const problem: LayoutProblem = {
      appliedResolutionId: null,
      category: 'support',
      description: 'Peas need a saved trellis before the layout is ready.',
      downstreamValidation: validation,
      evidence: [
        {
          label: 'Required support',
          sourceId: 'pea-group',
          type: 'text',
          unit: null,
          value: 'trellis or stake',
        },
      ],
      id: 'problem-support',
      ignoredAtIso: null,
      kind: 'supportMissing',
      severity: 'mustFix',
      source: 'optimizer',
      status: 'open',
      targets: [
        {
          id: 'pea-group',
          plantGroupId: 'pea-group',
          type: 'plantGroup',
        },
      ],
      title: 'Support missing',
      variantGroupId: 'variant-group-support',
    };
    const option: LayoutResolutionOption = {
      actions: [
        {
          plantGroupId: 'pea-group',
          support,
          type: 'assignPlantSupport',
        },
        {
          plantGroupId: 'pea-group',
          placementMode: 'row',
          type: 'changePlacementMode',
        },
      ],
      description: 'Keep peas in a row and assign per-plant supports.',
      downstreamValidation: validation,
      estimatedImpact: {
        affectedPlantCount: 6,
        keepsExistingPlantCenters: true,
        needsPhysicalMove: false,
      },
      id: 'resolution-support',
      label: 'Add supports',
      problemId: problem.id,
      sourceId: 'review-support',
      status: 'available',
      variantGroupId: problem.variantGroupId,
    };
    const variant: LayoutVariant = {
      assumptions: ['Uses current plot dimensions in feet.'],
      downstreamValidation: validation,
      id: 'variant-support-first',
      label: 'Support-ready',
      plantGroups: [makePlantGroup({ id: 'pea-group', quantity: 6 })],
      problemIds: [problem.id],
      problems: [problem],
      resolutionOptionIds: [option.id],
      resolutionOptions: [option],
      score: {
        components: {
          access: 0.9,
          spacing: 0.8,
          structures: 1,
          water: 0.75,
        },
        total: 0.86,
      },
      structures: [],
      summary: 'Support conflicts are explicit resolution actions.',
      variantGroupId: 'variant-group-support',
    };

    expect(variant.resolutionOptions[0]?.actions).toEqual([
      {
        plantGroupId: 'pea-group',
        support,
        type: 'assignPlantSupport',
      },
      {
        plantGroupId: 'pea-group',
        placementMode: 'row',
        type: 'changePlacementMode',
      },
    ]);
  });
});

const tomatoSpecies: PlantSpecies = {
  aliases: ['roma tomato'],
  catalogCropId: 'tomato',
  category: 'vegetable',
  commonName: 'Tomato',
  difficulty: 'moderate',
  growthForm: 'upright',
  id: 'tomato',
  lifecycle: 'annual',
  matureHeightInches: 72,
  matureSpreadInches: 24,
  planningCanopyDensity: 'moderate',
  planningGrowthStage: 'mature',
  rowSpacingInches: 36,
  scientificName: 'Solanum lycopersicum',
  source: 'catalog',
  spacingInches: 24,
  supportHeightFt: 6,
  sunRequirement: 'fullSun',
  supportedPlacementModes: ['row', 'block'],
  trellisRecommended: true,
  trellisRequired: false,
  waterNeeds: 'medium',
  weeklyWaterNeedInches: 1,
};

function makePlantGroup(overrides: Partial<PlantGroup> = {}): PlantGroup {
  return {
    allowRelocation: false,
    bedStructureId: null,
    id: 'tomato-group',
    label: 'Tomato',
    locked: false,
    placementMode: 'cluster',
    plannedFor: null,
    plantedOn: null,
    planningCanopyDensity: tomatoSpecies.planningCanopyDensity,
    planningGrowthStage: 'mature',
    quantity: 1,
    rowSpacingInches: null,
    spacingInches: 24,
    species: tomatoSpecies,
    status: {
      dotStatus: {},
      lifecycle: 'planned',
      notes: '',
      photos: [],
      thinned: false,
      thinnedAtIso: null,
      watered: false,
      wateredAtIso: null,
    },
    support: makeSupportPlan(),
    supportHeightFt: null,
    trellisLengthFt: null,
    trellisStructureId: null,
    xFt: 5,
    yFt: 4,
    ...overrides,
  };
}

function makeSupportPlan(
  overrides: Partial<PlantSupportPlan> = {},
): PlantSupportPlan {
  return {
    installedAtIso: null,
    notes: '',
    perPlant: false,
    quantity: 0,
    required: false,
    type: 'none',
    ...overrides,
  };
}
