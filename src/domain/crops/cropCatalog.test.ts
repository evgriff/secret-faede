import { cropCatalog, filterCropCatalog, getCropById } from './cropCatalog';

describe('cropCatalog', () => {
  it('contains at least 75 practical crops with gardening defaults', () => {
    expect(cropCatalog.length).toBeGreaterThanOrEqual(75);
    expect(cropCatalog.every((crop) => crop.spacingInches !== null)).toBe(true);
    expect(
      cropCatalog.every((crop) => crop.weeklyWaterNeedInches !== null),
    ).toBe(true);
  });

  it('supports search and practical filters', () => {
    const crops = filterCropCatalog({
      query: 'tomato',
      sunRequirement: 'fullSun',
      waterNeeds: 'high',
    });

    expect(crops.map((crop) => crop.id)).toContain('tomato');
  });

  it('looks up crops by id', () => {
    expect(getCropById('basil')).toMatchObject({
      commonName: 'Basil',
      sowMethod: 'both',
    });
  });
});
