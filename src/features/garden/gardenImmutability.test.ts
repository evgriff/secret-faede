import { createDefaultPlanting } from '../../domain/gardens/GardenRepository';
import {
  canManuallyMovePlanting,
  canOptimizerMovePlanting,
  doesPlantingReserveSpace,
  isPlantingAnchoredForOptimizer,
} from './gardenImmutability';

describe('gardenImmutability', () => {
  it('keeps planted and growing crops anchored until relocation is explicit', () => {
    const planted = {
      ...createDefaultPlanting({
        id: 'tomato-1',
        label: 'Tomato',
        xFt: 2,
        yFt: 2,
      }),
      status: 'planted' as const,
    };

    expect(canManuallyMovePlanting(planted)).toBe(false);
    expect(canOptimizerMovePlanting(planted)).toBe(false);
    expect(isPlantingAnchoredForOptimizer(planted)).toBe(true);

    expect(canManuallyMovePlanting({ ...planted, allowRelocation: true })).toBe(
      true,
    );
    expect(
      canOptimizerMovePlanting({ ...planted, allowRelocation: true }),
    ).toBe(true);
  });

  it('frees harvested and removed crops from layout blocking', () => {
    const harvested = {
      ...createDefaultPlanting({
        id: 'radish-1',
        label: 'Radish',
        xFt: 2,
        yFt: 2,
      }),
      status: 'harvested' as const,
    };

    expect(doesPlantingReserveSpace(harvested)).toBe(false);
    expect(isPlantingAnchoredForOptimizer(harvested)).toBe(false);
    expect(canOptimizerMovePlanting(harvested)).toBe(false);
  });
});
