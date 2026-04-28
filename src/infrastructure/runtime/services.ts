import type { AuthService } from '../../domain/auth/AuthService';
import type { GardenOperationsService } from '../../domain/gardens/GardenOperationsService';
import type { GardenRepository } from '../../domain/gardens/GardenRepository';
import type { MediaStorageService } from '../../domain/media/MediaStorageService';
import type { MobileDeviceService } from '../../domain/mobile/MobileDeviceService';
import type { NotificationService } from '../../domain/notifications/NotificationService';
import type { TelemetryService } from '../../domain/telemetry/TelemetryService';
import type { UserProfileRepository } from '../../domain/users/UserProfileRepository';
import type { WeatherProvider } from '../../domain/weather/WeatherProvider';
import type { AppEnvironment } from '../../shared/config/env';
import { resolveAppEnvironment } from '../../shared/config/env';
import { configureNetworkStatusAdapter } from '../../shared/network/networkStatus';
import { createLazyMobileDeviceService } from '../capacitor/lazyMobileDeviceService';
import { createWeatherProvider } from '../weather/createWeatherProvider';

export interface AppServices {
  authService: AuthService;
  environment: AppEnvironment;
  gardenOperationsService: GardenOperationsService;
  gardenRepository: GardenRepository;
  mediaStorageService: MediaStorageService;
  mobileDeviceService: MobileDeviceService;
  notificationService: NotificationService;
  telemetryService: TelemetryService;
  userProfileRepository: UserProfileRepository;
  weatherProvider: WeatherProvider;
}

export async function createRuntimeServices(
  environment: AppEnvironment = resolveAppEnvironment(),
): Promise<AppServices> {
  const weatherProvider = createWeatherProvider(environment);
  const mobileDeviceService = createLazyMobileDeviceService();

  configureNetworkStatusAdapter(mobileDeviceService);

  if (environment.runtimeMode === 'firebase') {
    const [
      { FirebaseAuthService },
      { FirebaseGardenOperationsService },
      { FirebaseGardenRepository },
      { FirebaseMediaStorageService },
      { FirebaseNotificationService },
      { FirebaseTelemetryService },
      { FirebaseUserProfileRepository },
    ] = await Promise.all([
      import('../firebase/auth/firebaseAuthService'),
      import('../firebase/gardens/firebaseGardenOperationsService'),
      import('../firebase/gardens/firebaseGardenRepository'),
      import('../firebase/media/firebaseMediaStorageService'),
      import('../firebase/notifications/firebaseNotificationService'),
      import('../firebase/telemetry/firebaseTelemetryService'),
      import('../firebase/users/firebaseUserProfileRepository'),
    ]);

    return {
      authService: new FirebaseAuthService(environment),
      environment,
      gardenOperationsService: new FirebaseGardenOperationsService(environment),
      gardenRepository: new FirebaseGardenRepository(environment),
      mediaStorageService: new FirebaseMediaStorageService(environment),
      mobileDeviceService,
      notificationService: new FirebaseNotificationService(environment),
      telemetryService: new FirebaseTelemetryService(environment),
      userProfileRepository: new FirebaseUserProfileRepository(environment),
      weatherProvider,
    };
  }

  const { createMockRuntimeServices } = await import('./mockServices');

  return createMockRuntimeServices({
    environment,
    mobileDeviceService,
    weatherProvider,
  });
}
