import type {
  ForegroundPushMessage,
  NotificationService,
  PushRegistrationResult,
} from '../../../domain/notifications/NotificationService';
import type { PushNotificationsPlugin } from '@capacitor/push-notifications';
import type { AppEnvironment } from '../../../shared/config/env';
import { getFirebaseMessagingClient, getFirestoreClient } from '../app';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import {
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
} from 'firebase/messaging';
import { getPushInstallationId } from './pushInstallationId';

export class FirebaseNotificationService implements NotificationService {
  private readonly firestore: Firestore;

  constructor(private readonly environment: AppEnvironment) {
    this.firestore = getFirestoreClient(environment);
  }

  async registerNativePush(userId: string): Promise<PushRegistrationResult> {
    const { Capacitor } = await import('@capacitor/core');

    if (!Capacitor.isNativePlatform()) {
      return {
        message: 'Native push is available only in the iOS or Android shell.',
        status: 'unsupported',
        tokenRegisteredAtIso: null,
      };
    }

    const nativePlatform = Capacitor.getPlatform();
    if (nativePlatform === 'ios') {
      return {
        message:
          'iOS push is not available until the native shell provides a Firebase Cloud Messaging token. An APNs token will not be registered as FCM.',
        status: 'unavailable',
        tokenRegisteredAtIso: null,
      };
    }

    const { PushNotifications } = await import('@capacitor/push-notifications');
    const permission = await PushNotifications.requestPermissions();

    if (permission.receive !== 'granted') {
      return {
        message: 'Native push permission was not granted.',
        status: 'denied',
        tokenRegisteredAtIso: null,
      };
    }

    const token = await waitForNativePushToken(PushNotifications);
    const tokenRegisteredAtIso = new Date().toISOString();

    await this.persistPushToken({
      platform: `native-${nativePlatform}`,
      token,
      tokenRegisteredAtIso,
      userId,
    });

    return {
      message: 'Native push is enabled for this device.',
      status: 'registered',
      tokenRegisteredAtIso,
    };
  }

  async registerWebPush(userId: string): Promise<PushRegistrationResult> {
    if (
      !this.environment.firebaseConfig ||
      !this.environment.messagingVapidKey
    ) {
      return {
        message: 'Web push needs Firebase messaging config and a VAPID key.',
        status: 'unavailable',
        tokenRegisteredAtIso: null,
      };
    }

    if (!(await isSupported()) || !('Notification' in window)) {
      return {
        message: 'This browser does not support web push notifications.',
        status: 'unsupported',
        tokenRegisteredAtIso: null,
      };
    }

    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      return {
        message: 'Web push permission was not granted.',
        status: 'denied',
        tokenRegisteredAtIso: null,
      };
    }

    const serviceWorkerRegistration = await registerMessagingServiceWorker(
      this.environment,
    );
    const token = await getToken(getFirebaseMessagingClient(this.environment), {
      serviceWorkerRegistration,
      vapidKey: this.environment.messagingVapidKey,
    });

    if (!token) {
      return {
        message: 'Firebase did not return a web push token.',
        status: 'unavailable',
        tokenRegisteredAtIso: null,
      };
    }

    const tokenRegisteredAtIso = new Date().toISOString();

    await this.persistPushToken({
      platform: 'web',
      token,
      tokenRegisteredAtIso,
      userId,
    });

    return {
      message: 'Web push is enabled for this browser.',
      status: 'registered',
      tokenRegisteredAtIso,
    };
  }

  subscribeToForegroundMessages(
    handleMessage: (message: ForegroundPushMessage) => void,
  ) {
    if (!this.environment.firebaseConfig) {
      return () => undefined;
    }

    let unsubscribe: (() => void) | null = null;
    let removeNativeListeners: Array<() => Promise<void>> = [];
    let active = true;

    void import('@capacitor/core').then(async ({ Capacitor }) => {
      if (!active) return;
      if (Capacitor.isNativePlatform()) {
        const { PushNotifications } =
          await import('@capacitor/push-notifications');
        const listeners = await Promise.all([
          PushNotifications.addListener(
            'pushNotificationReceived',
            (notification) => {
              const data = (notification.data ?? {}) as Record<string, unknown>;
              handleMessage({
                body: notification.body ?? stringValue(data.body),
                link: stringValue(data.link) || '/app/today',
                title:
                  (notification.title ?? stringValue(data.title)) ||
                  'Garden alert',
                type: stringValue(data.type) || 'weather',
              });
            },
          ),
          PushNotifications.addListener(
            'pushNotificationActionPerformed',
            (action) => {
              const data = (action.notification.data ?? {}) as Record<
                string,
                unknown
              >;
              navigateToPushLink(stringValue(data.link) || '/app/today');
            },
          ),
        ]);
        if (!active) {
          await Promise.all(listeners.map((listener) => listener.remove()));
          return;
        }
        removeNativeListeners = listeners.map(
          (listener) => () => listener.remove(),
        );
        return;
      }
      const supported = await isSupported();
      if (!supported || !active) return;
      unsubscribe = onMessage(
        getFirebaseMessagingClient(this.environment),
        (payload) => handleMessage(toForegroundPushMessage(payload)),
      );
    });

    return () => {
      active = false;
      unsubscribe?.();
      void Promise.all(removeNativeListeners.map((remove) => remove()));
    };
  }

  private async persistPushToken({
    platform,
    token,
    tokenRegisteredAtIso,
    userId,
  }: {
    platform: string;
    token: string;
    tokenRegisteredAtIso: string;
    userId: string;
  }) {
    const installationId = await getPushInstallationId();
    const tokenId = await hashToken(installationId);
    const tokenRef = doc(
      this.firestore,
      'users',
      userId,
      'pushTokens',
      tokenId,
    );
    const existing = await getDoc(tokenRef);

    await setDoc(
      tokenRef,
      {
        ...(existing.exists()
          ? {}
          : {
              createdAtIso: tokenRegisteredAtIso,
              firstRegisteredAt: serverTimestamp(),
              firstRegisteredAtIso: tokenRegisteredAtIso,
            }),
        installationId,
        lastSeenAt: serverTimestamp(),
        lastSeenAtIso: tokenRegisteredAtIso,
        permissionLastCheckedAtIso: tokenRegisteredAtIso,
        permission: 'granted',
        platform,
        provider: 'firebaseCloudMessaging',
        status: 'active',
        token,
        tokenId,
        userAgent:
          typeof navigator === 'undefined'
            ? 'native-shell'
            : navigator.userAgent,
      },
      { merge: true },
    );
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

async function registerMessagingServiceWorker(environment: AppEnvironment) {
  if (!environment.firebaseConfig) {
    throw new Error('Firebase messaging config is missing.');
  }

  return navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/',
    updateViaCache: 'none',
  });
}

function navigateToPushLink(link: string) {
  const target = new URL(link, window.location.origin);
  if (target.origin !== window.location.origin) return;

  const nextPath = `${target.pathname}${target.search}${target.hash}`;
  window.history.pushState(null, '', nextPath);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.focus();
}

function toForegroundPushMessage(
  payload: MessagePayload,
): ForegroundPushMessage {
  return {
    body: payload.notification?.body ?? payload.data?.body ?? '',
    link: payload.data?.link ?? '/app/today',
    title: payload.notification?.title ?? payload.data?.title ?? 'Garden alert',
    type: payload.data?.type ?? 'weather',
  };
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );

  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function waitForNativePushToken(
  PushNotifications: PushNotificationsPlugin,
) {
  let resolveToken: (token: string) => void = () => undefined;
  let rejectToken: (error: Error) => void = () => undefined;
  const listeners = await Promise.all([
    PushNotifications.addListener('registration', (token) => {
      if (!token.value) {
        return;
      }

      resolveToken(token.value);
    }),
    PushNotifications.addListener('registrationError', (error) => {
      rejectToken(new Error(error.error ?? 'Native push registration failed.'));
    }),
  ]);

  try {
    const token = await new Promise<string>((resolve, reject) => {
      const timeoutId = globalThis.setTimeout(() => {
        reject(new Error('Native push registration timed out.'));
      }, 15_000);

      resolveToken = (value: string) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      };
      rejectToken = (error: Error) => {
        globalThis.clearTimeout(timeoutId);
        reject(error);
      };

      void PushNotifications.register().catch(rejectToken);
    });

    return token;
  } finally {
    await Promise.all(listeners.map((listener) => listener.remove()));
  }
}
