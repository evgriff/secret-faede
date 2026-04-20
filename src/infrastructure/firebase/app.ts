import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getMessaging, type Messaging } from 'firebase/messaging';
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from 'firebase/storage';

import type { AppEnvironment } from '../../shared/config/env';

let firebaseAppSingleton: ReturnType<typeof initializeApp> | null = null;
let authSingleton: ReturnType<typeof getAuth> | null = null;
let firestoreSingleton: Firestore | null = null;
let messagingSingleton: Messaging | null = null;
let storageSingleton: FirebaseStorage | null = null;
let authEmulatorConnected = false;
let firestoreEmulatorConnected = false;
let storageEmulatorConnected = false;

function requireFirebaseConfig(environment: AppEnvironment) {
  if (!environment.firebaseConfig) {
    throw new Error(
      'Firebase configuration is incomplete for runtime mode "firebase".',
    );
  }

  return environment.firebaseConfig;
}

export function getFirebaseApp(environment: AppEnvironment) {
  if (!firebaseAppSingleton) {
    firebaseAppSingleton = initializeApp(requireFirebaseConfig(environment));
  }

  return firebaseAppSingleton;
}

export function getFirebaseAuthClient(environment: AppEnvironment) {
  if (!authSingleton) {
    authSingleton = getAuth(getFirebaseApp(environment));
    void setPersistence(authSingleton, browserLocalPersistence);
  }

  if (environment.useFirebaseEmulators && !authEmulatorConnected) {
    connectAuthEmulator(
      authSingleton,
      `http://${environment.emulatorHost}:${environment.authEmulatorPort}`,
      { disableWarnings: true },
    );
    authEmulatorConnected = true;
  }

  return authSingleton;
}

export function getFirestoreClient(environment: AppEnvironment) {
  if (!firestoreSingleton) {
    firestoreSingleton = initializeFirestore(getFirebaseApp(environment), {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  }

  if (environment.useFirebaseEmulators && !firestoreEmulatorConnected) {
    connectFirestoreEmulator(
      firestoreSingleton,
      environment.emulatorHost,
      environment.firestoreEmulatorPort,
    );
    firestoreEmulatorConnected = true;
  }

  return firestoreSingleton;
}

export function getFirebaseMessagingClient(environment: AppEnvironment) {
  if (!messagingSingleton) {
    messagingSingleton = getMessaging(getFirebaseApp(environment));
  }

  return messagingSingleton;
}

export function getFirebaseStorageClient(environment: AppEnvironment) {
  if (!storageSingleton) {
    storageSingleton = getStorage(getFirebaseApp(environment));
  }

  if (environment.useFirebaseEmulators && !storageEmulatorConnected) {
    connectStorageEmulator(
      storageSingleton,
      environment.emulatorHost,
      environment.storageEmulatorPort,
    );
    storageEmulatorConnected = true;
  }

  return storageSingleton;
}
