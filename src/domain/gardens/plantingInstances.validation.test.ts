import { parseGarden } from './GardenRepository';

describe('planting instance validation', () => {
  it('derives individual plant instances for aggregate planting records', () => {
    const garden = parseGarden('user-a', {
      plantings: [
        {
          id: 'carrot-row',
          label: 'Carrot',
          mode: 'row',
          plantCount: 3,
          rowLengthFt: 4,
          spacingInches: 24,
          xFt: 4,
          yFt: 3,
        },
      ],
      plot: {
        depthFt: 8,
        widthFt: 12,
      },
    });

    expect(garden.plantings[0]).toMatchObject({
      plantCount: 3,
      xFt: 4,
      yFt: 3,
    });
    expect(garden.plantings[0]?.instances).toEqual([
      { id: 'carrot-row-plant-1', label: 'Carrot 1', xFt: 2, yFt: 3 },
      { id: 'carrot-row-plant-2', label: 'Carrot 2', xFt: 4, yFt: 3 },
      { id: 'carrot-row-plant-3', label: 'Carrot 3', xFt: 6, yFt: 3 },
    ]);
  });

  it('preserves saved plant instances as canonical feet-based node positions', () => {
    const garden = parseGarden('user-a', {
      plantings: [
        {
          id: 'pepper-group',
          instances: [
            { id: 'pepper-a', label: 'Pepper A', xFt: 2, yFt: 4 },
            { id: 'pepper-b', label: 'Pepper B', xFt: 6, yFt: 4 },
          ],
          label: 'Pepper',
          mode: 'cluster',
          plantCount: 9,
          xFt: 99,
          yFt: 99,
        },
      ],
      plot: {
        depthFt: 8,
        widthFt: 12,
      },
    });

    expect(garden.plantings[0]).toMatchObject({
      plantCount: 2,
      xFt: 4,
      yFt: 4,
    });
    expect(garden.plantings[0]?.instances).toEqual([
      { id: 'pepper-a', label: 'Pepper A', xFt: 2, yFt: 4 },
      { id: 'pepper-b', label: 'Pepper B', xFt: 6, yFt: 4 },
    ]);
  });
});
