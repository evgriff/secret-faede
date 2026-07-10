import { MockAuthService } from '../infrastructure/mock/auth/mockAuthService';
import { MockGardenOperationsService } from '../infrastructure/mock/gardens/mockGardenOperationsService';
import { MockMediaStorageService } from '../infrastructure/mock/media/mockMediaStorageService';
import { MockMobileDeviceService } from '../infrastructure/mock/mobile/mockMobileDeviceService';
import { MockNotificationService } from '../infrastructure/mock/notifications/mockNotificationService';
import { MockTelemetryService } from '../infrastructure/mock/telemetry/mockTelemetryService';
import type { AppEnvironment } from '../shared/config/env';
import type { AuthAccessClaims } from '../domain/auth/types';
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
  allowedEmails: [
    'primary.gardener@example.com',
    'partner.gardener@example.com',
  ],
  allowlistError: null,
  authEmulatorPort: 9099,
  emulatorHost: '127.0.0.1',
  fallbackReason: null,
  firebaseConfig: null,
  firestoreEmulatorPort: 8080,
  functionsEmulatorPort: 5001,
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
  accessClaims?: AuthAccessClaims;
  allowedEmails?: string[];
  allowlistError?: string | null;
  environment?: Partial<AppEnvironment>;
  signedInEmail?: string;
}) {
  const environment: AppEnvironment = {
    ...testEnvironment,
    allowedEmails: options?.allowedEmails ?? testEnvironment.allowedEmails,
    allowlistError: options?.allowlistError ?? testEnvironment.allowlistError,
    ...options?.environment,
  };
  const authService = new MockAuthService(options?.accessClaims);

  if (options?.signedInEmail) {
    await authService.signInWithPassword({
      email: options.signedInEmail,
      password: 'password',
      rememberDevice: true,
    });
  }

  return {
    authService,
    environment,
    gardenOperationsService: new MockGardenOperationsService(),
    mediaStorageService: new MockMediaStorageService(),
    mobileDeviceService: new MockMobileDeviceService(),
    notificationService: new MockNotificationService(),
    telemetryService: new MockTelemetryService(),
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
      days: [
        {
          conditionSummary: 'Sunny then slight chance of rain',
          date: '2026-06-21',
          expectedRainIn: 0.05,
          highF: 88,
          precipitationChancePercent: 20,
        },
        {
          conditionSummary: 'Chance of rain',
          date: '2026-06-22',
          expectedRainIn: 0.1,
          highF: 84,
          precipitationChancePercent: 50,
        },
      ],
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
