import type {
  OptionalAgricultureMetrics,
  RecentPrecipitation,
  WeatherAlert,
  WeatherCurrentConditions,
  WeatherForecast,
  WeatherProvider,
} from '../../domain/weather/WeatherProvider';
import { CachedWeatherProvider } from './weatherCache';

describe('CachedWeatherProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('caches normalized weather calls by provider and location', async () => {
    const provider = new CountingWeatherProvider();
    const cachedProvider = new CachedWeatherProvider(provider);
    const location = {
      latitude: 42.3314,
      locationName: 'Detroit, MI',
      longitude: -83.0458,
      timezone: 'America/Detroit',
    };

    await cachedProvider.getForecast(location);
    await cachedProvider.getForecast(location);

    expect(provider.forecastCalls).toBe(1);
  });

  it('returns a stale cached value when a refresh fails', async () => {
    const provider = new CountingWeatherProvider();
    const cachedProvider = new CachedWeatherProvider(provider);
    const location = {
      latitude: 42.3314,
      locationName: 'Detroit, MI',
      longitude: -83.0458,
      timezone: 'America/Detroit',
    };

    const firstForecast = await cachedProvider.getForecast(location);
    window.localStorage.setItem(
      'secret-faede.weather.v1:nationalWeatherService:forecast:42.3314:-83.0458',
      JSON.stringify({
        cachedAtMs: Date.now() - 60 * 60 * 1000,
        value: firstForecast,
      }),
    );
    provider.failForecast = true;

    await expect(cachedProvider.getForecast(location)).resolves.toEqual(
      firstForecast,
    );
  });
});

class CountingWeatherProvider implements WeatherProvider {
  failForecast = false;
  forecastCalls = 0;
  readonly id = 'nationalWeatherService';
  readonly label = 'Counting NWS';

  getCurrentConditions(): Promise<WeatherCurrentConditions> {
    throw new Error('Not implemented in this test.');
  }

  getForecast(): Promise<WeatherForecast> {
    this.forecastCalls += 1;

    if (this.failForecast) {
      return Promise.reject(new Error('Forecast unavailable.'));
    }

    return Promise.resolve({
      dailyHighF: 80,
      generatedAtIso: '2026-06-21T11:00:00.000Z',
      next24hPrecipIn: 0,
      next48hPrecipIn: 0,
      nextRainIso: null,
      overnightLowF: 60,
      periods: [],
      providerId: this.id,
      summary: 'Sunny',
    });
  }

  getWeatherAlerts(): Promise<WeatherAlert[]> {
    throw new Error('Not implemented in this test.');
  }

  getRecentPrecipitation(): Promise<RecentPrecipitation> {
    throw new Error('Not implemented in this test.');
  }

  getOptionalAgricultureMetrics(): Promise<OptionalAgricultureMetrics> {
    throw new Error('Not implemented in this test.');
  }
}
