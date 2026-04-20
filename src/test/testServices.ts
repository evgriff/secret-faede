import { MockAuthService } from '../infrastructure/mock/auth/mockAuthService';
import { MockGardenRepository } from '../infrastructure/mock/gardens/mockGardenRepository';
import { MockMediaStorageService } from '../infrastructure/mock/media/mockMediaStorageService';
import { MockNotificationService } from '../infrastructure/mock/notifications/mockNotificationService';
import { MockUserProfileRepository } from '../infrastructure/mock/users/mockUserProfileRepository';
import type { AppServices } from '../infrastructure/runtime/services';
import type { AppEnvironment } from '../shared/config/env';
import type {
  OptionalAgricultureMetrics,
  RecentPrecipitation,
  WeatherAlert,
  WeatherCurrentConditions,
  WeatherForecast,
  WeatherLocation,
  WeatherProvider,
} from '../domain/weather/WeatherProvider';

const testEnvironment: AppEnvironment = {
  allowedEmails: ['primary.gardener@example.com', 'partner.gardener@example.com'],
  allowlistError: null,
  authEmulatorPort: 9099,
  emulatorHost: '127.0.0.1',
  fallbackReason: null,
  firebaseConfig: null,
  firestoreEmulatorPort: 8080,
  geocodingApiKey: null,
  messagingVapidKey: null,
  pwaEnabled: false,
  requestedMode: 'mock',
  runtimeMode: 'mock',
  storageEmulatorPort: 9199,
  tomorrowApiKey: null,
  tomorrowWeatherEnabled: false,
  useFirebaseEmulators: false,
};

export async function createTestServices(options?: {
  allowedEmails?: string[];
  allowlistError?: string | null;
  signedInEmail?: string;
}): Promise<AppServices> {
  const authService = new MockAuthService();
  const environment: AppEnvironment = {
    ...testEnvironment,
    allowedEmails: options?.allowedEmails ?? testEnvironment.allowedEmails,
    allowlistError: options?.allowlistError ?? testEnvironment.allowlistError,
  };

  if (options?.signedInEmail) {
    const result = await authService.requestEmailSignIn(options.signedInEmail);

    if (!result.completionPath) {
      throw new Error('Mock auth did not return a completion path.');
    }

    await authService.completeEmailLinkSignIn({
      url: `http://localhost${result.completionPath}`,
    });
  }

  return {
    authService,
    environment,
    gardenRepository: new MockGardenRepository(),
    mediaStorageService: new MockMediaStorageService(),
    notificationService: new MockNotificationService(),
    userProfileRepository: new MockUserProfileRepository(),
    weatherProvider: new TestWeatherProvider(),
  };
}

class TestWeatherProvider implements WeatherProvider {
  readonly id = 'nationalWeatherService';
  readonly label = 'Test National Weather Service';

  getCurrentConditions(): Promise<WeatherCurrentConditions> {
    return Promise.resolve({
      capturedAtIso: '2026-06-21T11:00:00.000Z',
      conditionSummary: 'Sunny',
      feelsLikeF: 86,
      humidityPercent: 58,
      observationTimeIso: '2026-06-21T10:50:00.000Z',
      precipitationLastHourIn: 0,
      providerId: this.id,
      sourceLabel: this.label,
      temperatureF: 84,
      windMph: 6,
    });
  }

  getForecast(): Promise<WeatherForecast> {
    return Promise.resolve({
      dailyHighF: 88,
      generatedAtIso: '2026-06-21T11:00:00.000Z',
      next24hPrecipIn: 0.05,
      next48hPrecipIn: 0.15,
      nextRainIso: '2026-06-22T20:00:00.000Z',
      overnightLowF: 66,
      periods: [],
      providerId: this.id,
      summary: 'Sunny then slight chance of rain',
    });
  }

  getWeatherAlerts(): Promise<WeatherAlert[]> {
    return Promise.resolve([]);
  }

  getRecentPrecipitation(
    location: WeatherLocation,
    hours: number,
  ): Promise<RecentPrecipitation> {
    void location;

    return Promise.resolve({
      generatedAtIso: '2026-06-21T11:00:00.000Z',
      hours,
      last24hIn: 0,
      last72hIn: 0.1,
      observations: [],
      providerId: this.id,
      totalIn: 0.1,
    });
  }

  getOptionalAgricultureMetrics(): Promise<OptionalAgricultureMetrics> {
    return Promise.resolve({
      evapotranspirationIn: null,
      evapotranspirationNext24hIn: null,
      generatedAtIso: '2026-06-21T11:00:00.000Z',
      notes: [],
      providerId: this.id,
    });
  }
}
