import { describe, expect, it } from 'vitest';

import type { UserProfile } from '../domain';
import { normalizeStoredUserProfile } from './profileNormalization';
import { assertValidUserProfile } from './profileValidation';

describe('v2 user profile validation', () => {
  it('accepts the complete canonical profile', () => {
    expect(() => assertValidUserProfile(profile())).not.toThrow();
  });

  it('rejects invalid identity, time, switches, and unknown fields', () => {
    expect(() =>
      assertValidUserProfile({ ...profile(), email: 'not-an-email' }),
    ).toThrow(/identity/i);
    expect(() =>
      assertValidUserProfile({
        ...profile(),
        notificationPreferences: {
          ...profile().notificationPreferences,
          dailyCheckTime: '24:00',
        },
      }),
    ).toThrow(/daily check time/i);
    expect(() =>
      assertValidUserProfile({ ...profile(), unexpected: true } as UserProfile),
    ).toThrow(/unsupported fields/i);
  });

  it('safely migrates legacy mock notification fields onto v2 defaults', () => {
    const normalized = normalizeStoredUserProfile(
      {
        displayName: 'Legacy Gardener',
        email: 'legacy@example.com',
        notificationPreference: {
          alertTypes: { heatStress: false, watering: false },
          channels: { push: true },
          defaultWateringCheckTime: '06:30',
          quietHours: { endLocalTime: '08:00', startLocalTime: '22:00' },
          wateringAlertThresholdIn: 0.4,
        },
        timezone: 'America/Detroit',
        uid: 'user-1',
      },
      profile(),
    );

    expect(normalized).toMatchObject({
      displayName: 'Legacy Gardener',
      notificationPreferences: {
        alertKinds: { heat: false, watering: false },
        dailyCheckTime: '06:30',
        minimumWateringDeficitInches: 0.4,
        pushEnabled: true,
        quietHours: { end: '08:00', start: '22:00' },
      },
      schemaVersion: 2,
      userId: 'user-1',
    });
  });
});

function profile(): UserProfile {
  return {
    displayName: 'Primary Gardener',
    email: 'primary@example.com',
    notificationPreferences: {
      alertKinds: {
        frost: true,
        heat: true,
        severeWeather: true,
        taskDue: true,
        watering: true,
      },
      dailyCheckTime: '07:00',
      minimumWateringDeficitInches: 0.25,
      pushEnabled: false,
      quietHours: { end: '07:00', start: '21:00' },
    },
    schemaVersion: 2,
    timezone: 'America/Detroit',
    updatedAtIso: '2026-07-09T12:00:00.000Z',
    userId: 'user-1',
  };
}
