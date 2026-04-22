import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';

import type { AppEnvironment } from '../../../shared/config/env';
import { FirebaseMediaStorageService } from './firebaseMediaStorageService';

const mocks = vi.hoisted(() => {
  const storageClient = { app: 'firebase-app' };
  const storageRef = { fullPath: 'users/uid/journal/entry/photo.jpg' };

  return {
    getDownloadURL: vi.fn(() =>
      Promise.resolve('https://storage.example/photo.jpg'),
    ),
    getFirebaseStorageClient: vi.fn(() => storageClient),
    ref: vi.fn(() => storageRef),
    storageClient,
    storageRef,
    uploadBytes: vi.fn(() => Promise.resolve({ ref: storageRef })),
  };
});

vi.mock('../app', () => ({
  getFirebaseStorageClient: mocks.getFirebaseStorageClient,
}));

vi.mock('firebase/storage', () => ({
  getDownloadURL: mocks.getDownloadURL,
  ref: mocks.ref,
  uploadBytes: mocks.uploadBytes,
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

describe('FirebaseMediaStorageService integration seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploads journal photos with scoped metadata and sanitized names', async () => {
    const service = new FirebaseMediaStorageService(environment);
    const file = new File(['photo'], 'Field Photo!!.JPG', {
      type: 'image/jpeg',
    });

    const result = await service.uploadJournalPhoto({
      entryId: 'entry-a',
      file,
      gardenId: 'garden-a',
      userId: 'uid-evan',
    });

    expect(ref).toHaveBeenCalledWith(
      mocks.storageClient,
      expect.stringMatching(
        /^users\/uid-evan\/journal\/entry-a\/.+-field-photo-.jpg$/,
      ),
    );
    expect(uploadBytes).toHaveBeenCalledWith(mocks.storageRef, file, {
      contentType: 'image/jpeg',
      customMetadata: {
        entryId: 'entry-a',
        gardenId: 'garden-a',
        userId: 'uid-evan',
      },
    });
    expect(getDownloadURL).toHaveBeenCalledWith(mocks.storageRef);
    expect(result).toMatchObject({
      contentType: 'image/jpeg',
      downloadUrl: 'https://storage.example/photo.jpg',
      fileName: 'field-photo-.jpg',
      sizeBytes: file.size,
      storagePath: expect.stringContaining('users/uid-evan/journal/entry-a/'),
    });
  });
});
