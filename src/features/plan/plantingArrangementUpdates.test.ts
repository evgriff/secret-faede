import { createDefaultPlanting } from '../../domain/gardens/GardenRepository';
import { toPlantingArrangementUpdate } from './plantingArrangementUpdates';

describe('toPlantingArrangementUpdate', () => {
  it('derives the visible footprint dimensions from plant spacing edits', () => {
    const plant = {
      ...createDefaultPlanting({
        id: 'pepper',
        label: 'Pepper',
        xFt: 4,
        yFt: 4,
      }),
      cropId: 'tomato-beefsteak',
      matureSpreadInches: 36,
      mode: 'block' as const,
      plantCount: 4,
      spacingInches: null,
    };

    expect(toPlantingArrangementUpdate(plant, { spacingInches: 12 })).toEqual(
      expect.objectContaining({
        blockDepthFt: 1,
        blockWidthFt: 1,
        clusterRadiusFt: null,
        rowLengthFt: null,
        spacingInches: 12,
      }),
    );
  });

  it('preserves the current spacing basis when only quantity changes', () => {
    const plant = {
      ...createDefaultPlanting({
        id: 'carrot',
        label: 'Carrot',
        xFt: 4,
        yFt: 4,
      }),
      mode: 'row' as const,
      plantCount: 3,
      rowLengthFt: 2,
      spacingInches: 12,
    };

    const update = toPlantingArrangementUpdate(plant, { plantCount: 5 });

    expect(update).toEqual(
      expect.objectContaining({
        plantCount: 5,
        rowLengthFt: 4,
        trellisLengthFt: null,
      }),
    );
    expect(update).not.toHaveProperty('spacingInches');
  });
});
