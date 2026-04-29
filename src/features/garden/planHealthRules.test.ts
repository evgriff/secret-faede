import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  type Garden,
} from '../../domain/gardens/GardenRepository';
import { findPlanWarnings } from './gardenPlanning';
import { buildPlanHealthReport } from './planHealthRules';

describe('planHealthRules', () => {
  it('catches missing tomato support and mulch add-ons without access-path issues', () => {
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
          plantCount: 2,
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
          mulched: false,
        },
        {
          ...createDefaultStructure({
            accessibleMode: true,
            id: 'path-1',
            type: 'pathway',
            xFt: 9,
            yFt: 0,
          }),
          label: 'Side path',
          widthFt: 2.5,
        },
      ],
    };
    const report = buildPlanHealthReport({
      garden,
      now: new Date('2026-04-20T12:00:00.000Z'),
      warnings: findPlanWarnings(garden),
    });

    expect(
      report.mustFixIssues.some((issue) => issue.type === 'pathTooNarrow'),
    ).toBe(false);
    expect(report.recommendedImprovements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Mulch reminder',
          type: 'mulchReminder',
        }),
      ]),
    );
    expect(report.materialAddOns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Tomato cage',
          quantity: 2,
          type: 'cage',
        }),
        expect.objectContaining({
          label: 'Main bed mulch',
          type: 'mulch',
          unit: 'sq ft',
        }),
      ]),
    );
    expect(report.decisionGroups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: 'support',
          label: 'Support',
          cautionCount: 1,
        }),
        expect.objectContaining({
          category: 'care',
          label: 'Season care',
        }),
      ]),
    );
    expect(
      report.decisionGroups.some((group) => group.category === 'pathway'),
    ).toBe(false);
  });

  it('surfaces bed capacity, rotation caution, and seasonal row cover from real layout data', () => {
    const garden: Garden = {
      ...createDefaultGarden('user-a'),
      harvestEvents: [
        {
          amountText: '3 lb',
          cropId: 'tomato',
          gardenId: 'user-a',
          harvestedOn: '2025-08-15',
          id: 'harvest-1',
          notes: '',
          plantingId: 'old-tomato',
          quantity: 3,
          unit: 'lb',
        },
      ],
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'old-tomato',
            label: 'Old tomato',
            xFt: 2,
            yFt: 2,
          }),
          cropId: 'tomato',
          plantedOn: '2025-05-10',
          status: 'harvested',
        },
        {
          ...createDefaultPlanting({
            id: 'new-tomato',
            label: 'New tomato',
            xFt: 2,
            yFt: 2,
          }),
          cropId: 'tomato',
          matureSpreadInches: 36,
          plannedFor: '2026-04-25',
          spacingInches: 36,
        },
        {
          ...createDefaultPlanting({
            id: 'pepper-1',
            label: 'Pepper',
            xFt: 3.5,
            yFt: 2,
          }),
          cropId: 'pepper',
          matureSpreadInches: 30,
          plannedFor: '2026-04-25',
          spacingInches: 30,
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
          depthFt: 3,
          label: 'Solanaceae bed',
          widthFt: 4,
        },
      ],
    };
    const report = buildPlanHealthReport({
      garden,
      now: new Date('2026-04-20T12:00:00.000Z'),
      warnings: findPlanWarnings(garden, {
        now: new Date('2026-04-20T12:00:00.000Z'),
      }),
    });

    expect(report.mustFixIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Bed over-capacity',
          type: 'bedOverCapacity',
        }),
      ]),
    );
    expect(report.recommendedImprovements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Crop family rotation caution',
          type: 'cropFamilyRotationCaution',
        }),
        expect.objectContaining({
          title: 'Season protection suggested',
          type: 'rowCoverSuggested',
        }),
      ]),
    );
    expect(report.materialAddOns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'rowCover',
          unit: 'sq ft',
        }),
      ]),
    );
    expect(report.decisionGroups[0]).toEqual(
      expect.objectContaining({
        category: 'bedFit',
        mustFixCount: 1,
      }),
    );
  });

  it('uses walkable path width, water-source reach, and crop-specific cage data', () => {
    const garden: Garden = {
      ...createDefaultGarden('user-a'),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'eggplant-1',
            label: 'Eggplant',
            xFt: 31,
            yFt: 2,
          }),
          cropId: 'eggplant',
        },
      ],
      plot: {
        ...createDefaultGarden('user-a').plot,
        depthFt: 8,
        widthFt: 40,
      },
      structures: [
        {
          ...createDefaultStructure({
            id: 'bed-far',
            type: 'raisedBed',
            xFt: 30,
            yFt: 1,
          }),
          label: 'Far bed',
        },
        {
          ...createDefaultStructure({
            id: 'path-cross',
            type: 'pathway',
            xFt: 28,
            yFt: 5,
          }),
          depthFt: 1,
          label: 'Cross path',
          widthFt: 8,
        },
      ],
    };
    const report = buildPlanHealthReport({
      garden,
      now: new Date('2026-04-20T12:00:00.000Z'),
      warnings: findPlanWarnings(garden),
    });

    expect(report.recommendedImprovements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Stake support missing',
          type: 'cropSupportMissing',
        }),
      ]),
    );
    expect(
      report.recommendedImprovements.some(
        (issue) => issue.type === 'pathTooNarrow',
      ),
    ).toBe(false);
    expect(report.materialAddOns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Eggplant stake',
          type: 'stake',
        }),
      ]),
    );
  });
});
