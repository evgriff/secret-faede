import type { NetworkStatus } from '../../shared/network/networkStatus';

export type MobilePlatform = 'android' | 'ios' | 'web';

export type MobilePermissionStatus =
  | 'denied'
  | 'granted'
  | 'prompt'
  | 'unavailable';

export interface MobilePermissionResult {
  message: string;
  status: MobilePermissionStatus;
}

export interface MobileDeviceCapabilities {
  camera: boolean;
  isNative: boolean;
  localNotifications: boolean;
  nativeNetwork: boolean;
  nativePush: boolean;
  platform: MobilePlatform;
  preferences: boolean;
  quickUnlockReady: boolean;
  secureSessionStorage: boolean;
}

export interface SessionConvenienceHint {
  displayName: string | null;
  email: string;
  lastRoute: string | null;
  lastSignedInAtIso: string;
  userId: string;
}

export interface LocalNotificationRequest {
  body: string;
  id: number;
  scheduleAtIso?: string;
  title: string;
}

export interface MobileDeviceService {
  capturePhoto(): Promise<File | null>;
  clearSessionHint(): Promise<void>;
  getCapabilities(): MobileDeviceCapabilities;
  getNetworkStatus(): Promise<NetworkStatus>;
  readSessionHint(): Promise<SessionConvenienceHint | null>;
  requestLocalNotificationPermission(): Promise<MobilePermissionResult>;
  saveSessionHint(hint: SessionConvenienceHint): Promise<void>;
  scheduleLocalNotification(
    request: LocalNotificationRequest,
  ): Promise<MobilePermissionResult>;
  subscribeToNetworkStatus(
    callback: (status: NetworkStatus) => void,
  ): () => void;
}
