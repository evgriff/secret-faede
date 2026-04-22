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
  it('builds support and path suggestions that apply to the draft', () => {
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
    const widenPath = suggestions.find(
      (suggestion) => suggestion.type === 'widenPath',
    );

    expect(support).toBeDefined();
    expect(widenPath).toBeDefined();

    const withSupport = applyReviewSuggestionActions(
      garden,
      support?.actions ?? [],
    );
    const withPath = applyReviewSuggestionActions(
      garden,
      widenPath?.actions ?? [],
    );

    expect(
      withSupport.structures.some(
        (structure) =>
          structure.type === 'trellis' &&
          structure.label.includes('cage') &&
          structure.notes.includes('[review]'),
      ),
    ).toBe(true);
    expect(
      withPath.structures.find((structure) => structure.id === 'path-1')
        ?.widthFt,
    ).toBe(4);
  });

  it('widens the narrow side of horizontal paths instead of assuming width', () => {
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
    const widenPath = suggestions.find(
      (suggestion) => suggestion.type === 'widenPath',
    );

    expect(widenPath).toBeDefined();

    const nextGarden = applyReviewSuggestionActions(
      garden,
      widenPath?.actions ?? [],
    );
    const path = nextGarden.structures.find(
      (structure) => structure.id === 'path-horizontal',
    );

    expect(path?.widthFt).toBe(8);
    expect(path?.depthFt).toBe(3);
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
