import type { MobileDeviceService } from '../../domain/mobile/MobileDeviceService';
import type { WeatherProvider } from '../../domain/weather/WeatherProvider';
import type { AppEnvironment } from '../../shared/config/env';
import { MockAuthService } from '../mock/auth/mockAuthService';
import { MockGardenOperationsService } from '../mock/gardens/mockGardenOperationsService';
import { MockGardenRepository } from '../mock/gardens/mockGardenRepository';
import { MockMediaStorageService } from '../mock/media/mockMediaStorageService';
import { MockNotificationService } from '../mock/notifications/mockNotificationService';
import { MockTelemetryService } from '../mock/telemetry/mockTelemetryService';
import { MockUserProfileRepository } from '../mock/users/mockUserProfileRepository';
import type { AppServices } from './services';

export function createMockRuntimeServices({
  environment,
  mobileDeviceService,
  weatherProvider,
}: {
  environment: AppEnvironment;
  mobileDeviceService: MobileDeviceService;
  weatherProvider: WeatherProvider;
}): AppServices {
  return {
    authService: new MockAuthService(),
    environment,
    gardenOperationsService: new MockGardenOperationsService(),
    gardenRepository: new MockGardenRepository(),
    mediaStorageService: new MockMediaStorageService(),
    mobileDeviceService,
    notificationService: new MockNotificationService(),
    telemetryService: new MockTelemetryService(),
    userProfileRepository: new MockUserProfileRepository(),
    weatherProvider,
  };
}
