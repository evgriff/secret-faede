import { cropCatalog, filterCropCatalog, getCropById } from './cropCatalog';

describe('cropCatalog', () => {
  it('contains a broad offline home-garden library with gardening defaults', () => {
    expect(cropCatalog.length).toBeGreaterThanOrEqual(500);
    expect(cropCatalog.every((crop) => crop.spacingInches !== null)).toBe(true);
    expect(
      cropCatalog.every((crop) => crop.weeklyWaterNeedInches !== null),
    ).toBe(true);
    expect(cropCatalog.every((crop) => crop.sourceTags.length > 0)).toBe(true);
    expect(cropCatalog.every((crop) => crop.completenessScore > 0.7)).toBe(
      true,
    );
    expect(cropCatalog.every((crop) => crop.source)).toBe(true);
    expect(cropCatalog.every((crop) => crop.lastRefreshedIso)).toBe(true);
    expect(cropCatalog.every((crop) => crop.rootDepthInches !== null)).toBe(
      true,
    );
  });

  it('covers vegetables, herbs, fruits, flowers, cover crops, and berries', () => {
    const categories = new Set(cropCatalog.map((crop) => crop.category));
    const roles = new Set(cropCatalog.flatMap((crop) => crop.roles));

    expect(categories.has('vegetable')).toBe(true);
    expect(categories.has('herb')).toBe(true);
    expect(categories.has('fruit')).toBe(true);
    expect(categories.has('flower')).toBe(true);
    expect(roles.has('coverCrop')).toBe(true);
    expect(roles.has('berry')).toBe(true);
    expect(roles.has('pollinator')).toBe(true);
  });

  it('supports fast search, aliases, and practical filters', () => {
    const crops = filterCropCatalog({
      category: 'fruit',
      query: 'tomato',
      sunRequirement: 'fullSun',
      waterNeeds: 'high',
    });

    expect(crops.map((crop) => crop.id)).toContain('tomato');
    expect(crops[0]?.id).toBe('tomato');

    expect(
      filterCropCatalog({
        query: 'Solanum lycopersicum',
      }).map((crop) => crop.id),
    ).toContain('tomato');
  });

  it('ranks exact common crops ahead of generated variety clutter', () => {
    expect(filterCropCatalog({ query: 'tomato' })[0]?.id).toBe('tomato');
    expect(filterCropCatalog({ query: 'strawberry' })[0]?.id).toBe(
      'strawberry',
    );
    expect(filterCropCatalog({ query: 'coriander' })[0]?.id).toBe(
      'cilantro-flower',
    );
  });

  it('still lets specific variety searches win when requested', () => {
    expect(filterCropCatalog({ query: 'winter kale' })[0]?.id).toBe(
      'kale-winter',
    );
  });

  it('looks up crops by id', () => {
    expect(getCropById('basil')).toMatchObject({
      aliases: expect.any(Array),
      commonName: 'Basil',
      manualOverride: true,
      sowMethod: 'both',
      source: 'trefle+curated-overlay',
    });
  });
});
