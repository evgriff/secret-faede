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
      platform: `native-${Capacitor.getPlatform()}`,
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
    let active = true;

    void isSupported().then((supported) => {
      if (!supported || !active) {
        return;
      }

      unsubscribe = onMessage(
        getFirebaseMessagingClient(this.environment),
        (payload) => handleMessage(toForegroundPushMessage(payload)),
      );
    });

    return () => {
      active = false;
      unsubscribe?.();
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
    const tokenId = await hashToken(token);

    await setDoc(
      doc(this.firestore, 'users', userId, 'pushTokens', tokenId),
      {
        createdAtIso: tokenRegisteredAtIso,
        firstRegisteredAt: serverTimestamp(),
        firstRegisteredAtIso: tokenRegisteredAtIso,
        lastSeenAt: serverTimestamp(),
        lastSeenAtIso: tokenRegisteredAtIso,
        permissionLastCheckedAtIso: tokenRegisteredAtIso,
        permission: 'granted',
        platform,
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

async function registerMessagingServiceWorker(environment: AppEnvironment) {
  if (!environment.firebaseConfig) {
    throw new Error('Firebase messaging config is missing.');
  }

  const url = new URL('/firebase-messaging-sw.js', window.location.origin);

  const entries = Object.entries(environment.firebaseConfig) as Array<
    [string, string]
  >;

  entries.forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return navigator.serviceWorker.register(url.pathname + url.search);
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
