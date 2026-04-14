import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

import type { AppEnvironment } from '../../shared/config/env';

let firebaseAppSingleton: ReturnType<typeof initializeApp> | null = null;
let authSingleton: ReturnType<typeof getAuth> | null = null;
let firestoreSingleton: ReturnType<typeof getFirestore> | null = null;
let authEmulatorConnected = false;
let firestoreEmulatorConnected = false;

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
    firestoreSingleton = getFirestore(getFirebaseApp(environment));
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
