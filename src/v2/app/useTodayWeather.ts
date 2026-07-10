import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  WeatherAlert,
  WeatherCurrentConditions,
  WeatherForecast,
  WeatherLocation,
} from '../../domain/weather/WeatherProvider';
import type { GardenPlan, WaterDataQuality } from '../domain';
import type { TodayWeatherSummary } from '../routes/today';
import { useV2Services } from './V2ServicesContext';

export function useTodayWeather(plan: GardenPlan | null, nowIso: string) {
  const services = useV2Services();
  const [weather, setWeather] = useState<TodayWeatherSummary | null>(null);
  const location = useMemo<WeatherLocation | null>(() => {
    const coordinates = plan?.plot.location.coordinates;
    return coordinates
      ? {
          latitude: coordinates.latitude,
          locationName:
            plan?.plot.location.label || plan?.plot.location.query || '',
          longitude: coordinates.longitude,
          timezone: plan?.plot.location.timezone ?? 'UTC',
        }
      : null;
  }, [plan]);

  const load = useCallback(
    async (forceRefresh = false) => {
      if (!location) {
        setWeather(null);
        return;
      }
      const provider = services.weatherProvider;
      try {
        const [current, forecast, alerts] = await Promise.all([
          provider.getCurrentConditions(location, { forceRefresh }),
          provider.getForecast(location, { forceRefresh }),
          provider.getWeatherAlerts(location, { forceRefresh }),
        ]);
        setWeather(mapWeather(current, forecast, alerts, nowIso));
      } catch (error) {
        if (forceRefresh) throw error;
        setWeather(null);
      }
    },
    [location, nowIso, services.weatherProvider],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  return {
    refresh: () => load(true),
    weather,
  };
}

function mapWeather(
  current: WeatherCurrentConditions,
  forecast: WeatherForecast,
  alerts: WeatherAlert[],
  nowIso: string,
): TodayWeatherSummary {
  const observedAtIso =
    current.observationTimeIso ??
    current.capturedAtIso ??
    forecast.generatedAtIso;
  return {
    alerts: alerts.map((alert) => ({
      deepLink: `/app/today?focus=weather&alertId=${encodeURIComponent(alert.id)}`,
      detail: alert.instruction || alert.description || alert.headline,
      effectiveAtIso: alert.startIso ?? observedAtIso,
      expiresAtIso: alert.endIso,
      id: alert.id,
      severity: mapSeverity(alert.severity),
      title: alert.event || alert.headline,
    })),
    currentTemperatureF: current.temperatureF,
    expectedRainInches: finiteOrNull(forecast.next24hPrecipIn),
    highTemperatureF: forecast.dailyHighF,
    lowTemperatureF: forecast.overnightLowF,
    observedAtIso,
    precipitationProbabilityPercent:
      forecast.days[0]?.precipitationChancePercent ?? null,
    quality: weatherQuality(observedAtIso, nowIso),
    summary: forecast.summary || current.conditionSummary,
  };
}

function weatherQuality(
  observedAtIso: string,
  nowIso: string,
): WaterDataQuality {
  const age = Date.parse(nowIso) - Date.parse(observedAtIso);
  if (!Number.isFinite(age) || age < 0) return 'insufficient';
  if (age <= 3 * 60 * 60 * 1_000) return 'fresh';
  if (age <= 24 * 60 * 60 * 1_000) return 'cached';
  return 'stale';
}

function mapSeverity(value: string): 'advisory' | 'warning' | 'watch' {
  const normalized = value.toLowerCase();
  if (normalized.includes('extreme') || normalized.includes('severe')) {
    return 'warning';
  }
  if (normalized.includes('moderate') || normalized.includes('watch')) {
    return 'watch';
  }
  return 'advisory';
}

function finiteOrNull(value: number) {
  return Number.isFinite(value) ? value : null;
}
