export type RuntimeMode = 'firebase' | 'mock';

export interface FirebaseRuntimeConfig {
  apiKey: string;
  appId: string;
  authDomain: string;
  messagingSenderId: string;
  projectId: string;
  storageBucket: string;
}

export interface AppEnvironment {
  authEmulatorPort: number;
  emulatorHost: string;
  fallbackReason: string | null;
  firebaseConfig: FirebaseRuntimeConfig | null;
  firestoreEmulatorPort: number;
  pwaEnabled: boolean;
  requestedMode: RuntimeMode;
  runtimeMode: RuntimeMode;
  useFirebaseEmulators: boolean;
}

function hasText(value: string | undefined): value is string {
  return Boolean(value && value.trim());
}

export function resolveAppEnvironment(): AppEnvironment {
  const requestedMode =
    import.meta.env.VITE_APP_RUNTIME === 'firebase' ? 'firebase' : 'mock';
  const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  };
  const firebaseConfigured = Object.values(firebaseConfig).every(hasText);
  const runtimeMode =
    requestedMode === 'firebase' && firebaseConfigured ? 'firebase' : 'mock';

  return {
    authEmulatorPort: Number(
      import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_PORT ?? 9099,
    ),
    emulatorHost: import.meta.env.VITE_FIREBASE_EMULATOR_HOST ?? '127.0.0.1',
    fallbackReason:
      requestedMode === 'firebase' && !firebaseConfigured
        ? 'Firebase mode was requested but one or more VITE_FIREBASE_* values are missing. The app is using mock services instead.'
        : null,
    firebaseConfig: firebaseConfigured
      ? {
          apiKey: firebaseConfig.apiKey ?? '',
          appId: firebaseConfig.appId ?? '',
          authDomain: firebaseConfig.authDomain ?? '',
          messagingSenderId: firebaseConfig.messagingSenderId ?? '',
          projectId: firebaseConfig.projectId ?? '',
          storageBucket: firebaseConfig.storageBucket ?? '',
        }
      : null,
    firestoreEmulatorPort: Number(
      import.meta.env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT ?? 8080,
    ),
    pwaEnabled: import.meta.env.VITE_ENABLE_PWA !== 'false',
    requestedMode,
    runtimeMode,
    useFirebaseEmulators:
      import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true',
  };
}
