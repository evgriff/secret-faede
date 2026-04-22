import type {
  LocalNotificationRequest,
  MobileDeviceCapabilities,
  MobileDeviceService,
  MobilePlatform,
  MobilePermissionResult,
  SessionConvenienceHint,
} from '../../domain/mobile/MobileDeviceService';
import type { NetworkStatus } from '../../shared/network/networkStatus';
import {
  readJsonStorageValue,
  removeStorageValue,
  writeJsonStorageValue,
} from '../../shared/lib/storage';

const sessionHintKey = 'secret-faede.mobile.session-hint.v1';

interface CapacitorGlobal {
  getPlatform?(): string;
  isNativePlatform?(): boolean;
}

export function createLazyMobileDeviceService(): MobileDeviceService {
  return new LazyMobileDeviceService();
}

class LazyMobileDeviceService implements MobileDeviceService {
  private nativeServicePromise: Promise<MobileDeviceService> | null = null;

  getCapabilities(): MobileDeviceCapabilities {
    const isNative = isNativeCapacitorPlatform();

    return {
      camera: isNative,
      isNative,
      localNotifications: isNative,
      nativeNetwork: isNative,
      nativePush: isNative,
      platform: getCapacitorPlatform(),
      preferences: true,
      quickUnlockReady: false,
      secureSessionStorage: false,
    };
  }

  async getNetworkStatus(): Promise<NetworkStatus> {
    if (!isNativeCapacitorPlatform()) {
      return getBrowserNetworkStatus();
    }

    return this.getNativeService()
      .then((service) => service.getNetworkStatus())
      .catch(() => getBrowserNetworkStatus());
  }

  subscribeToNetworkStatus(callback: (status: NetworkStatus) => void) {
    if (!isNativeCapacitorPlatform()) {
      return subscribeToBrowserNetworkStatus(callback);
    }

    let active = true;
    let unsubscribe: (() => void) | null = null;

    void this.getNativeService()
      .then((service) => {
        if (!active) {
          return;
        }

        unsubscribe = service.subscribeToNetworkStatus(callback);
      })
      .catch(() => {
        if (active) {
          unsubscribe = subscribeToBrowserNetworkStatus(callback);
        }
      });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }

  async capturePhoto(): Promise<File | null> {
    if (!isNativeCapacitorPlatform()) {
      return null;
    }

    return this.getNativeService()
      .then((service) => service.capturePhoto())
      .catch(() => null);
  }

  async readSessionHint(): Promise<SessionConvenienceHint | null> {
    if (!isNativeCapacitorPlatform()) {
      return readJsonStorageValue<SessionConvenienceHint>(sessionHintKey);
    }

    return this.getNativeService()
      .then((service) => service.readSessionHint())
      .catch(() =>
        readJsonStorageValue<SessionConvenienceHint>(sessionHintKey),
      );
  }

  async saveSessionHint(hint: SessionConvenienceHint): Promise<void> {
    if (!isNativeCapacitorPlatform()) {
      writeJsonStorageValue(sessionHintKey, hint);
      return;
    }

    await this.getNativeService()
      .then((service) => service.saveSessionHint(hint))
      .catch(() => writeJsonStorageValue(sessionHintKey, hint));
  }

  async clearSessionHint(): Promise<void> {
    if (!isNativeCapacitorPlatform()) {
      removeStorageValue(sessionHintKey);
      return;
    }

    await this.getNativeService()
      .then((service) => service.clearSessionHint())
      .catch(() => removeStorageValue(sessionHintKey));
  }

  async requestLocalNotificationPermission(): Promise<MobilePermissionResult> {
    if (!isNativeCapacitorPlatform()) {
      return {
        message:
          'Native local notifications are available only in the mobile shell.',
        status: 'unavailable',
      };
    }

    return this.getNativeService()
      .then((service) => service.requestLocalNotificationPermission())
      .catch(() => ({
        message: 'Native local notifications are unavailable right now.',
        status: 'unavailable',
      }));
  }

  async scheduleLocalNotification(
    request: LocalNotificationRequest,
  ): Promise<MobilePermissionResult> {
    if (!isNativeCapacitorPlatform()) {
      return {
        message:
          'Native local notifications are available only in the mobile shell.',
        status: 'unavailable',
      };
    }

    return this.getNativeService()
      .then((service) => service.scheduleLocalNotification(request))
      .catch(() => ({
        message: 'Native local notifications are unavailable right now.',
        status: 'unavailable',
      }));
  }

  private getNativeService() {
    this.nativeServicePromise ??= importNativeMobileDeviceService();

    return this.nativeServicePromise;
  }
}

async function importNativeMobileDeviceService() {
  const module = await import('./capacitorMobileDeviceService');

  return module.createMobileDeviceService();
}

function getCapacitorGlobal(): CapacitorGlobal | null {
  if (typeof globalThis === 'undefined' || !('Capacitor' in globalThis)) {
    return null;
  }

  return (globalThis as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

function isNativeCapacitorPlatform() {
  return getCapacitorGlobal()?.isNativePlatform?.() === true;
}

function getCapacitorPlatform(): MobilePlatform {
  const platform = getCapacitorGlobal()?.getPlatform?.();

  return platform === 'ios' || platform === 'android' ? platform : 'web';
}

function getBrowserNetworkStatus(): NetworkStatus {
  if (typeof navigator === 'undefined') {
    return 'online';
  }

  return navigator.onLine ? 'online' : 'offline';
}

function subscribeToBrowserNetworkStatus(
  callback: (status: NetworkStatus) => void,
) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  const update = () => callback(getBrowserNetworkStatus());

  window.addEventListener('online', update);
  window.addEventListener('offline', update);

  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}
