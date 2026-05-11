import { getCropById } from './cropCatalog';
import {
  filterPlantCatalogEntries,
  getPlantCatalogEntry,
  plantCatalog,
} from './plantCatalog';
import {
  detroitPlantLocationContext,
  explainPlantLocationMatch,
  scorePlantLocationMatch,
} from './plantLocationMatch';

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

  it('uses Detroit and southeast Michigan as the default location context', () => {
    expect(detroitPlantLocationContext).toMatchObject({
      averageFirstFrost: '10-15',
      averageLastFrost: '04-30',
      firstFallFrostWindow: {
        end: '10-31',
        start: '10-15',
      },
      hardinessZone: '6b',
      lastSpringFrostWindow: {
        end: '04-30',
        start: '04-15',
      },
      regionName: 'Detroit / southeast Michigan',
      source: 'detroitDefault',
    });
  });

  it('scores location match as honest bands rather than precise promises', () => {
    const lettuce = getCropById('lettuce');
    const watermelon = getCropById('watermelon');

    if (!lettuce || !watermelon) {
      throw new Error('Expected lettuce and watermelon in the crop catalog.');
    }

    const lettuceMatch = scorePlantLocationMatch({
      crop: lettuce,
      sunExposureAtPlacement: 'partSun',
      today: new Date('2026-05-10T12:00:00.000Z'),
    });
    const watermelonMatch = scorePlantLocationMatch({
      crop: watermelon,
      sunExposureAtPlacement: 'partShade',
      today: new Date('2026-04-15T12:00:00.000Z'),
    });

    expect(lettuceMatch).toMatchObject({
      band: 'good',
      label: 'Good match',
    });
    expect(watermelonMatch).toMatchObject({
      band: 'poor',
      label: 'Poor match',
    });
    expect(watermelonMatch.warnings.join(' ')).toMatch(
      /Warm-season|sun estimate/,
    );
  });

  it('explains location match using climate windows and not fake precision', () => {
    const basil = getCropById('basil');
    const carrot = getCropById('carrot');
    const rosemary = getCropById('rosemary');

    if (!basil || !carrot || !rosemary) {
      throw new Error('Expected basil, carrot, and rosemary in the catalog.');
    }

    expect(
      explainPlantLocationMatch({
        crop: basil,
        match: scorePlantLocationMatch({
          crop: basil,
          sunExposureAtPlacement: 'fullSun',
          today: new Date('2026-06-15T12:00:00.000Z'),
        }),
        today: new Date('2026-06-15T12:00:00.000Z'),
      }).headline,
    ).toMatch(/fit for Detroit spring\/summer/);

    expect(
      explainPlantLocationMatch({
        crop: carrot,
        match: scorePlantLocationMatch({
          crop: carrot,
          sunExposureAtPlacement: null,
          today: new Date('2026-09-20T12:00:00.000Z'),
        }),
        today: new Date('2026-09-20T12:00:00.000Z'),
      }).headline,
    ).toBe('Possible, but late for direct sow in this climate window');

    const rosemaryMatch = scorePlantLocationMatch({
      crop: rosemary,
      sunExposureAtPlacement: 'fullSun',
      today: new Date('2026-06-15T12:00:00.000Z'),
    });

    expect(rosemaryMatch.band).toBe('poor');
    expect(
      explainPlantLocationMatch({
        crop: rosemary,
        match: rosemaryMatch,
        today: new Date('2026-06-15T12:00:00.000Z'),
      }).headline,
    ).toBe('Perennial not winter-hardy for the 6b default zone');
  });
});
