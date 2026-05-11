import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import type { AppEnvironment } from '../../../shared/config/env';
import { FirebaseAuthService } from './firebaseAuthService';

const mocks = vi.hoisted(() => {
  const authClient = {
    currentUser: null as {
      displayName: string | null;
      email: string | null;
      uid: string;
    } | null,
  };

  return {
    authClient,
    getFirebaseAuthClient: vi.fn(() => authClient),
    onAuthStateChanged: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
    setPersistence: vi.fn(() => Promise.resolve()),
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('../app', () => ({
  getFirebaseAuthClient: mocks.getFirebaseAuthClient,
}));

vi.mock('firebase/auth', () => ({
  browserLocalPersistence: { type: 'LOCAL' },
  browserSessionPersistence: { type: 'SESSION' },
  onAuthStateChanged: mocks.onAuthStateChanged,
  sendPasswordResetEmail: mocks.sendPasswordResetEmail,
  setPersistence: mocks.setPersistence,
  signInWithEmailAndPassword: mocks.signInWithEmailAndPassword,
  signOut: mocks.signOut,
}));

const environment: AppEnvironment = {
  allowedEmails: [
    'primary.gardener@example.com',
    'partner.gardener@example.com',
  ],
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
  geocodingApiKey: null,
  messagingVapidKey: null,
  pwaEnabled: false,
  requestedMode: 'firebase',
  runtimeMode: 'firebase',
  storageEmulatorPort: 9199,
  tomorrowApiKey: null,
  tomorrowWeatherEnabled: false,
  useFirebaseEmulators: true,
};

describe('FirebaseAuthService integration seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authClient.currentUser = null;
    mocks.getFirebaseAuthClient.mockReturnValue(mocks.authClient);
    mocks.setPersistence.mockResolvedValue(undefined);
    mocks.signInWithEmailAndPassword.mockResolvedValue({
      user: {
        displayName: 'Primary Gardener',
        email: 'primary.gardener@example.com',
        uid: 'uid-primary',
      },
    });
  });

  it('signs in with email/password using the requested persistence mode', async () => {
    const service = new FirebaseAuthService(environment);

    const user = await service.signInWithPassword({
      email: ' PRIMARY.GARDENER@Example.com ',
      password: 'temporary-password',
      rememberDevice: false,
    });

    expect(setPersistence).toHaveBeenNthCalledWith(
      1,
      mocks.authClient,
      browserLocalPersistence,
    );
    expect(setPersistence).toHaveBeenNthCalledWith(
      2,
      mocks.authClient,
      browserSessionPersistence,
    );
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      mocks.authClient,
      'primary.gardener@example.com',
      'temporary-password',
    );
    expect(user).toEqual({
      displayName: 'Primary Gardener',
      email: 'primary.gardener@example.com',
      provider: 'firebase',
      uid: 'uid-primary',
    });
  });

  it('keeps local persistence when remember device is enabled', async () => {
    const service = new FirebaseAuthService(environment);

    await service.signInWithPassword({
      email: 'partner.gardener@example.com',
      password: 'temporary-password',
      rememberDevice: true,
    });

    expect(setPersistence).toHaveBeenLastCalledWith(
      mocks.authClient,
      browserLocalPersistence,
    );
  });

  it('sends reset email and signs out through Firebase auth', async () => {
    const service = new FirebaseAuthService(environment);

    await service.sendPasswordReset('partner.gardener@example.com');
    await service.signOut();

    expect(sendPasswordResetEmail).toHaveBeenCalledWith(
      mocks.authClient,
      'partner.gardener@example.com',
    );
    expect(signOut).toHaveBeenCalledWith(mocks.authClient);
  });
});
