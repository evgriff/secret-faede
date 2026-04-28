import { createDefaultPlanting } from './models';
import { fitPlantingToAreaRect } from './plantingAreaFit';

describe('plantingAreaFit', () => {
  it('converts a single plant into a block area and increases count from spacing', () => {
    const result = fitPlantingToAreaRect(
      {
        ...createDefaultPlanting({
          id: 'lettuce',
          label: 'Lettuce',
          xFt: 1,
          yFt: 1,
        }),
        matureSpreadInches: 12,
        spacingInches: 12,
      },
      { depthFt: 4, widthFt: 4, xFt: 2, yFt: 3 },
    );

    expect(result.planting).toMatchObject({
      blockDepthFt: 3,
      blockWidthFt: 3,
      mode: 'block',
      plantCount: 16,
      rowCount: 4,
      xFt: 4,
      yFt: 5,
    });
    expect(result.planting.instances).toHaveLength(16);
    expect(result.planting.instances[0]).toMatchObject({
      xFt: 2.5,
      yFt: 3.5,
    });
    expect(result.planting.instances.at(-1)).toMatchObject({
      xFt: 5.5,
      yFt: 6.5,
    });
  });

  it('uses row spacing and converts row plantings to block areas', () => {
    const result = fitPlantingToAreaRect(
      {
        ...createDefaultPlanting({
          id: 'beans',
          label: 'Beans',
          xFt: 1,
          yFt: 1,
        }),
        mode: 'trellisLine',
        plantCount: 3,
        rowLengthFt: 6,
        rowSpacingInches: 24,
        spacingInches: 12,
      },
      { depthFt: 5, widthFt: 4, xFt: 0, yFt: 0 },
    );

    expect(result).toMatchObject({ columns: 4, rows: 3 });
    expect(result.planting).toMatchObject({
      mode: 'block',
      plantCount: 12,
      rowLengthFt: null,
      trellisLengthFt: null,
    });
  });

  it('falls back to mature spread and then twelve inch spacing', () => {
    const matureSpreadResult = fitPlantingToAreaRect(
      {
        ...createDefaultPlanting({
          id: 'squash',
          label: 'Squash',
          xFt: 1,
          yFt: 1,
        }),
        matureSpreadInches: 24,
        spacingInches: null,
      },
      { depthFt: 5, widthFt: 5, xFt: 0, yFt: 0 },
    );
    const fallbackResult = fitPlantingToAreaRect(
      {
        ...createDefaultPlanting({
          id: 'mystery',
          label: 'Mystery',
          xFt: 1,
          yFt: 1,
        }),
        matureSpreadInches: null,
        spacingInches: null,
      },
      { depthFt: 3, widthFt: 3, xFt: 0, yFt: 0 },
    );

    expect(matureSpreadResult.planting.plantCount).toBe(4);
    expect(fallbackResult.planting.plantCount).toBe(9);
  });

  it('keeps tiny areas as one permissive planning plant', () => {
    const result = fitPlantingToAreaRect(
      {
        ...createDefaultPlanting({
          id: 'tomato',
          label: 'Tomato',
          xFt: 1,
          yFt: 1,
        }),
        matureSpreadInches: 36,
        spacingInches: 24,
      },
      { depthFt: 0.5, widthFt: 0.5, xFt: 2, yFt: 2 },
    );

    expect(result.planting).toMatchObject({
      mode: 'block',
      plantCount: 1,
    });
    expect(result.planting.instances).toEqual([
      { id: 'tomato-plant-1', label: 'Tomato', xFt: 2.25, yFt: 2.25 },
    ]);
  });

  it('uses a smaller spacing override to fit more plants than mature spread', () => {
    const result = fitPlantingToAreaRect(
      {
        ...createDefaultPlanting({
          id: 'pepper',
          label: 'Pepper',
          xFt: 1,
          yFt: 1,
        }),
        matureSpreadInches: 36,
        spacingInches: 12,
      },
      { depthFt: 4, widthFt: 4, xFt: 0, yFt: 0 },
    );
    const catalogResult = fitPlantingToAreaRect(
      {
        ...createDefaultPlanting({
          id: 'pepper-catalog',
          label: 'Pepper',
          xFt: 1,
          yFt: 1,
        }),
        matureSpreadInches: 36,
        spacingInches: null,
      },
      { depthFt: 4, widthFt: 4, xFt: 0, yFt: 0 },
    );

    expect(result.planting.plantCount).toBeGreaterThan(
      catalogResult.planting.plantCount ?? 0,
    );
    expect(result.planting.plantCount).toBe(16);
    expect(catalogResult.planting.plantCount).toBe(1);
  });
});
