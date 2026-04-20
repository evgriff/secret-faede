import {
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
} from '../../domain/gardens/GardenRepository';
import { findPlanWarnings, getPlantingFootprint } from './gardenPlanning';

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
    expect(
      warnings.some((warning) => warning.id.startsWith('structure-')),
    ).toBe(true);
  });
});
