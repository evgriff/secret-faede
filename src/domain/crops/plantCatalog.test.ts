import {
  filterPlantCatalogEntries,
  getPlantCatalogEntry,
  plantCatalog,
} from './plantCatalog';

describe('plant catalog scaffolding', () => {
  it('adapts existing crop data into redesign plant entries', () => {
    const tomato = getPlantCatalogEntry('tomato');

    expect(tomato).toMatchObject({
      commonName: 'Tomato',
      compatiblePlacementModes: ['cluster', 'row'],
      defaultSpacingInches: 24,
      defaultSupport: {
        kind: 'perPlant',
        perPlant: true,
        recommended: true,
        type: 'cage',
      },
      difficulty: 'demanding',
      harvest: {
        cycle: 'continuous',
      },
      lifecycle: 'annual',
      timing: {
        minimumSoilTempF: 75,
        preferredSeason: 'warmSeason',
      },
      waterNeed: 'high',
    });
  });

  it('keeps catalog search in plant-entry terms without replacing crop data', () => {
    const results = filterPlantCatalogEntries({
      query: 'lettuce',
      sunRequirement: 'partSun',
    });

    expect(plantCatalog.length).toBeGreaterThanOrEqual(500);
    expect(results[0]).toMatchObject({
      commonName: 'Lettuce',
      timing: {
        minimumSoilTempF: 55,
        preferredSeason: 'coolSeason',
      },
    });
  });
});
