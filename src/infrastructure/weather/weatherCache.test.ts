import type {
  OptionalAgricultureMetrics,
  RecentPrecipitation,
  WeatherAlert,
  WeatherCurrentConditions,
  WeatherForecast,
  WeatherLocation,
  WeatherProvider,
  WeatherRequestOptions,
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
      'secret-faede.weather.v3:nationalWeatherService:forecast:42.3314:-83.0458',
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

  it('bypasses cached values on explicit force refresh', async () => {
    const provider = new CountingWeatherProvider();
    const cachedProvider = new CachedWeatherProvider(provider);
    const location = {
      latitude: 42.3314,
      locationName: 'Detroit, MI',
      longitude: -83.0458,
      timezone: 'America/Detroit',
    };

    const firstForecast = await cachedProvider.getForecast(location);
    provider.summary = 'Rain changing to sun';
    const refreshedForecast = await cachedProvider.getForecast(location, {
      forceRefresh: true,
    });

    expect(provider.forecastCalls).toBe(2);
    expect(firstForecast.summary).toBe('Sunny');
    expect(refreshedForecast.summary).toBe('Rain changing to sun');
    expect(provider.lastForecastOptions).toEqual({ forceRefresh: true });
  });

  it('does not return stale cached values when force refresh fails', async () => {
    const provider = new CountingWeatherProvider();
    const cachedProvider = new CachedWeatherProvider(provider);
    const location = {
      latitude: 42.3314,
      locationName: 'Detroit, MI',
      longitude: -83.0458,
      timezone: 'America/Detroit',
    };

    await cachedProvider.getForecast(location);
    provider.failForecast = true;

    await expect(
      cachedProvider.getForecast(location, { forceRefresh: true }),
    ).rejects.toThrow('Forecast unavailable.');
  });
});

class CountingWeatherProvider implements WeatherProvider {
  failForecast = false;
  forecastCalls = 0;
  lastForecastOptions: WeatherRequestOptions | undefined;
  readonly id = 'nationalWeatherService';
  readonly label = 'Counting NWS';
  summary = 'Sunny';

  getCurrentConditions(): Promise<WeatherCurrentConditions> {
    throw new Error('Not implemented in this test.');
  }

  getForecast(
    _location: WeatherLocation,
    options?: WeatherRequestOptions,
  ): Promise<WeatherForecast> {
    this.forecastCalls += 1;
    this.lastForecastOptions = options;

    if (this.failForecast) {
      return Promise.reject(new Error('Forecast unavailable.'));
    }

    return Promise.resolve({
      dailyHighF: 80,
      days: [
        {
          conditionSummary: this.summary,
          date: '2026-06-21',
          expectedRainIn: 0,
          highF: 80,
          precipitationChancePercent: null,
        },
      ],
      generatedAtIso: '2026-06-21T11:00:00.000Z',
      next24hPrecipIn: 0,
      next48hPrecipIn: 0,
      nextRainIso: null,
      overnightLowF: 60,
      periods: [],
      providerId: this.id,
      summary: this.summary,
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
