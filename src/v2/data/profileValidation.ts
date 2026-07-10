import {
  USER_PROFILE_SCHEMA_VERSION,
  type NotificationPreferences,
  type UserProfile,
} from '../domain';

export function assertValidUserProfile(profile: UserProfile) {
  assertObject(profile, 'User profile');
  assertOnlyKeys(profile, [
    'displayName',
    'email',
    'notificationPreferences',
    'schemaVersion',
    'timezone',
    'updatedAtIso',
    'userId',
  ]);
  if (profile.schemaVersion !== USER_PROFILE_SCHEMA_VERSION) {
    throw new Error('Unsupported user profile schema.');
  }
  if (
    !isBoundedText(profile.userId, 1, 128) ||
    !isBoundedText(profile.email, 3, 320) ||
    !/^\S+@\S+\.\S+$/.test(profile.email) ||
    !isBoundedText(profile.displayName, 1, 100)
  ) {
    throw new Error('Profile identity fields are required.');
  }
  assertIso(profile.updatedAtIso, 'Profile update time');
  assertTimezone(profile.timezone);
  assertNotificationPreferences(profile.notificationPreferences);
}

export function assertNotificationPreferences(
  preferences: NotificationPreferences,
) {
  assertObject(preferences, 'Notification preferences');
  assertOnlyKeys(preferences, [
    'alertKinds',
    'dailyCheckTime',
    'minimumWateringDeficitInches',
    'pushEnabled',
    'quietHours',
  ]);
  assertObject(preferences.alertKinds, 'Alert kinds');
  assertOnlyKeys(preferences.alertKinds, [
    'frost',
    'heat',
    'severeWeather',
    'taskDue',
    'watering',
  ]);
  if (
    !Object.values(preferences.alertKinds).every(
      (enabled) => typeof enabled === 'boolean',
    ) ||
    typeof preferences.pushEnabled !== 'boolean'
  ) {
    throw new Error('Notification switches must be true or false.');
  }
  assertObject(preferences.quietHours, 'Quiet hours');
  assertOnlyKeys(preferences.quietHours, ['end', 'start']);
  assertLocalTime(preferences.dailyCheckTime, 'Daily check time');
  assertLocalTime(preferences.quietHours.start, 'Quiet-hours start');
  assertLocalTime(preferences.quietHours.end, 'Quiet-hours end');
  if (
    !Number.isFinite(preferences.minimumWateringDeficitInches) ||
    preferences.minimumWateringDeficitInches < 0.05 ||
    preferences.minimumWateringDeficitInches > 2
  ) {
    throw new Error(
      'Minimum watering deficit must be between 0.05 and 2 inches.',
    );
  }
}

function assertTimezone(timezone: string) {
  if (!isBoundedText(timezone, 1, 100)) {
    throw new Error('Profile timezone must be a valid IANA timezone.');
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(
      new Date(0),
    );
  } catch {
    throw new Error('Profile timezone must be a valid IANA timezone.');
  }
}

function assertIso(value: string, label: string) {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`${label} must be a valid ISO timestamp.`);
  }
}

function assertObject(value: unknown, label: string): asserts value is object {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertOnlyKeys(value: object, keys: string[]) {
  const allowed = new Set(keys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error('Saved profile contains unsupported fields.');
  }
}

function isBoundedText(value: unknown, minimum: number, maximum: number) {
  return (
    typeof value === 'string' &&
    value.trim().length >= minimum &&
    value.length <= maximum
  );
}

function assertLocalTime(value: string, label: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hour = Number(match?.[1]);
  const minute = Number(match?.[2]);
  if (!match || hour > 23 || minute > 59) {
    throw new Error(`${label} must be a valid 24-hour time.`);
  }
}
