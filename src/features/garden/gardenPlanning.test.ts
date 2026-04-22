import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import {
  findPlanWarnings,
  formatPlanWarningDecisionSummary,
  getPlanWarningDecisionCategory,
  getPlanWarningTaxonomy,
  getPlantingFootprint,
  isCanvasPlanWarning,
} from './gardenPlanning';

describe('gardenPlanning', () => {
  it('derives real planting footprints from planting mode fields', () => {
    const row = {
      ...createDefaultPlanting({
        id: 'row-1',
        label: 'Beans',
        xFt: 6,
        yFt: 4,
      }),
      mode: 'trellisLine' as const,
      rowLengthFt: 8,
      rowSpacingInches: 12,
      spacingInches: 6,
    };

    expect(getPlantingFootprint(row)).toMatchObject({
      depthFt: 1,
      widthFt: 8,
      xFt: 2,
      yFt: 3.5,
    });
  });

  it('warns when mature planting spacing overlaps blocking structures', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'tomato-a',
            label: 'Tomato A',
            xFt: 6,
            yFt: 4,
          }),
          matureSpreadInches: 36,
          spacingInches: 24,
        },
        {
          ...createDefaultPlanting({
            id: 'tomato-b',
            label: 'Tomato B',
            xFt: 7,
            yFt: 4,
          }),
          matureSpreadInches: 36,
          spacingInches: 24,
        },
      ],
      structures: [
        createDefaultStructure({
          id: 'path-1',
          type: 'pathway',
          xFt: 5,
          yFt: 3,
        }),
      ],
    };

    const warnings = findPlanWarnings(garden);

    expect(warnings.some((warning) => warning.id.startsWith('spacing-'))).toBe(
      true,
    );
    expect(warnings.some((warning) => warning.kind === 'pathway')).toBe(true);
  });

  it('collapses repeated spacing collisions into one grouped warning', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        createDefaultPlanting({
          id: 'tomato-a',
          label: 'Tomato A',
          xFt: 4,
          yFt: 4,
        }),
        createDefaultPlanting({
          id: 'tomato-b',
          label: 'Tomato B',
          xFt: 4.25,
          yFt: 4,
        }),
        createDefaultPlanting({
          id: 'pepper-a',
          label: 'Pepper A',
          xFt: 4.5,
          yFt: 4,
        }),
      ].map((planting) => ({
        ...planting,
        matureSpreadInches: 36,
        plannedFor: '2026-05-15',
        spacingInches: 36,
      })),
    };
    const warnings = findPlanWarnings(garden, {
      now: new Date('2026-04-20T12:00:00.000Z'),
    });
    const spacingWarnings = warnings.filter(
      (warning) => warning.kind === 'spacing',
    );

    expect(spacingWarnings).toHaveLength(1);
    const spacingWarning = spacingWarnings[0];

    if (!spacingWarning) {
      throw new Error('Expected grouped spacing warning.');
    }

    expect(spacingWarning).toMatchObject({
      itemIds: ['pepper-a', 'tomato-a', 'tomato-b'],
      title: 'Spacing collision',
    });
    expect(getPlanWarningTaxonomy(spacingWarning)).toBe(
      'recommendedImprovement',
    );
    expect(getPlanWarningDecisionCategory(spacingWarning)).toBe('spacing');
    expect(formatPlanWarningDecisionSummary(spacingWarnings)).toEqual([
      'Spacing: 1 decision',
    ]);
    expect(isCanvasPlanWarning(spacingWarning)).toBe(false);
  });

  it('flags narrow paths, path continuity, and missing bed clearance', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
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
        {
          ...createDefaultStructure({
            id: 'path-1',
            type: 'pathway',
            xFt: 9.25,
            yFt: 7,
          }),
          accessiblePath: true,
          continuousPath: false,
          depthFt: 1,
          label: 'Side path',
          widthFt: 2.5,
        },
      ],
    };

    const warnings = findPlanWarnings(garden);

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'path-width-path-1',
          title: 'Path too narrow',
        }),
        expect.objectContaining({
          id: 'path-continuity-path-1',
          title: 'Path continuity check',
        }),
        expect.objectContaining({
          id: 'path-clearance-bed-1',
          title: 'Working clearance missing',
        }),
      ]),
    );
  });

  it('accepts a continuous path inside a bed working clearance', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
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
        {
          ...createDefaultStructure({
            id: 'path-1',
            type: 'pathway',
            xFt: 1,
            yFt: 5.25,
          }),
          depthFt: 3,
        },
      ],
    };

    const warnings = findPlanWarnings(garden);

    expect(
      warnings.some((warning) => warning.id === 'path-clearance-bed-1'),
    ).toBe(false);
  });

  it('warns for sun mismatch, missing supports, and container fit', () => {
    const garden = {
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
          matureSpreadInches: 36,
          spacingInches: 24,
          sunRequirement: 'fullSun' as const,
        },
      ],
      structures: [
        createDefaultStructure({
          id: 'container-1',
          type: 'container',
          xFt: 1,
          yFt: 1,
        }),
      ],
    };

    const warnings = findPlanWarnings(garden, {
      sunLayer: createSunLayer('partShade', [
        {
          heightFt: 12,
          itemId: 'saved-shade-source',
          itemType: 'structure',
          kind: 'treeObstacle',
          label: 'Saved shade pocket',
        },
      ]),
      sunSeason: 'summer',
    });

    expect(warnings.map((warning) => warning.kind)).toEqual(
      expect.arrayContaining(['container', 'sun', 'trellis']),
    );
    const sunWarning = warnings.find((warning) => warning.kind === 'sun');

    expect(sunWarning).toMatchObject({
      fix: expect.stringContaining(
        'saved-source shade from Saved shade pocket',
      ),
      message: expect.stringContaining(
        'saved-source shade from Saved shade pocket',
      ),
      severity: 'info',
      uncertainty: 'modeled',
    });
    expect(sunWarning ? getPlanWarningTaxonomy(sunWarning) : null).toBe(
      'informationalCaution',
    );
    expect(sunWarning ? getPlanWarningDecisionCategory(sunWarning) : null).toBe(
      'sun',
    );
  });

  it('keeps modeled cautions off the canvas while preserving must-fix issues', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'tomato-1',
            label: 'Tomato',
            xFt: 4,
            yFt: 4,
          }),
          cropId: 'tomato',
          sunRequirement: 'fullSun' as const,
        },
      ],
      structures: [
        createDefaultStructure({
          id: 'bed-outside',
          type: 'raisedBed',
          xFt: 13,
          yFt: 1,
        }),
      ],
    };
    const warnings = findPlanWarnings(garden, {
      sunLayer: createSunLayer('partShade'),
      sunSeason: 'summer',
    });
    const boundsWarning = warnings.find((warning) => warning.kind === 'bounds');
    const sunWarning = warnings.find((warning) => warning.kind === 'sun');

    expect(boundsWarning).toBeDefined();
    expect(sunWarning).toBeDefined();
    expect(boundsWarning ? getPlanWarningTaxonomy(boundsWarning) : null).toBe(
      'mustFix',
    );
    expect(sunWarning ? getPlanWarningTaxonomy(sunWarning) : null).toBe(
      'informationalCaution',
    );
    expect(boundsWarning ? isCanvasPlanWarning(boundsWarning) : false).toBe(
      true,
    );
    expect(sunWarning ? isCanvasPlanWarning(sunWarning) : true).toBe(false);
  });

  it('does not report spacing collisions for dated succession windows', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'radish-1',
            label: 'Radish',
            xFt: 4,
            yFt: 4,
          }),
          cropId: 'radish',
          plantedOn: '2026-04-01',
          spacingInches: 12,
        },
        {
          ...createDefaultPlanting({
            id: 'lettuce-1',
            label: 'Lettuce succession',
            xFt: 4,
            yFt: 4,
          }),
          cropId: 'lettuce',
          plannedFor: '2026-05-25',
          spacingInches: 12,
        },
      ],
    };

    const warnings = findPlanWarnings(garden, {
      now: new Date('2026-04-20T12:00:00.000Z'),
    });

    expect(warnings.some((warning) => warning.kind === 'spacing')).toBe(false);
  });

  it('does not over-warn near-miss future succession timing', () => {
    const garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'radish-1',
            label: 'Radish',
            xFt: 4,
            yFt: 4,
          }),
          cropId: 'radish',
          plantedOn: '2026-04-01',
          spacingInches: 12,
        },
        {
          ...createDefaultPlanting({
            id: 'lettuce-1',
            label: 'Lettuce succession',
            xFt: 4,
            yFt: 4,
          }),
          cropId: 'lettuce',
          plannedFor: '2026-05-10',
          spacingInches: 12,
        },
      ],
    };

    const warnings = findPlanWarnings(garden, {
      now: new Date('2026-04-20T12:00:00.000Z'),
    });

    expect(warnings.some((warning) => warning.kind === 'spacing')).toBe(false);
  });

  it('surfaces saved-history rotation caution without overclaiming precision', () => {
    const garden = {
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
          unit: 'lb' as const,
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
          status: 'harvested' as const,
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

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'rotation',
          title: 'Rotation avoid',
        }),
      ]),
    );
  });
});

function createSunLayer(
  exposure: SunShadeLayer['areas'][number]['exposure'],
  shadeSources: SunShadeLayer['areas'][number]['shadeSources'] = [],
) {
  return {
    areas: [
      {
        depthFt: 8,
        exposure,
        id: 'sun-area-1',
        ...(shadeSources.length > 0 ? { shadeSources } : {}),
        source: 'modeled' as const,
        sunHours: 2.5,
        widthFt: 12,
        xFt: 0,
        yFt: 0,
      },
    ],
    cellSizeFt: 1,
    fullSunHours: null,
    gardenId: 'user-a',
    generatedAtIso: '2026-04-20T12:00:00.000Z',
    id: 'sun-summer',
    label: 'Summer sun',
    modelVersion: 'test',
    observedOn: null,
    representativeDate: '06-21',
    season: 'summer' as const,
  } satisfies SunShadeLayer;
}
