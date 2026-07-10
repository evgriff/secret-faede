import type { IsoDateString } from './plan';

export const USER_PROFILE_SCHEMA_VERSION = 2 as const;

export type AlertKind =
  | 'frost'
  | 'heat'
  | 'severeWeather'
  | 'taskDue'
  | 'watering';

export interface QuietHours {
  end: `${number}:${number}`;
  start: `${number}:${number}`;
}

export interface NotificationPreferences {
  alertKinds: Record<AlertKind, boolean>;
  dailyCheckTime: `${number}:${number}`;
  minimumWateringDeficitInches: number;
  pushEnabled: boolean;
  quietHours: QuietHours;
}

export interface UserProfile {
  displayName: string;
  email: string;
  notificationPreferences: NotificationPreferences;
  schemaVersion: typeof USER_PROFILE_SCHEMA_VERSION;
  timezone: string;
  updatedAtIso: IsoDateString;
  userId: string;
}

export interface PushRegistrationState {
  permission: 'denied' | 'granted' | 'prompt' | 'unsupported';
  registered: boolean;
  tokenUpdatedAtIso: IsoDateString | null;
}
