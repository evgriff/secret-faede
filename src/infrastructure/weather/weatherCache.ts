import type {
  OptionalAgricultureMetrics,
  RecentPrecipitation,
  WeatherAlert,
  WeatherCurrentConditions,
  WeatherForecast,
  WeatherLocation,
  WeatherProvider,
  WeatherProviderId,
} from '../../domain/weather/WeatherProvider';

const cachePrefix = 'secret-faede.weather.v1:';

export class CachedWeatherProvider implements WeatherProvider {
  readonly id: WeatherProviderId;
  readonly label: string;

  constructor(private readonly provider: WeatherProvider) {
    this.id = provider.id;
    this.label = provider.label;
  }

  getCurrentConditions(
    location: WeatherLocation,
  ): Promise<WeatherCurrentConditions> {
    return readThroughCache(
      this.cacheKey('current', location),
      minutes(15),
      () => this.provider.getCurrentConditions(location),
    );
  }

  getForecast(location: WeatherLocation): Promise<WeatherForecast> {
    return readThroughCache(
      this.cacheKey('forecast', location),
      minutes(30),
      () => this.provider.getForecast(location),
    );
  }

  getWeatherAlerts(location: WeatherLocation): Promise<WeatherAlert[]> {
    return readThroughCache(
      this.cacheKey('alerts', location),
      minutes(10),
      () => this.provider.getWeatherAlerts(location),
    );
  }

  getRecentPrecipitation(
    location: WeatherLocation,
    hours: number,
  ): Promise<RecentPrecipitation> {
    return readThroughCache(
      this.cacheKey(`precip-${hours}`, location),
      minutes(60),
      () => this.provider.getRecentPrecipitation(location, hours),
    );
  }

  getOptionalAgricultureMetrics(
    location: WeatherLocation,
  ): Promise<OptionalAgricultureMetrics> {
    return readThroughCache(
      this.cacheKey('agriculture', location),
      minutes(60),
      () => this.provider.getOptionalAgricultureMetrics(location),
    );
  }

  private cacheKey(kind: string, location: WeatherLocation) {
    return [
      this.id,
      kind,
      location.latitude.toFixed(4),
      location.longitude.toFixed(4),
    ].join(':');
  }
}

async function readThroughCache<T>(
  key: string,
  ttlMs: number,
  loadValue: () => Promise<T>,
): Promise<T> {
  const storage = getStorage();
  const storageKey = `${cachePrefix}${key}`;

  const cached = storage ? readCachedValue<T>(storage, storageKey) : null;

  if (cached && Date.now() - cached.cachedAtMs < ttlMs) {
    return cached.value;
  }

  try {
    const value = await loadValue();

    if (storage) {
      writeCachedValue(storage, storageKey, value);
    }

    return value;
  } catch (error) {
    if (cached) {
      console.warn('Using stale cached weather after provider failure.', {
        error,
        key,
      });
      return cached.value;
    }

    throw error;
  }
}

function readCachedValue<T>(
  storage: Storage,
  key: string,
): { cachedAtMs: number; value: T } | null {
  const rawValue = storage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);

    if (
      parsed &&
      typeof parsed === 'object' &&
      'cachedAtMs' in parsed &&
      typeof parsed.cachedAtMs === 'number' &&
      'value' in parsed
    ) {
      return parsed as { cachedAtMs: number; value: T };
    }
  } catch {
    storage.removeItem(key);
  }

  return null;
}

function writeCachedValue<T>(storage: Storage, key: string, value: T) {
  try {
    storage.setItem(
      key,
      JSON.stringify({
        cachedAtMs: Date.now(),
        value,
      }),
    );
  } catch {
    // Browsers can deny storage in private mode. Weather still works without it.
  }
}

function getStorage() {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function minutes(value: number) {
  return value * 60 * 1000;
}
