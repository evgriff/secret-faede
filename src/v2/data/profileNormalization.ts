import {
  USER_PROFILE_SCHEMA_VERSION,
  type NotificationPreferences,
  type UserProfile,
} from '../domain';
import { assertValidUserProfile } from './profileValidation';

export function normalizeStoredUserProfile(
  value: unknown,
  fallback: UserProfile,
): UserProfile {
  try {
    const current = structuredClone(value as UserProfile);
    assertValidUserProfile(current);
    if (current.userId !== fallback.userId)
      throw new Error('Profile owner mismatch.');
    return current;
  } catch {
    return migrateLegacyProfile(value, fallback);
  }
}

function migrateLegacyProfile(
  value: unknown,
  fallback: UserProfile,
): UserProfile {
  const legacy = asRecord(value);
  const legacyPreferences = asRecord(legacy.notificationPreference);
  const alertTypes = asRecord(legacyPreferences.alertTypes);
  const channels = asRecord(legacyPreferences.channels);
  const quietHours = asRecord(legacyPreferences.quietHours);
  const preferences: NotificationPreferences = {
    alertKinds: {
      frost: readBoolean(
        alertTypes.frost,
        fallback.notificationPreferences.alertKinds.frost,
      ),
      heat: readBoolean(
        alertTypes.heat ?? alertTypes.heatStress,
        fallback.notificationPreferences.alertKinds.heat,
      ),
      severeWeather: readBoolean(
        alertTypes.severeWeather,
        fallback.notificationPreferences.alertKinds.severeWeather,
      ),
      taskDue: readBoolean(
        alertTypes.taskDue,
        fallback.notificationPreferences.alertKinds.taskDue,
      ),
      watering: readBoolean(
        alertTypes.watering,
        fallback.notificationPreferences.alertKinds.watering,
      ),
    },
    dailyCheckTime: readLocalTime(
      legacyPreferences.defaultWateringCheckTime,
      fallback.notificationPreferences.dailyCheckTime,
    ),
    minimumWateringDeficitInches: readThreshold(
      legacyPreferences.wateringAlertThresholdIn,
      fallback.notificationPreferences.minimumWateringDeficitInches,
    ),
    pushEnabled: readBoolean(
      channels.push,
      fallback.notificationPreferences.pushEnabled,
    ),
    quietHours: {
      end: readLocalTime(
        quietHours.endLocalTime,
        fallback.notificationPreferences.quietHours.end,
      ),
      start: readLocalTime(
        quietHours.startLocalTime,
        fallback.notificationPreferences.quietHours.start,
      ),
    },
  };
  const profile: UserProfile = {
    displayName: readText(legacy.displayName) || fallback.displayName,
    email: readEmail(legacy.email) || fallback.email,
    notificationPreferences: preferences,
    schemaVersion: USER_PROFILE_SCHEMA_VERSION,
    timezone: readTimezone(legacy.timezone) || fallback.timezone,
    updatedAtIso: fallback.updatedAtIso,
    userId: fallback.userId,
  };
  assertValidUserProfile(profile);
  return profile;
}

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

function readThreshold(value: unknown, fallback: number) {
  return typeof value === 'number' && value >= 0.05 && value <= 2
    ? value
    : fallback;
}

function readLocalTime<T extends `${number}:${number}`>(
  value: unknown,
  fallback: T,
) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? (value as T)
    : fallback;
}

function readTimezone(value: unknown) {
  const timezone = readText(value);
  if (!timezone) return '';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(
      new Date(0),
    );
    return timezone;
  } catch {
    return '';
  }
}

function readEmail(value: unknown) {
  const email = readText(value);
  return /^\S+@\S+\.\S+$/.test(email) ? email : '';
}

function readText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
