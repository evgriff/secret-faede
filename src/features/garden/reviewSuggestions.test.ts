import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type Garden,
  type SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import { findPlanWarnings } from './gardenPlanning';
import {
  applyReviewSuggestionActions,
  buildReviewSuggestions,
} from './reviewSuggestions';

describe('reviewSuggestions', () => {
  it('builds practical support suggestions without access-path proposals', () => {
    const garden: Garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'tomato-1',
            label: 'Tomato',
            xFt: 2,
            yFt: 2,
          }),
          cropId: 'tomato',
          matureSpreadInches: 24,
          spacingInches: 24,
          sunRequirement: 'fullSun',
        },
      ],
      structures: [
        {
          ...createDefaultStructure({
            id: 'path-1',
            type: 'pathway',
            xFt: 6,
            yFt: 0,
          }),
          accessiblePath: true,
          widthFt: 2.5,
        },
      ],
    };
    const warnings = findPlanWarnings(garden);
    const suggestions = buildReviewSuggestions({
      garden,
      sunLayer: null,
      warnings,
    });
    const support = suggestions.find(
      (suggestion) => suggestion.type === 'addStakeCage',
    );
    expect(support).toBeDefined();
    expect(
      suggestions.some((suggestion) => suggestion.type === 'widenPath'),
    ).toBe(false);

    const withSupport = applyReviewSuggestionActions(
      garden,
      support?.actions ?? [],
    );
    expect(
      withSupport.plantings.some(
        (planting) =>
          planting.id === 'tomato-1' &&
          planting.support.type === 'cage' &&
          planting.support.notes.includes('[review]'),
      ),
    ).toBe(true);
  });

  it('adds trellises as reviewed grid structures instead of batch support', () => {
    const garden: Garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'cucumber-1',
            label: 'Cucumber',
            xFt: 3,
            yFt: 3,
          }),
          cropId: 'cucumber',
          mode: 'row',
          plantCount: 2,
          rowLengthFt: 2,
          spacingInches: 12,
          sunRequirement: 'fullSun',
        },
      ],
    };
    const suggestions = buildReviewSuggestions({
      garden,
      sunLayer: null,
      warnings: findPlanWarnings(garden),
    });
    const addTrellis = suggestions.find(
      (suggestion) => suggestion.type === 'addTrellis',
    );

    expect(addTrellis).toMatchObject({
      canBatchAccept: false,
      title: 'Add trellis',
    });
    expect(addTrellis?.rationale).toContain('grid trellis');
    expect(addTrellis?.rationale).toContain(
      'It does not introduce a new active plan warning.',
    );

    const nextGarden = applyReviewSuggestionActions(
      garden,
      addTrellis?.actions ?? [],
    );

    expect(nextGarden.structures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: expect.stringContaining('Cucumber'),
          type: 'trellis',
        }),
      ]),
    );
    expect(
      findPlanWarnings(nextGarden).some(
        (warning) => warning.id === 'trellis-cucumber-1',
      ),
    ).toBe(false);
  });

  it('does not suggest widening horizontal paths in review', () => {
    const garden: Garden = {
      ...createDefaultGarden('user-a'),
      structures: [
        {
          ...createDefaultStructure({
            id: 'path-horizontal',
            type: 'pathway',
            xFt: 0,
            yFt: 3,
          }),
          depthFt: 1,
          label: 'Cross path',
          widthFt: 8,
        },
      ],
    };
    const suggestions = buildReviewSuggestions({
      garden,
      sunLayer: null,
      warnings: findPlanWarnings(garden),
    });
    expect(
      suggestions.some((suggestion) => suggestion.type === 'widenPath'),
    ).toBe(false);
  });

  it('moves shade-tolerant crops into intentional partial sun when legal', () => {
    const garden: Garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'lettuce-1',
            label: 'Lettuce',
            xFt: 1.5,
            yFt: 1.5,
          }),
          cropId: 'lettuce',
          spacingInches: 12,
          sunRequirement: 'partSun',
        },
      ],
      plot: {
        ...createDefaultGarden('user-a').plot,
        depthFt: 4,
        widthFt: 8,
      },
    };
    const sunLayer = createSunLayer(garden);
    const suggestions = buildReviewSuggestions({
      garden,
      sunLayer,
      warnings: findPlanWarnings(garden, { sunLayer, sunSeason: 'summer' }),
    });
    const shadeMove = suggestions.find(
      (suggestion) => suggestion.type === 'moveShadeTolerantCrop',
    );

    expect(shadeMove).toBeDefined();

    const nextGarden = applyReviewSuggestionActions(
      garden,
      shadeMove?.actions ?? [],
    );
    const moved = nextGarden.plantings.find(
      (planting) => planting.id === 'lettuce-1',
    );

    expect(moved?.xFt).toBeGreaterThanOrEqual(4);
    expect(moved?.notes).toContain('partial shade');
  });

  it('keeps note-only diagnostics out of the review proposal inbox', () => {
    const garden: Garden = {
      ...createDefaultGarden('user-a'),
      harvestEvents: [
        {
          amountText: '2 lb',
          cropId: 'tomato',
          gardenId: 'user-a',
          harvestedOn: '2025-08-15',
          id: 'harvest-1',
          notes: '',
          plantingId: 'old-tomato',
          quantity: 2,
          unit: 'lb',
        },
      ],
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'old-tomato',
            label: 'Old tomato',
            xFt: 3,
            yFt: 3,
          }),
          cropId: 'tomato',
          plantedOn: '2025-05-15',
          status: 'harvested',
        },
        {
          ...createDefaultPlanting({
            id: 'new-tomato',
            label: 'New tomato',
            xFt: 4,
            yFt: 3,
          }),
          cropId: 'tomato',
          plannedFor: '2026-05-15',
        },
      ],
      structures: [
        {
          ...createDefaultStructure({
            id: 'bed-1',
            type: 'raisedBed',
            xFt: 1,
            yFt: 1,
          }),
          label: 'Main bed',
        },
      ],
    };
    const warnings = findPlanWarnings(garden, {
      now: new Date('2026-04-20T12:00:00.000Z'),
    });
    const suggestions = buildReviewSuggestions({
      garden,
      sunLayer: null,
      warnings,
    });

    expect(warnings.some((warning) => warning.kind === 'rotation')).toBe(true);
    expect(
      suggestions.some(
        (suggestion) => suggestion.type === 'flagRotationConcern',
      ),
    ).toBe(false);
  });

  it('labels review moves for planted crops as physical moves', () => {
    const garden: Garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'tomato-1',
            label: 'Tomato 1',
            xFt: 2,
            yFt: 2,
          }),
          matureSpreadInches: 24,
          spacingInches: 24,
          status: 'planted',
        },
        {
          ...createDefaultPlanting({
            id: 'tomato-2',
            label: 'Tomato 2',
            xFt: 2.25,
            yFt: 2.25,
          }),
          matureSpreadInches: 24,
          spacingInches: 24,
          status: 'planted',
        },
      ],
    };
    const suggestions = buildReviewSuggestions({
      garden,
      sunLayer: null,
      warnings: findPlanWarnings(garden),
    });
    const splitMove = suggestions.find(
      (suggestion) => suggestion.type === 'splitOvercrowdedPlanting',
    );

    expect(splitMove).toMatchObject({
      relocationImpact: 'physicalMove',
    });
  });

  it('keeps planted optimizer proposal crops when replacing layouts', () => {
    const anchored = {
      ...createDefaultPlanting({
        id: '[auto-layout]-old-tomato',
        label: 'Tomato',
        xFt: 2,
        yFt: 2,
      }),
      notes: '[auto-layout] accepted last week',
      status: 'growing' as const,
    };
    const next = createDefaultPlanting({
      id: '[auto-layout]-new-lettuce',
      label: 'Lettuce',
      xFt: 5,
      yFt: 2,
    });
    const garden: Garden = {
      ...createDefaultGarden('user-a'),
      plantings: [anchored],
    };
    const result = applyReviewSuggestionActions(garden, [
      {
        kind: 'replaceAutoLayoutProposal',
        plantings: [next],
        structures: [],
      },
    ]);

    expect(result.plantings.map((planting) => planting.id)).toEqual([
      anchored.id,
      next.id,
    ]);
  });
});

function createSunLayer(garden: Garden): SunShadeLayer {
  return {
    areas: [
      {
        depthFt: garden.plot.depthFt,
        exposure: 'fullSun',
        id: 'full-sun',
        source: 'manual',
        sunHours: 7,
        widthFt: 4,
        xFt: 0,
        yFt: 0,
      },
      {
        depthFt: garden.plot.depthFt,
        exposure: 'partSun',
        id: 'part-sun',
        source: 'manual',
        sunHours: 5,
        widthFt: 4,
        xFt: 4,
        yFt: 0,
      },
    ],
    cellSizeFt: 1,
    fullSunHours: null,
    gardenId: garden.id,
    generatedAtIso: null,
    id: 'sun-summer',
    label: 'Summer',
    modelVersion: 'test',
    observedOn: null,
    representativeDate: '06-21',
    season: 'summer',
  };
}
