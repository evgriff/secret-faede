import { beforeEach, describe, expect, it, vi } from 'vitest';
import { doc, setDoc } from 'firebase/firestore';
import { getToken, isSupported } from 'firebase/messaging';

import type { AppEnvironment } from '../../../shared/config/env';
import { FirebaseNotificationService } from './firebaseNotificationService';

const mocks = vi.hoisted(() => {
  const firestoreClient = { app: 'firebase-app' };
  const messagingClient = { senderId: 'sender-id' };

  return {
    doc: vi.fn((_firestore, ...segments: string[]) => ({
      path: segments.join('/'),
    })),
    firestoreClient,
    getFirebaseMessagingClient: vi.fn(() => messagingClient),
    getFirestoreClient: vi.fn(() => firestoreClient),
    getToken: vi.fn(),
    isSupported: vi.fn(),
    messagingClient,
    onMessage: vi.fn(),
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    setDoc: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('../app', () => ({
  getFirebaseMessagingClient: mocks.getFirebaseMessagingClient,
  getFirestoreClient: mocks.getFirestoreClient,
}));

vi.mock('firebase/firestore', () => ({
  doc: mocks.doc,
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
    authDomain: 'your-project-id.firebaseapp.com',
    messagingSenderId: 'sender-id',
    projectId: 'secret-faeries',
    storageBucket: 'example-garden-app.appspot.com',
  },
  firestoreEmulatorPort: 8080,
  functionsEmulatorPort: 5001,
  geocodingApiKey: null,
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
    mocks.isSupported.mockResolvedValue(true);
    mocks.getToken.mockResolvedValue('web-fcm-token');

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
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: vi.fn(() =>
          Promise.resolve({
            scope: 'http://localhost/firebase-messaging-sw.js',
          }),
        ),
      },
    });
  });

  it('does not request FCM when Firebase messaging config is missing', async () => {
    const service = new FirebaseNotificationService({
      ...firebaseEnvironment,
      firebaseConfig: null,
      messagingVapidKey: null,
    });

    await expect(service.registerWebPush('uid-evan')).resolves.toEqual({
      message: 'Web push needs Firebase messaging config and a VAPID key.',
      status: 'unavailable',
      tokenRegisteredAtIso: null,
    });
    expect(isSupported).not.toHaveBeenCalled();
  });

  it('registers a web FCM token under the user pushTokens collection', async () => {
    const service = new FirebaseNotificationService(firebaseEnvironment);

    const result = await service.registerWebPush('uid-evan');

    expect(result).toMatchObject({
      message: 'Web push is enabled for this browser.',
      status: 'registered',
      tokenRegisteredAtIso: expect.any(String),
    });
    expect(getToken).toHaveBeenCalledWith(
      mocks.messagingClient,
      expect.objectContaining({
        serviceWorkerRegistration: expect.objectContaining({
          scope: expect.stringContaining('/firebase-messaging-sw.js'),
        }),
        vapidKey: 'vapid-key',
      }),
    );
    expect(doc).toHaveBeenCalledWith(
      mocks.firestoreClient,
      'users',
      'uid-evan',
      'pushTokens',
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(setDoc).toHaveBeenCalledWith(
      expect.objectContaining({
        path: expect.stringMatching(
          /^users\/uid-evan\/pushTokens\/[a-f0-9]{64}$/,
        ),
      }),
      expect.objectContaining({
        permission: 'granted',
        platform: 'web',
        status: 'active',
        token: 'web-fcm-token',
        tokenId: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
      { merge: true },
    );
  });
});
