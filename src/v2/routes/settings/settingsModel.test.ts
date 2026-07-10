import {
  createSettingsDraft,
  createSettingsSaveValue,
  isIanaTimezone,
  validateSettingsDraft,
} from './settingsModel';
import { plan, profile } from './settingsTestFixtures';

describe('settingsModel', () => {
  it('keeps required coordinates and aligns plan/profile timezone on save', () => {
    const draft = {
      ...createSettingsDraft(plan(), profile()),
      timezone: 'America/Chicago',
    };
    const saved = createSettingsSaveValue(
      draft,
      plan(),
      profile(),
      '2026-07-09T13:00:00.000Z',
    );

    expect(saved.plan.plot.location.coordinates).toEqual({
      latitude: 42.3314,
      longitude: -83.0458,
    });
    expect(saved.plan.plot.location.timezone).toBe('America/Chicago');
    expect(saved.profile.timezone).toBe('America/Chicago');
    expect(saved.plan.updatedAtIso).toBe('2026-07-09T13:00:00.000Z');
  });

  it('requires complete, bounded coordinate pairs', () => {
    const draft = createSettingsDraft(plan(), profile());
    expect(
      validateSettingsDraft({ ...draft, latitude: '', longitude: '' }),
    ).toMatchObject({
      latitude: expect.stringContaining('operational weather'),
      longitude: expect.stringContaining('operational weather'),
    });
    expect(
      validateSettingsDraft({ ...draft, latitude: '', longitude: '-83' }),
    ).toMatchObject({
      latitude: expect.stringContaining('coordinates'),
      longitude: expect.stringContaining('coordinates'),
    });
    expect(
      validateSettingsDraft({ ...draft, latitude: '91', longitude: '-181' }),
    ).toMatchObject({
      latitude: expect.stringContaining('-90'),
      longitude: expect.stringContaining('-180'),
    });
    expect(
      validateSettingsDraft({ ...draft, latitude: '42.3', longitude: '-83.1' }),
    ).toEqual({});
  });

  it('validates IANA timezone, hardiness, frost, local time, and water deficit', () => {
    const draft = createSettingsDraft(plan(), profile());
    expect(isIanaTimezone('America/Detroit')).toBe(true);
    expect(isIanaTimezone('Detroit-ish')).toBe(false);
    expect(
      validateSettingsDraft({
        ...draft,
        dailyCheckTime: '25:61',
        firstFrost: '02-31',
        hardinessZone: '14z',
        lastFrost: '5/5',
        minimumWateringDeficitInches: '0.01',
        quietHoursEnd: '21:00',
        quietHoursStart: '21:00',
        timezone: 'Detroit-ish',
      }),
    ).toMatchObject({
      dailyCheckTime: expect.any(String),
      firstFrost: expect.any(String),
      hardinessZone: expect.any(String),
      lastFrost: expect.any(String),
      minimumWateringDeficitInches: expect.any(String),
      quietHoursEnd: expect.any(String),
      timezone: expect.any(String),
    });
  });

  it('keeps the account push preference independent from this device registration', () => {
    const baseProfile = profile();
    baseProfile.notificationPreferences.pushEnabled = true;
    const draft = createSettingsDraft(plan(), baseProfile);
    expect(draft.pushEnabled).toBe(true);
    expect(
      createSettingsSaveValue(draft, plan(), baseProfile).profile
        .notificationPreferences.pushEnabled,
    ).toBe(true);
    expect(
      createSettingsSaveValue(
        { ...draft, pushEnabled: false },
        plan(),
        baseProfile,
      ).profile.notificationPreferences.pushEnabled,
    ).toBe(false);
  });
});
