import { getCropById } from './cropCatalog';
import { scoreCropSuitability } from './cropSuitability';
import { detroitClimateProfile } from '../gardens/GardenRepository';

describe('scoreCropSuitability', () => {
  it('rewards crops that match sun, season, and spacing', () => {
    const lettuce = getCropById('lettuce');

    if (!lettuce) {
      throw new Error('Expected lettuce in crop catalog.');
    }

    const score = scoreCropSuitability({
      climateProfile: { ...detroitClimateProfile, source: 'user' },
      crop: lettuce,
      mode: 'block',
      plantCount: 8,
      plotType: 'raisedBed',
      requestedAreaSqFt: 12,
      sunExposureAtPlacement: 'partSun',
      today: new Date('2026-05-15T12:00:00.000Z'),
    });

    expect(score.level).toBe('fit');
    expect(score.reasons.length).toBeGreaterThan(0);
  });

  it('flags risky warm-season container fits before frost', () => {
    const watermelon = getCropById('watermelon');

    if (!watermelon) {
      throw new Error('Expected watermelon in crop catalog.');
    }

    const score = scoreCropSuitability({
      climateProfile: { ...detroitClimateProfile, source: 'user' },
      crop: watermelon,
      mode: 'single',
      plantCount: 1,
      plotType: 'containers',
      requestedAreaSqFt: 2,
      sunExposureAtPlacement: 'partShade',
      today: new Date('2026-04-15T12:00:00.000Z'),
    });

    expect(score.level).toBe('risk');
    expect(score.warnings.join(' ')).toMatch(/Warm-season|Large spreading/);
  });
});
