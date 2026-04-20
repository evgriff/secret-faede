import type { AuthService } from '../../domain/auth/AuthService';
import type { GardenRepository } from '../../domain/gardens/GardenRepository';
import type { MediaStorageService } from '../../domain/media/MediaStorageService';
import type { NotificationService } from '../../domain/notifications/NotificationService';
import type { UserProfileRepository } from '../../domain/users/UserProfileRepository';
import type { WeatherProvider } from '../../domain/weather/WeatherProvider';
import type { AppEnvironment } from '../../shared/config/env';
import { resolveAppEnvironment } from '../../shared/config/env';
import { FirebaseAuthService } from '../firebase/auth/firebaseAuthService';
import { FirebaseGardenRepository } from '../firebase/gardens/firebaseGardenRepository';
import { FirebaseMediaStorageService } from '../firebase/media/firebaseMediaStorageService';
import { FirebaseNotificationService } from '../firebase/notifications/firebaseNotificationService';
import { FirebaseUserProfileRepository } from '../firebase/users/firebaseUserProfileRepository';
import { MockAuthService } from '../mock/auth/mockAuthService';
import { MockGardenRepository } from '../mock/gardens/mockGardenRepository';
import { MockMediaStorageService } from '../mock/media/mockMediaStorageService';
import { MockNotificationService } from '../mock/notifications/mockNotificationService';
import { MockUserProfileRepository } from '../mock/users/mockUserProfileRepository';
import { createWeatherProvider } from '../weather/createWeatherProvider';

export interface AppServices {
  authService: AuthService;
  environment: AppEnvironment;
  gardenRepository: GardenRepository;
  mediaStorageService: MediaStorageService;
  notificationService: NotificationService;
  userProfileRepository: UserProfileRepository;
  weatherProvider: WeatherProvider;
}

export function createRuntimeServices(
  environment: AppEnvironment = resolveAppEnvironment(),
): AppServices {
  const weatherProvider = createWeatherProvider(environment);

  if (environment.runtimeMode === 'firebase') {
    return {
      authService: new FirebaseAuthService(environment),
      environment,
      gardenRepository: new FirebaseGardenRepository(environment),
      mediaStorageService: new FirebaseMediaStorageService(environment),
      notificationService: new FirebaseNotificationService(environment),
      userProfileRepository: new FirebaseUserProfileRepository(environment),
      weatherProvider,
    };
  }

  return {
    authService: new MockAuthService(),
    environment,
    gardenRepository: new MockGardenRepository(),
    mediaStorageService: new MockMediaStorageService(),
    notificationService: new MockNotificationService(),
    userProfileRepository: new MockUserProfileRepository(),
    weatherProvider,
  };
}
