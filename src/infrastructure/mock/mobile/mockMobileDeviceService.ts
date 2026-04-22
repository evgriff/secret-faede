import type {
  LocalNotificationRequest,
  MobileDeviceCapabilities,
  MobileDeviceService,
  SessionConvenienceHint,
} from '../../../domain/mobile/MobileDeviceService';
import type { NetworkStatus } from '../../../shared/network/networkStatus';

export class MockMobileDeviceService implements MobileDeviceService {
  readonly scheduledLocalNotifications: LocalNotificationRequest[] = [];
  private sessionHint: SessionConvenienceHint | null = null;

  constructor(
    private readonly capabilityOverrides: Partial<MobileDeviceCapabilities> = {},
  ) {}

  async capturePhoto(): Promise<File | null> {
    return null;
  }

  async clearSessionHint(): Promise<void> {
    this.sessionHint = null;
  }

  getCapabilities(): MobileDeviceCapabilities {
    return {
      camera: false,
      isNative: false,
      localNotifications: false,
      nativeNetwork: false,
      nativePush: false,
      platform: 'web' as const,
      preferences: false,
      quickUnlockReady: false,
      secureSessionStorage: false,
      ...this.capabilityOverrides,
    };
  }

  getNetworkStatus(): Promise<NetworkStatus> {
    return Promise.resolve('online');
  }

  readSessionHint(): Promise<SessionConvenienceHint | null> {
    return Promise.resolve(this.sessionHint);
  }

  requestLocalNotificationPermission() {
    return Promise.resolve({
      message: 'Local notifications are unavailable in mock runtime.',
      status: 'unavailable' as const,
    });
  }

  async saveSessionHint(hint: SessionConvenienceHint): Promise<void> {
    this.sessionHint = hint;
  }

  scheduleLocalNotification(request: LocalNotificationRequest) {
    const available = this.getCapabilities().localNotifications;

    if (available) {
      this.scheduledLocalNotifications.push(request);
    }

    return Promise.resolve({
      message: available
        ? 'Local notification scheduled in mock runtime.'
        : 'Local notifications are unavailable in mock runtime.',
      status: available ? ('granted' as const) : ('unavailable' as const),
    });
  }

  subscribeToNetworkStatus(callback: (status: NetworkStatus) => void) {
    void callback;

    return () => undefined;
  }
}
