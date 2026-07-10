import type { AlertKind, GardenPlan, UserProfile } from '../../domain';
import type { SettingsSaveValue } from './types';

export interface SettingsDraft {
  alertKinds: Record<AlertKind, boolean>;
  dailyCheckTime: string;
  firstFrost: string;
  hardinessZone: string;
  latitude: string;
  lastFrost: string;
  locationLabel: string;
  locationQuery: string;
  longitude: string;
  minimumWateringDeficitInches: string;
  pushEnabled: boolean;
  quietHoursEnd: string;
  quietHoursStart: string;
  timezone: string;
}

export type SettingsErrors = Partial<Record<keyof SettingsDraft, string>>;

export function createSettingsDraft(
  plan: GardenPlan,
  profile: UserProfile,
): SettingsDraft {
  const coordinates = plan.plot.location.coordinates;
  return {
    alertKinds: { ...profile.notificationPreferences.alertKinds },
    dailyCheckTime: profile.notificationPreferences.dailyCheckTime,
    firstFrost: plan.plot.climate.firstFrost,
    hardinessZone: plan.plot.climate.hardinessZone,
    latitude: coordinates ? String(coordinates.latitude) : '',
    lastFrost: plan.plot.climate.lastFrost,
    locationLabel: plan.plot.location.label,
    locationQuery: plan.plot.location.query,
    longitude: coordinates ? String(coordinates.longitude) : '',
    minimumWateringDeficitInches: String(
      profile.notificationPreferences.minimumWateringDeficitInches,
    ),
    pushEnabled: profile.notificationPreferences.pushEnabled,
    quietHoursEnd: profile.notificationPreferences.quietHours.end,
    quietHoursStart: profile.notificationPreferences.quietHours.start,
    timezone: plan.plot.location.timezone || profile.timezone,
  };
}

export function validateSettingsDraft(draft: SettingsDraft): SettingsErrors {
  const errors: SettingsErrors = {};
  if (!draft.locationLabel.trim()) {
    errors.locationLabel = 'Add a recognizable garden location label.';
  }
  if (!draft.locationQuery.trim()) {
    errors.locationQuery = 'Add a location query for weather lookups.';
  }
  validateCoordinates(draft, errors);
  if (!isIanaTimezone(draft.timezone.trim())) {
    errors.timezone = 'Enter a valid IANA timezone, such as America/Detroit.';
  }
  if (!/^(?:[1-9]|1[0-3])[ab]$/i.test(draft.hardinessZone.trim())) {
    errors.hardinessZone = 'Enter a USDA zone from 1a through 13b.';
  }
  if (!isMonthDay(draft.lastFrost)) {
    errors.lastFrost = 'Use a valid month and day in MM-DD form.';
  }
  if (!isMonthDay(draft.firstFrost)) {
    errors.firstFrost = 'Use a valid month and day in MM-DD form.';
  }
  if (!isLocalTime(draft.dailyCheckTime)) {
    errors.dailyCheckTime = 'Choose a valid 24-hour check time.';
  }
  if (!isLocalTime(draft.quietHoursStart)) {
    errors.quietHoursStart = 'Choose a valid quiet-hours start.';
  }
  if (!isLocalTime(draft.quietHoursEnd)) {
    errors.quietHoursEnd = 'Choose a valid quiet-hours end.';
  }
  if (
    isLocalTime(draft.quietHoursStart) &&
    draft.quietHoursStart === draft.quietHoursEnd
  ) {
    errors.quietHoursEnd = 'Quiet-hours start and end must be different.';
  }
  const deficit = Number(draft.minimumWateringDeficitInches);
  if (!Number.isFinite(deficit) || deficit < 0.05 || deficit > 2) {
    errors.minimumWateringDeficitInches =
      'Use a watering deficit from 0.05 through 2 inches.';
  }
  return errors;
}

export function createSettingsSaveValue(
  draft: SettingsDraft,
  plan: GardenPlan,
  profile: UserProfile,
  nowIso = new Date().toISOString(),
): SettingsSaveValue {
  const errors = validateSettingsDraft(draft);
  if (Object.keys(errors).length > 0) {
    throw new Error('Settings must be valid before they can be saved.');
  }
  const coordinates = {
    latitude: Number(draft.latitude),
    longitude: Number(draft.longitude),
  };
  const timezone = draft.timezone.trim();

  return {
    plan: {
      ...plan,
      plot: {
        ...plan.plot,
        climate: {
          firstFrost: draft.firstFrost as `${number}-${number}`,
          hardinessZone: draft.hardinessZone.trim().toLowerCase(),
          lastFrost: draft.lastFrost as `${number}-${number}`,
        },
        location: {
          coordinates,
          label: draft.locationLabel.trim(),
          query: draft.locationQuery.trim(),
          timezone,
        },
      },
      updatedAtIso: nowIso,
    },
    profile: {
      ...profile,
      notificationPreferences: {
        alertKinds: { ...draft.alertKinds },
        dailyCheckTime: draft.dailyCheckTime as `${number}:${number}`,
        minimumWateringDeficitInches: Number(
          draft.minimumWateringDeficitInches,
        ),
        pushEnabled: draft.pushEnabled,
        quietHours: {
          end: draft.quietHoursEnd as `${number}:${number}`,
          start: draft.quietHoursStart as `${number}:${number}`,
        },
      },
      timezone,
      updatedAtIso: nowIso,
    },
  };
}

export function isIanaTimezone(value: string) {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function validateCoordinates(draft: SettingsDraft, errors: SettingsErrors) {
  const latitudeBlank = draft.latitude.trim() === '';
  const longitudeBlank = draft.longitude.trim() === '';
  if (latitudeBlank || longitudeBlank) {
    errors.latitude = 'Enter both coordinates for operational weather.';
    errors.longitude = 'Enter both coordinates for operational weather.';
    return;
  }
  const latitude = Number(draft.latitude);
  const longitude = Number(draft.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    errors.latitude = 'Latitude must be between -90 and 90.';
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    errors.longitude = 'Longitude must be between -180 and 180.';
  }
}

function isLocalTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return Boolean(match && Number(match[1]) <= 23 && Number(match[2]) <= 59);
}

function isMonthDay(value: string) {
  const match = /^(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const date = new Date(Date.UTC(2000, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
