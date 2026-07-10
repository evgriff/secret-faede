import type { GardenPlan, UserProfile } from '../../domain';

export function plan(): GardenPlan {
  return {
    createdAtIso: '2026-01-01T00:00:00.000Z',
    id: 'garden-1',
    name: 'Home garden',
    plantings: [],
    plot: {
      climate: {
        firstFrost: '10-20',
        hardinessZone: '6b',
        lastFrost: '05-05',
      },
      depthFt: 20,
      location: {
        coordinates: { latitude: 42.3314, longitude: -83.0458 },
        label: 'Detroit garden',
        query: 'Detroit, MI',
        timezone: 'America/Detroit',
      },
      northDegrees: 0,
      snapFt: 0.125,
      widthFt: 30,
    },
    reviewDecisions: [],
    schemaVersion: 9,
    setupCompleted: true,
    structures: [],
    updatedAtIso: '2026-01-01T00:00:00.000Z',
  };
}

export function profile(): UserProfile {
  return {
    displayName: 'Primary Gardener',
    email: 'gardener@example.com',
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
    updatedAtIso: '2026-01-01T00:00:00.000Z',
    userId: 'user-1',
  };
}
