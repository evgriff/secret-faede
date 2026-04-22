import { parseAllowedEmails } from '../auth/allowlist';

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
  allowedEmails: string[];
  allowlistError: string | null;
  authEmulatorPort: number;
  emulatorHost: string;
  fallbackReason: string | null;
  firebaseConfig: FirebaseRuntimeConfig | null;
  firestoreEmulatorPort: number;
  functionsEmulatorPort: number;
  geocodingApiKey: string | null;
  messagingVapidKey: string | null;
  pwaEnabled: boolean;
  requestedMode: RuntimeMode;
  runtimeMode: RuntimeMode;
  storageEmulatorPort: number;
  tomorrowApiKey: string | null;
  tomorrowWeatherEnabled: boolean;
  useFirebaseEmulators: boolean;
}

export interface AppEnvSource {
  VITE_ALLOWED_EMAILS?: string;
  VITE_APP_RUNTIME?: string;
  VITE_ENABLE_PWA?: string;
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_APP_ID?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_AUTH_EMULATOR_PORT?: string;
  VITE_FIREBASE_EMULATOR_HOST?: string;
  VITE_FIREBASE_FIRESTORE_EMULATOR_PORT?: string;
  VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT?: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_STORAGE_EMULATOR_PORT?: string;
  VITE_FIREBASE_STORAGE_BUCKET?: string;
  VITE_GOOGLE_MAPS_API_KEY?: string;
  VITE_FIREBASE_MESSAGING_VAPID_KEY?: string;
  VITE_TOMORROW_API_KEY?: string;
  VITE_ENABLE_TOMORROW_WEATHER?: string;
  VITE_USE_FIREBASE_EMULATORS?: string;
}

function hasText(value: string | undefined): value is string {
  return Boolean(value && value.trim());
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsedValue = Number(value ?? fallback);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
}

export function resolveAppEnvironmentFromEnv(
  env: AppEnvSource,
): AppEnvironment {
  const requestedMode =
    env.VITE_APP_RUNTIME === 'firebase' ? 'firebase' : 'mock';
  const { allowedEmails, error } = parseAllowedEmails(env.VITE_ALLOWED_EMAILS);
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    appId: env.VITE_FIREBASE_APP_ID,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  };
  const firebaseConfigured = Object.values(firebaseConfig).every(hasText);
  const runtimeMode =
    requestedMode === 'firebase' && firebaseConfigured ? 'firebase' : 'mock';

  return {
    allowedEmails,
    allowlistError: error,
    authEmulatorPort: parsePort(env.VITE_FIREBASE_AUTH_EMULATOR_PORT, 9099),
    emulatorHost: env.VITE_FIREBASE_EMULATOR_HOST ?? '127.0.0.1',
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
    firestoreEmulatorPort: parsePort(
      env.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT,
      8080,
    ),
    functionsEmulatorPort: parsePort(
      env.VITE_FIREBASE_FUNCTIONS_EMULATOR_PORT,
      5001,
    ),
    geocodingApiKey: hasText(env.VITE_GOOGLE_MAPS_API_KEY)
      ? env.VITE_GOOGLE_MAPS_API_KEY.trim()
      : null,
    messagingVapidKey: hasText(env.VITE_FIREBASE_MESSAGING_VAPID_KEY)
      ? env.VITE_FIREBASE_MESSAGING_VAPID_KEY.trim()
      : null,
    pwaEnabled: env.VITE_ENABLE_PWA !== 'false',
    requestedMode,
    runtimeMode,
    storageEmulatorPort: parsePort(
      env.VITE_FIREBASE_STORAGE_EMULATOR_PORT,
      9199,
    ),
    tomorrowApiKey: hasText(env.VITE_TOMORROW_API_KEY)
      ? env.VITE_TOMORROW_API_KEY.trim()
      : null,
    tomorrowWeatherEnabled: env.VITE_ENABLE_TOMORROW_WEATHER === 'true',
    useFirebaseEmulators: env.VITE_USE_FIREBASE_EMULATORS === 'true',
  };
}

export function resolveAppEnvironment(): AppEnvironment {
  return resolveAppEnvironmentFromEnv(import.meta.env);
}
