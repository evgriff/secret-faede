import { initializeApp } from 'firebase/app';
import {
  getAnalytics,
  isSupported,
  logEvent,
  type Analytics,
} from 'firebase/analytics';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from 'firebase/functions';
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
let functionsSingleton: Functions | null = null;
let messagingSingleton: Messaging | null = null;
let storageSingleton: FirebaseStorage | null = null;
let analyticsSingleton: Analytics | null = null;
let analyticsSupportedPromise: Promise<boolean> | null = null;
let authEmulatorConnected = false;
let firestoreEmulatorConnected = false;
let functionsEmulatorConnected = false;
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

export function getFirebaseFunctionsClient(environment: AppEnvironment) {
  if (!functionsSingleton) {
    functionsSingleton = getFunctions(getFirebaseApp(environment));
  }

  if (environment.useFirebaseEmulators && !functionsEmulatorConnected) {
    connectFunctionsEmulator(
      functionsSingleton,
      environment.emulatorHost,
      environment.functionsEmulatorPort,
    );
    functionsEmulatorConnected = true;
  }

  return functionsSingleton;
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

export async function getFirebaseAnalyticsClient(environment: AppEnvironment) {
  if (isAutomatedBrowser()) {
    return null;
  }

  if (!analyticsSupportedPromise) {
    analyticsSupportedPromise = isSupported().catch(() => false);
  }

  if (!(await analyticsSupportedPromise)) {
    return null;
  }

  if (!analyticsSingleton) {
    analyticsSingleton = getAnalytics(getFirebaseApp(environment));
  }

  return analyticsSingleton;
}

export async function logFirebaseAnalyticsEvent(
  environment: AppEnvironment,
  name: string,
  payload: Record<string, unknown> = {},
) {
  const analytics = await getFirebaseAnalyticsClient(environment);

  if (analytics) {
    logEvent(analytics, name, payload);
  }
}

function isAutomatedBrowser() {
  return typeof navigator !== 'undefined' && navigator.webdriver === true;
}
