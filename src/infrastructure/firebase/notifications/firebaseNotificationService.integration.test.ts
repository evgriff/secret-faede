import { beforeEach, describe, expect, it, vi } from 'vitest';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getToken, isSupported } from 'firebase/messaging';

import type { AppEnvironment } from '../../../shared/config/env';
import { FirebaseNotificationService } from './firebaseNotificationService';

const mocks = vi.hoisted(() => {
  const firestoreClient = { app: 'firebase-app' };
  const messagingClient = { senderId: 'sender-id' };
  const nativeListeners = new Map<string, (value: never) => void>();

  return {
    capacitor: {
      getPlatform: vi.fn(() => 'web'),
      isNativePlatform: vi.fn(() => false),
    },
    doc: vi.fn((_firestore, ...segments: string[]) => ({
      path: segments.join('/'),
    })),
    firestoreClient,
    getFirebaseMessagingClient: vi.fn(() => messagingClient),
    getFirestoreClient: vi.fn(() => firestoreClient),
    getDoc: vi.fn(() => Promise.resolve({ exists: () => false })),
    getToken: vi.fn(),
    isSupported: vi.fn(),
    messagingClient,
    nativeListeners,
    onMessage: vi.fn(),
    pushNotifications: {
      addListener: vi.fn(
        (eventName: string, listener: (value: never) => void) => {
          nativeListeners.set(eventName, listener);
          return Promise.resolve({ remove: vi.fn(() => Promise.resolve()) });
        },
      ),
      register: vi.fn(() => Promise.resolve()),
      requestPermissions: vi.fn(() => Promise.resolve({ receive: 'granted' })),
    },
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    serviceWorkerRegister: vi.fn(() =>
      Promise.resolve({ scope: 'http://localhost/' }),
    ),
    setDoc: vi
      .fn<
        (reference: unknown, data: unknown, options: unknown) => Promise<void>
      >()
      .mockResolvedValue(undefined),
  };
});

vi.mock('@capacitor/core', () => ({ Capacitor: mocks.capacitor }));

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: mocks.pushNotifications,
}));

vi.mock('../app', () => ({
  getFirebaseMessagingClient: mocks.getFirebaseMessagingClient,
  getFirestoreClient: mocks.getFirestoreClient,
}));

vi.mock('firebase/firestore', () => ({
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  serverTimestamp: mocks.serverTimestamp,
  setDoc: mocks.setDoc,
}));

vi.mock('firebase/messaging', () => ({
  getToken: mocks.getToken,
  isSupported: mocks.isSupported,
  onMessage: mocks.onMessage,
}));

const firebaseEnvironment: AppEnvironment = {
  allowedEmails: ['primary.gardener@example.com'],
  allowlistError: null,
  authEmulatorPort: 9099,
  emulatorHost: '127.0.0.1',
  fallbackReason: null,
  firebaseConfig: {
    apiKey: 'api-key',
    appId: 'app-id',
    authDomain: 'example-garden-app.firebaseapp.com',
    messagingSenderId: 'sender-id',
    projectId: 'example-garden-app',
    storageBucket: 'example-garden-app.appspot.com',
  },
  firestoreEmulatorPort: 8080,
  functionsEmulatorPort: 5001,
  messagingVapidKey: 'vapid-key',
  pwaEnabled: false,
  requestedMode: 'firebase',
  runtimeMode: 'firebase',
  storageEmulatorPort: 9199,
  tomorrowApiKey: null,
  tomorrowWeatherEnabled: false,
  useFirebaseEmulators: true,
};

describe('FirebaseNotificationService integration seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.nativeListeners.clear();
    mocks.capacitor.getPlatform.mockReturnValue('web');
    mocks.capacitor.isNativePlatform.mockReturnValue(false);
    mocks.getDoc.mockResolvedValue({ exists: () => false });
    mocks.isSupported.mockResolvedValue(true);
    mocks.getToken.mockResolvedValue('web-fcm-token');
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');

    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: {
        requestPermission: vi.fn(() => Promise.resolve('granted')),
      },
    });
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: window.Notification,
    });
    Object.defineProperty(window, 'focus', {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: mocks.serviceWorkerRegister,
      },
    });
  });

  it('does not request FCM when Firebase messaging config is missing', async () => {
    const service = new FirebaseNotificationService({
      ...firebaseEnvironment,
      firebaseConfig: null,
      messagingVapidKey: null,
    });

    await expect(service.registerWebPush('uid-primary')).resolves.toEqual({
      message: 'Web push needs Firebase messaging config and a VAPID key.',
      status: 'unavailable',
      tokenRegisteredAtIso: null,
    });
    expect(isSupported).not.toHaveBeenCalled();
  });

  it('registers a web FCM token under the user pushTokens collection', async () => {
    const service = new FirebaseNotificationService(firebaseEnvironment);

    const result = await service.registerWebPush('uid-primary');

    expect(result).toMatchObject({
      message: 'Web push is enabled for this browser.',
      status: 'registered',
      tokenRegisteredAtIso: expect.any(String),
    });
    expect(getToken).toHaveBeenCalledWith(
      mocks.messagingClient,
      expect.objectContaining({
        serviceWorkerRegistration: expect.objectContaining({
          scope: 'http://localhost/',
        }),
        vapidKey: 'vapid-key',
      }),
    );
    expect(navigator.serviceWorker.register).toHaveBeenCalledWith(
      '/firebase-messaging-sw.js',
      { scope: '/', updateViaCache: 'none' },
    );
    expect(getDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringMatching(
          /^users\/uid-primary\/pushTokens\/[a-f0-9]{64}$/,
        ),
      }),
    );
    expect(doc).toHaveBeenCalledWith(
      mocks.firestoreClient,
      'users',
      'uid-primary',
      'pushTokens',
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringMatching(
          /^users\/uid-primary\/pushTokens\/[a-f0-9]{64}$/,
        ),
      }),
      expect.objectContaining({
        installationId: expect.any(String),
        permission: 'granted',
        platform: 'web',
        provider: 'firebaseCloudMessaging',
        status: 'active',
        token: 'web-fcm-token',
        tokenId: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      { merge: true },
    );
  });

  it('keeps the current installation document stable across FCM token rotation', async () => {
    const service = new FirebaseNotificationService(firebaseEnvironment);
    mocks.getToken
      .mockResolvedValueOnce('web-fcm-token-a')
      .mockResolvedValueOnce('web-fcm-token-b');

    await service.registerWebPush('uid-primary');
    await service.registerWebPush('uid-primary');

    expect(mocks.setDoc).toHaveBeenCalledTimes(2);
    expect(mocks.setDoc.mock.calls[0]?.[0]).toEqual(
      mocks.setDoc.mock.calls[1]?.[0],
    );
    expect(mocks.setDoc.mock.calls[0]?.[1]).toMatchObject({
      token: 'web-fcm-token-a',
    });
    expect(mocks.setDoc.mock.calls[1]?.[1]).toMatchObject({
      token: 'web-fcm-token-b',
    });
  });

  it('does not persist an iOS APNs token as Firebase Cloud Messaging', async () => {
    mocks.capacitor.getPlatform.mockReturnValue('ios');
    mocks.capacitor.isNativePlatform.mockReturnValue(true);
    const service = new FirebaseNotificationService(firebaseEnvironment);

    await expect(service.registerNativePush('uid-primary')).resolves.toEqual({
      message:
        'iOS push is not available until the native shell provides a Firebase Cloud Messaging token. An APNs token will not be registered as FCM.',
      status: 'unavailable',
      tokenRegisteredAtIso: null,
    });
    expect(mocks.pushNotifications.requestPermissions).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('deep-links native notification actions without replaying a foreground alert', async () => {
    mocks.capacitor.getPlatform.mockReturnValue('android');
    mocks.capacitor.isNativePlatform.mockReturnValue(true);
    const service = new FirebaseNotificationService(firebaseEnvironment);
    const handleForegroundMessage = vi.fn();
    const unsubscribe = service.subscribeToForegroundMessages(
      handleForegroundMessage,
    );

    await vi.waitFor(() => {
      expect(
        mocks.nativeListeners.get('pushNotificationActionPerformed'),
      ).toBeTypeOf('function');
    });
    mocks.nativeListeners.get('pushNotificationActionPerformed')?.({
      notification: { data: { link: '/app/today?source=push' } },
    } as never);

    expect(window.location.pathname).toBe('/app/today');
    expect(window.location.search).toBe('?source=push');
    expect(handleForegroundMessage).not.toHaveBeenCalled();
    unsubscribe();
  });
});
