import { beforeEach, describe, expect, it, vi } from 'vitest';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import {
  annArborClimateProfile,
  defaultNotificationPreference,
  type UserProfile,
} from '../../../domain/gardens/GardenRepository';
import type { AppEnvironment } from '../../../shared/config/env';
import { FirebaseUserProfileRepository } from './firebaseUserProfileRepository';

const mocks = vi.hoisted(() => {
  const firestoreClient = { app: 'firebase-app' };

  return {
    doc: vi.fn((_firestore, ...segments: string[]) => ({
      path: segments.join('/'),
    })),
    firestoreClient,
    getDoc: vi.fn(),
    getFirestoreClient: vi.fn(() => firestoreClient),
    serverTimestamp: vi.fn(() => 'SERVER_TIMESTAMP'),
    setDoc: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('../app', () => ({
  getFirestoreClient: mocks.getFirestoreClient,
}));

vi.mock('firebase/firestore', () => ({
  doc: mocks.doc,
  getDoc: mocks.getDoc,
  serverTimestamp: mocks.serverTimestamp,
  setDoc: mocks.setDoc,
}));

const environment: AppEnvironment = {
  allowedEmails: ['primary.gardener@example.com'],
  allowlistError: null,
  authEmulatorPort: 9099,
  emulatorHost: '127.0.0.1',
  fallbackReason: null,
  firebaseConfig: null,
  firestoreEmulatorPort: 8080,
  functionsEmulatorPort: 5001,
  geocodingApiKey: null,
  messagingVapidKey: null,
  pwaEnabled: false,
  requestedMode: 'mock',
  runtimeMode: 'mock',
  storageEmulatorPort: 9199,
  tomorrowApiKey: null,
  tomorrowWeatherEnabled: false,
  useFirebaseEmulators: true,
};

describe('FirebaseUserProfileRepository integration seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDoc.mockResolvedValue({
      data: () => ({
        alertLocationQuery: 'Detroit, MI',
        defaultGardenId: 'garden-a',
        displayName: 'Primary Gardener',
        email: 'primary.gardener@example.com',
        // Compatibility fixture: retired delivery fields may exist on old docs
        // but must be dropped before app state can use them.
        notificationPreference: {
          ...defaultNotificationPreference,
          channelConsent: {
            ...defaultNotificationPreference.channelConsent,
            email: {
              consentCopyVersion: 'legacy',
              grantedAtIso: '2026-04-20T11:00:00.000Z',
              revokedAtIso: null,
              status: 'granted',
            },
          },
          channels: {
            ...defaultNotificationPreference.channels,
            email: true,
            push: true,
            carrier messaging: true,
          },
          email: 'alerts@example.com',
          phoneE164: '+17345550123',
        },
        timezone: 'America/Detroit',
      }),
      exists: () => true,
    });
  });

  it('loads notification preferences from the user Firestore document', async () => {
    const repository = new FirebaseUserProfileRepository(environment);
    const profile = await repository.getUserProfile(
      'uid-evan',
      'fallback@example.com',
    );

    expect(doc).toHaveBeenCalledWith(
      mocks.firestoreClient,
      'users',
      'uid-evan',
    );
    expect(getDoc).toHaveBeenCalledWith({ path: 'users/uid-evan' });
    expect(profile).toMatchObject({
      defaultGardenId: 'garden-a',
      displayName: 'Primary Gardener',
      email: 'primary.gardener@example.com',
      notificationPreference: {
        channels: expect.objectContaining({ push: true }),
      },
      uid: 'uid-evan',
    });
    expect(profile?.notificationPreference.channels).not.toHaveProperty(
      'email',
    );
    expect(profile?.notificationPreference.channels).not.toHaveProperty('carrier messaging');
    expect(profile?.notificationPreference.channelConsent).not.toHaveProperty(
      'email',
    );
    expect(profile?.notificationPreference).not.toHaveProperty('phoneE164');
  });

  it('saves profiles with server and ISO update timestamps', async () => {
    const repository = new FirebaseUserProfileRepository(environment);
    const profile: UserProfile = {
      alertLocationQuery: 'Detroit, MI',
      climateProfile: annArborClimateProfile,
      createdAtIso: '2026-04-20T12:00:00.000Z',
      defaultGardenId: 'uid-emma',
      displayName: 'Partner Gardener',
      email: 'partner.gardener@example.com',
      notificationPreference: {
        ...defaultNotificationPreference,
        channels: {
          ...defaultNotificationPreference.channels,
          push: true,
        },
      },
      timezone: 'America/Detroit',
      uid: 'uid-emma',
      updatedAtIso: null,
    };

    await repository.saveUserProfile(profile);

    expect(setDoc).toHaveBeenCalledWith(
      { path: 'users/uid-emma' },
      expect.objectContaining({
        displayName: 'Partner Gardener',
        notificationPreference: expect.objectContaining({
          channels: expect.objectContaining({ push: true }),
        }),
        uid: 'uid-emma',
        updatedAt: 'SERVER_TIMESTAMP',
        updatedAtIso: expect.any(String),
      }),
    );
  });
});
