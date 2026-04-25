import { getCropById } from '../../domain/crops/cropCatalog';
import { scoreCropSuitability } from '../../domain/crops/cropSuitability';
import { annArborClimateProfile } from '../../domain/gardens/GardenRepository';
import {
  compareCropPickerResults,
  formatTimingLabel,
  isLocationFit,
  type RankedCropPickerResult,
} from './cropPickerHelpers';

describe('cropPickerHelpers', () => {
  it('ranks location and timing fits ahead of later-season crops by default', () => {
    const lettuce = getCropById('lettuce');
    const tomato = getCropById('tomato');

    if (!lettuce || !tomato) {
      throw new Error('Expected lettuce and tomato in the crop catalog.');
    }

    const results = [
      buildRankedResult(tomato, 0, 'fullSun'),
      buildRankedResult(lettuce, 1, 'partSun'),
    ].sort((left, right) =>
      compareCropPickerResults(left, right, { query: '' }),
    );

    expect(results[0]?.crop.id).toBe('lettuce');
  });

  it('keeps search relevance ahead of fit sorting when a query is active', () => {
    const lettuce = getCropById('lettuce');
    const tomato = getCropById('tomato');

    if (!lettuce || !tomato) {
      throw new Error('Expected lettuce and tomato in the crop catalog.');
    }

    const results = [
      buildRankedResult(tomato, 0, 'fullSun'),
      buildRankedResult(lettuce, 1, 'partSun'),
    ].sort((left, right) =>
      compareCropPickerResults(left, right, { query: 'tom' }),
    );

    expect(results[0]?.crop.id).toBe('tomato');
  });

  it('treats only good and strong matches as Fits my location results', () => {
    const lettuce = getCropById('lettuce');

    if (!lettuce) {
      throw new Error('Expected lettuce in the crop catalog.');
    }

    const strongFit = buildRankedResult(lettuce, 0, 'partSun');
    const weakFit: RankedCropPickerResult = {
      ...strongFit,
      suitability: {
        ...strongFit.suitability,
        locationMatch: {
          ...strongFit.suitability.locationMatch,
          band: 'watch',
        },
      },
    };

    expect(isLocationFit(strongFit.suitability, 'fitsMyLocation')).toBe(true);
    expect(isLocationFit(weakFit.suitability, 'fitsMyLocation')).toBe(false);
  });

  it('orders plant-now timing ahead of wait-until-after-frost when search relevance is equal', () => {
    const lettuce = getCropById('lettuce');

    if (!lettuce) {
      throw new Error('Expected lettuce in the crop catalog.');
    }

    const plantNow = buildRankedResult(lettuce, 0, 'partSun');
    const waitUntilAfterFrost: RankedCropPickerResult = {
      ...plantNow,
      suitability: {
        ...plantNow.suitability,
        timing: {
          ...plantNow.suitability.timing,
          status: 'waitUntilAfterFrost',
        },
      },
    };
    const results = [waitUntilAfterFrost, plantNow].sort((left, right) =>
      compareCropPickerResults(left, right, { query: '' }),
    );

    expect(results[0]?.suitability.timing.status).toBe('plantNow');
    expect(
      formatTimingLabel(results[0]?.suitability.timing.status ?? 'plantNow'),
    ).toBe('Plant now');
  });
});

function buildRankedResult(
  crop: NonNullable<ReturnType<typeof getCropById>>,
  baseOrder: number,
  sunExposureAtPlacement: 'fullSun' | 'partSun',
): RankedCropPickerResult {
  return {
    baseOrder,
    crop,
    suitability: scoreCropSuitability({
      climateProfile: { ...annArborClimateProfile, source: 'user' },
      crop,
      location: {
        latitude: 42.3314,
        locationName: 'Detroit, MI',
        locationQuery: 'Detroit, MI',
        longitude: -83.0458,
        timezone: 'America/Detroit',
      },
      mode: 'single',
      plantCount: 1,
      plotType: 'raisedBed',
      requestedAreaSqFt: 2,
      sunExposureAtPlacement,
      today: new Date('2026-04-24T12:00:00.000Z'),
    }),
  };
}
