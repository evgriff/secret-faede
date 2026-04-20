import type { WeatherProvider } from '../../domain/weather/WeatherProvider';
import type { AppEnvironment } from '../../shared/config/env';
import { NationalWeatherServiceProvider } from './nwsWeatherProvider';
import { TomorrowIoWeatherProvider } from './tomorrowIoWeatherProvider';
import { CachedWeatherProvider } from './weatherCache';

export function createWeatherProvider(
  environment: AppEnvironment,
): WeatherProvider {
  const nwsProvider = new NationalWeatherServiceProvider();
  const baseProvider =
    environment.tomorrowWeatherEnabled && environment.tomorrowApiKey
      ? new TomorrowIoWeatherProvider(environment.tomorrowApiKey, nwsProvider)
      : nwsProvider;

  return new CachedWeatherProvider(baseProvider);
}
