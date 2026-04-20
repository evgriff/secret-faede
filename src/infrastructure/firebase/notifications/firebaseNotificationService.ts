import type {
  ForegroundPushMessage,
  NotificationService,
  PushRegistrationResult,
} from '../../../domain/notifications/NotificationService';
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
    const tokenId = await hashToken(token);

    await setDoc(doc(this.firestore, 'users', userId, 'pushTokens', tokenId), {
      createdAt: serverTimestamp(),
      createdAtIso: tokenRegisteredAtIso,
      lastSeenAt: serverTimestamp(),
      lastSeenAtIso: tokenRegisteredAtIso,
      permission: 'granted',
      platform: 'web',
      token,
      tokenId,
      userAgent: navigator.userAgent,
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
