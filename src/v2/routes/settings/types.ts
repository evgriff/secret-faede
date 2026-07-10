import type {
  AlertKind,
  GardenPlan,
  PushRegistrationState,
  UserProfile,
} from '../../domain';

export type SettingsSaveResult = 'queued' | 'saved';

export interface SettingsSaveValue {
  plan: GardenPlan;
  profile: UserProfile;
}

export interface SettingsIdentity {
  displayName: string;
  email: string;
}

export type DeviceCapability =
  | 'available'
  | 'permissionDenied'
  | 'unconfigured'
  | 'unsupported';

export interface SettingsDeviceCapabilities {
  camera: DeviceCapability;
  localNotifications: DeviceCapability;
  platform: 'android' | 'ios' | 'unknown' | 'web';
  push: DeviceCapability;
}

export interface NotificationDeliveryHistoryItem {
  body: string;
  channel: 'inApp' | 'local' | 'push';
  createdAtIso: string;
  id: string;
  kind: AlertKind;
  reason: string | null;
  status: 'failed' | 'queued' | 'sent' | 'suppressed';
  title: string;
}

export interface SettingsPageProps {
  deliveryHistory: readonly NotificationDeliveryHistoryItem[];
  deliveryHistoryError?: string | null;
  deviceCapabilities: SettingsDeviceCapabilities;
  errorMessage?: string | null;
  identity: SettingsIdentity;
  loadState?: 'error' | 'loading' | 'ready';
  onRegisterPush?(): Promise<PushRegistrationState>;
  onRetry?(): Promise<void> | void;
  onSave(value: SettingsSaveValue): Promise<SettingsSaveResult>;
  plan: GardenPlan;
  profile: UserProfile;
  pushRegistration: PushRegistrationState;
}
