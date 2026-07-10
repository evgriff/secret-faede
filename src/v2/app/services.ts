import { createLazyMobileDeviceService } from '../../infrastructure/capacitor/lazyMobileDeviceService';
import { createWeatherProvider } from '../../infrastructure/weather/createWeatherProvider';
import { resolveAppEnvironment } from '../../shared/config/env';
import type { AppEnvironment } from '../../shared/config/env';
import { configureNetworkStatusAdapter } from '../../shared/network/networkStatus';
import type { AuthService } from '../../domain/auth/AuthService';
import type { GardenOperationsService } from '../../domain/gardens/GardenOperationsService';
import type { MediaStorageService } from '../../domain/media/MediaStorageService';
import type { MobileDeviceService } from '../../domain/mobile/MobileDeviceService';
import type { NotificationService } from '../../domain/notifications/NotificationService';
import type { TelemetryService } from '../../domain/telemetry/TelemetryService';
import type { WeatherProvider } from '../../domain/weather/WeatherProvider';
import {
  USER_PROFILE_SCHEMA_VERSION,
  type NotificationPreferences,
  type UserProfile,
} from '../domain';
import type { GardenRepository } from '../data/GardenRepository';
import type { UserProfileRepository } from '../data/UserProfileRepository';

export interface V2Services {
  authService: AuthService;
  environment: AppEnvironment;
  gardenOperationsService: GardenOperationsService;
  gardenRepository: GardenRepository;
  mediaStorageService: MediaStorageService;
  mobileDeviceService: MobileDeviceService;
  notificationService: NotificationService;
  resolvePhotoUrl(storagePath: string): Promise<string>;
  telemetryService: TelemetryService;
  userProfileRepository: UserProfileRepository;
  weatherProvider: WeatherProvider;
}

export async function createV2Services(): Promise<V2Services> {
  const environment = resolveAppEnvironment();
  const mobileDeviceService = createLazyMobileDeviceService();
  const weatherProvider = createWeatherProvider(environment);
  configureNetworkStatusAdapter(mobileDeviceService);

  if (environment.runtimeMode === 'firebase') {
    const [
      { getFirebaseStorageClient, getFirestoreClient },
      { getDownloadURL, ref },
      { FirebaseAuthService },
      { FirebaseGardenOperationsService },
      { FirebaseMediaStorageService },
      { FirebaseNotificationService },
      { FirebaseTelemetryService },
      { FirebaseGardenRepository },
      { FirebaseUserProfileRepository },
      { CallableFirebaseWorkspaceMutationGateway },
    ] = await Promise.all([
      import('../../infrastructure/firebase/app'),
      import('firebase/storage'),
      import('../../infrastructure/firebase/auth/firebaseAuthService'),
      import('../../infrastructure/firebase/gardens/firebaseGardenOperationsService'),
      import('../../infrastructure/firebase/media/firebaseMediaStorageService'),
      import('../../infrastructure/firebase/notifications/firebaseNotificationService'),
      import('../../infrastructure/firebase/telemetry/firebaseTelemetryService'),
      import('../data/FirebaseGardenRepository'),
      import('../data/FirebaseUserProfileRepository'),
      import('../data/FirebaseWorkspaceMutationGateway'),
    ]);
    const db = getFirestoreClient(environment);
    return {
      authService: new FirebaseAuthService(environment),
      environment,
      gardenOperationsService: new FirebaseGardenOperationsService(environment),
      gardenRepository: new FirebaseGardenRepository({
        db,
        mutations: new CallableFirebaseWorkspaceMutationGateway(environment),
      }),
      mediaStorageService: new FirebaseMediaStorageService(environment),
      mobileDeviceService,
      notificationService: new FirebaseNotificationService(environment),
      resolvePhotoUrl: (storagePath) =>
        getDownloadURL(ref(getFirebaseStorageClient(environment), storagePath)),
      telemetryService: new FirebaseTelemetryService(environment),
      userProfileRepository: new FirebaseUserProfileRepository(db),
      weatherProvider,
    };
  }

  const [
    { MockAuthService },
    { MockGardenOperationsService },
    { MockMediaStorageService },
    { MockNotificationService },
    { MockTelemetryService },
    { MockGardenRepository },
    { MockUserProfileRepository },
  ] = await Promise.all([
    import('../../infrastructure/mock/auth/mockAuthService'),
    import('../../infrastructure/mock/gardens/mockGardenOperationsService'),
    import('../../infrastructure/mock/media/mockMediaStorageService'),
    import('../../infrastructure/mock/notifications/mockNotificationService'),
    import('../../infrastructure/mock/telemetry/mockTelemetryService'),
    import('../data/MockGardenRepository'),
    import('../data/MockUserProfileRepository'),
  ]);
  const storage = window.localStorage;
  return {
    authService: new MockAuthService(),
    environment,
    gardenOperationsService: new MockGardenOperationsService(),
    gardenRepository: new MockGardenRepository({ storage }),
    mediaStorageService: new MockMediaStorageService(),
    mobileDeviceService,
    notificationService: new MockNotificationService(),
    resolvePhotoUrl: async (storagePath) => storagePath,
    telemetryService: new MockTelemetryService(),
    userProfileRepository: new MockUserProfileRepository(storage, (userId) =>
      createDefaultProfile(userId),
    ),
    weatherProvider,
  };
}

export function createDefaultProfile(
  userId: string,
  identity: { displayName?: string; email?: string } = {},
  now = new Date(),
): UserProfile {
  return {
    displayName: identity.displayName || 'Gardener',
    email: identity.email || `${userId}@example.invalid`,
    notificationPreferences: createDefaultNotificationPreferences(),
    schemaVersion: USER_PROFILE_SCHEMA_VERSION,
    timezone: resolveDeviceTimezone(),
    updatedAtIso: now.toISOString(),
    userId,
  };
}

function resolveDeviceTimezone() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timezone && timezone.trim() ? timezone : 'UTC';
}

export function createDefaultNotificationPreferences(): NotificationPreferences {
  return {
    alertKinds: {
      frost: true,
      heat: true,
      severeWeather: true,
      taskDue: true,
      watering: true,
    },
    dailyCheckTime: '07:00',
    minimumWateringDeficitInches: 0.25,
    pushEnabled: false,
    quietHours: {
      end: '07:00',
      start: '21:00',
    },
  };
}
