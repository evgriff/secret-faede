import { getCropById } from './cropCatalog';
import {
  createPlantLocationContext,
  getPlantTimingGuidance,
} from './plantLocationMatch';
import {
  annArborClimateProfile,
  annArborLocation,
} from '../gardens/GardenRepository';

describe('getPlantTimingGuidance', () => {
  it('uses the garden timezone when evaluating the current planting day', () => {
    const tomato = getCropById('tomato');

    if (!tomato) {
      throw new Error('Expected tomato in crop catalog.');
    }

    const timing = getPlantTimingGuidance({
      context: createPlantLocationContext({
        climateProfile: { ...annArborClimateProfile, source: 'user' },
        location: {
          ...annArborLocation,
          locationName: 'Detroit, MI',
          timezone: 'America/Detroit',
        },
      }),
      crop: tomato,
      today: new Date('2026-05-10T01:00:00.000Z'),
    });

    expect(timing.status).toBe('possibleNowWithProtection');
  });

  it('marks cool-season crops as too late for the spring window in midsummer', () => {
    const lettuce = getCropById('lettuce');

    if (!lettuce) {
      throw new Error('Expected lettuce in crop catalog.');
    }

    const timing = getPlantTimingGuidance({
      context: createPlantLocationContext({
        climateProfile: { ...annArborClimateProfile, source: 'user' },
        location: annArborLocation,
      }),
      crop: lettuce,
      today: new Date('2026-06-20T16:00:00.000Z'),
    });

    expect(timing.status).toBe('tooLateForSpringWindow');
    expect(timing.label).toBe('Too late for this spring window');
  });
});
