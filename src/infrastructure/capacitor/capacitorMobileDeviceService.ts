import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Network } from '@capacitor/network';
import { Preferences } from '@capacitor/preferences';

import type {
  LocalNotificationRequest,
  MobileDeviceCapabilities,
  MobileDeviceService,
  MobilePermissionResult,
  MobilePlatform,
  SessionConvenienceHint,
} from '../../domain/mobile/MobileDeviceService';
import type { NetworkStatus } from '../../shared/network/networkStatus';

const sessionHintKey = 'secret-faeries.mobile.session-hint.v1';

export function createMobileDeviceService(): MobileDeviceService {
  return new CapacitorMobileDeviceService();
}

class CapacitorMobileDeviceService implements MobileDeviceService {
  private readonly isNative = Capacitor.isNativePlatform();
  private readonly platform = toMobilePlatform(Capacitor.getPlatform());

  getCapabilities(): MobileDeviceCapabilities {
    return {
      camera: this.isNative,
      isNative: this.isNative,
      localNotifications: this.isNative,
      nativeNetwork: this.isNative,
      nativePush: this.isNative,
      platform: this.platform,
      preferences: true,
      quickUnlockReady: false,
      secureSessionStorage: false,
    };
  }

  async getNetworkStatus(): Promise<NetworkStatus> {
    if (!this.isNative) {
      return getBrowserNetworkStatus();
    }

    const status = await Network.getStatus();

    return status.connected ? 'online' : 'offline';
  }

  subscribeToNetworkStatus(callback: (status: NetworkStatus) => void) {
    if (!this.isNative) {
      return () => undefined;
    }

    let active = true;
    let removeListener: (() => Promise<void>) | null = null;

    void Network.addListener('networkStatusChange', (status) => {
      callback(status.connected ? 'online' : 'offline');
    }).then((listener) => {
      if (!active) {
        void listener.remove();
        return;
      }

      removeListener = () => listener.remove();
    });

    return () => {
      active = false;
      void removeListener?.();
    };
  }

  async capturePhoto(): Promise<File | null> {
    if (!this.isNative) {
      return null;
    }

    const photo = await Camera.getPhoto({
      allowEditing: false,
      quality: 78,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
    });

    if (!photo.webPath) {
      return null;
    }

    const response = await fetch(photo.webPath);
    const blob = await response.blob();
    const extension = photo.format || extensionForContentType(blob.type);

    return new File([blob], `garden-photo-${Date.now()}.${extension}`, {
      type: blob.type || 'image/jpeg',
    });
  }

  async readSessionHint(): Promise<SessionConvenienceHint | null> {
    const { value } = await Preferences.get({ key: sessionHintKey });

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as SessionConvenienceHint;
    } catch {
      await this.clearSessionHint();
      return null;
    }
  }

  async saveSessionHint(hint: SessionConvenienceHint): Promise<void> {
    await Preferences.set({
      key: sessionHintKey,
      value: JSON.stringify(hint),
    });
  }

  async clearSessionHint(): Promise<void> {
    await Preferences.remove({ key: sessionHintKey });
  }

  async requestLocalNotificationPermission(): Promise<MobilePermissionResult> {
    if (!this.isNative) {
      return {
        message:
          'Native local notifications are available only in the mobile shell.',
        status: 'unavailable',
      };
    }

    const current = await LocalNotifications.checkPermissions();
    const permission =
      current.display === 'granted'
        ? current
        : await LocalNotifications.requestPermissions();

    if (permission.display !== 'granted') {
      return {
        message: 'Local notification permission was not granted.',
        status: permission.display === 'denied' ? 'denied' : 'prompt',
      };
    }

    return {
      message: 'Local notifications are enabled on this device.',
      status: 'granted',
    };
  }

  async scheduleLocalNotification(
    request: LocalNotificationRequest,
  ): Promise<MobilePermissionResult> {
    const permission = await this.requestLocalNotificationPermission();

    if (permission.status !== 'granted') {
      return permission;
    }

    const notification = {
      body: request.body,
      id: request.id,
      title: request.title,
      ...(request.scheduleAtIso
        ? { schedule: { at: new Date(request.scheduleAtIso) } }
        : {}),
    };

    await LocalNotifications.schedule({
      notifications: [notification],
    });

    return {
      message: 'Local notification scheduled.',
      status: 'granted',
    };
  }
}

function getBrowserNetworkStatus(): NetworkStatus {
  if (typeof navigator === 'undefined') {
    return 'online';
  }

  return navigator.onLine ? 'online' : 'offline';
}

function toMobilePlatform(platform: string): MobilePlatform {
  return platform === 'ios' || platform === 'android' ? platform : 'web';
}

function extensionForContentType(contentType: string) {
  if (contentType === 'image/png') {
    return 'png';
  }

  if (contentType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}
