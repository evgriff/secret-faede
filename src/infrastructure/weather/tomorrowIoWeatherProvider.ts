import type {
  OptionalAgricultureMetrics,
  RecentPrecipitation,
  WeatherAlert,
  WeatherCurrentConditions,
  WeatherForecast,
  WeatherForecastPeriod,
  WeatherLocation,
  WeatherProvider,
} from '../../domain/weather/WeatherProvider';

export class TomorrowIoWeatherProvider implements WeatherProvider {
  readonly id = 'tomorrowIo';
  readonly label = 'Tomorrow.io';

  constructor(
    private readonly apiKey: string,
    private readonly fallbackProvider: WeatherProvider,
  ) {}

  async getCurrentConditions(
    location: WeatherLocation,
  ): Promise<WeatherCurrentConditions> {
    const payload = await this.getForecastPayload(location);
    const firstHour = getHourlyTimelines(payload)[0];
    const values = asRecord(firstHour?.values);
    const temperatureF = readNumberOrNull(values?.temperature);

    return {
      capturedAtIso: new Date().toISOString(),
      conditionSummary: formatWeatherCode(values?.weatherCode),
      feelsLikeF: readNumberOrNull(values?.temperatureApparent),
      humidityPercent: readNumberOrNull(values?.humidity),
      observationTimeIso: readStringOrNull(firstHour?.time),
      precipitationLastHourIn: readNumberOrNull(
        values?.precipitationAccumulation,
      ),
      providerId: this.id,
      sourceLabel: this.label,
      temperatureF,
      windMph: readNumberOrNull(values?.windSpeed),
    };
  }

  async getForecast(location: WeatherLocation): Promise<WeatherForecast> {
    const payload = await this.getForecastPayload(location);
    const periods = getHourlyTimelines(payload).flatMap(
      (timeline): WeatherForecastPeriod[] => {
        const startIso = readStringOrNull(timeline.time);
        const values = asRecord(timeline.values);

        if (!startIso || !values) {
          return [];
        }

        return [
          {
            endIso: addHours(new Date(startIso), 1).toISOString(),
            isDaytime: null,
            precipitationAmountIn:
              readNumberOrNull(values.precipitationAccumulation) ??
              readNumberOrNull(values.precipitationIntensity),
            precipitationChancePercent: readNumberOrNull(
              values.precipitationProbability,
            ),
            shortForecast: formatWeatherCode(values.weatherCode),
            startIso,
            temperatureF: readNumberOrNull(values.temperature),
          },
        ];
      },
    );
    const now = new Date();
    const in24h = addHours(now, 24);
    const in48h = addHours(now, 48);

    return {
      dailyHighF: maxTemperature(periods, now, in24h),
      generatedAtIso: now.toISOString(),
      next24hPrecipIn: roundTo(sumForecastPrecip(periods, now, in24h), 2),
      next48hPrecipIn: roundTo(sumForecastPrecip(periods, now, in48h), 2),
      nextRainIso: findNextRainIso(periods, now),
      overnightLowF: overnightLow(periods, now),
      periods,
      providerId: this.id,
      summary: periods[0]?.shortForecast ?? 'Tomorrow.io forecast',
    };
  }

  getWeatherAlerts(location: WeatherLocation): Promise<WeatherAlert[]> {
    return this.fallbackProvider.getWeatherAlerts(location);
  }

  getRecentPrecipitation(
    location: WeatherLocation,
    hours: number,
  ): Promise<RecentPrecipitation> {
    return this.fallbackProvider.getRecentPrecipitation(location, hours);
  }

  async getOptionalAgricultureMetrics(
    location: WeatherLocation,
  ): Promise<OptionalAgricultureMetrics> {
    const payload = await this.getForecastPayload(location);
    const now = new Date();
    const next24h = addHours(now, 24);
    const evapotranspirationValues = getHourlyTimelines(payload).flatMap(
      (timeline): Array<{ time: Date; value: number }> => {
        const timeIso = readStringOrNull(timeline.time);
        const time = timeIso ? new Date(timeIso) : null;
        const values = asRecord(timeline.values);
        const value =
          readNumberOrNull(values?.evapotranspiration) ??
          readNumberOrNull(values?.evapotranspirationSum);

        if (!time || Number.isNaN(time.getTime()) || value === null) {
          return [];
        }

        return [{ time, value }];
      },
    );
    const next24Value = evapotranspirationValues
      .filter((entry) => entry.time >= now && entry.time <= next24h)
      .reduce((total, entry) => total + entry.value, 0);

    return {
      evapotranspirationIn:
        evapotranspirationValues.length > 0 ? roundTo(next24Value, 2) : null,
      evapotranspirationNext24hIn:
        evapotranspirationValues.length > 0 ? roundTo(next24Value, 2) : null,
      generatedAtIso: now.toISOString(),
      notes:
        evapotranspirationValues.length > 0
          ? ['Tomorrow.io evapotranspiration was included.']
          : ['Tomorrow.io response did not include evapotranspiration fields.'],
      providerId: this.id,
    };
  }

  private async getForecastPayload(location: WeatherLocation) {
    const url = new URL('https://api.tomorrow.io/v4/weather/forecast');
    url.searchParams.set(
      'location',
      `${location.latitude},${location.longitude}`,
    );
    url.searchParams.append('timesteps', '1h');
    url.searchParams.append('timesteps', '1d');
    url.searchParams.set('units', 'imperial');
    url.searchParams.set('apikey', this.apiKey);

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Tomorrow.io request failed (${response.status}) for ${url.origin}${url.pathname}.`,
      );
    }

    return response.json() as Promise<unknown>;
  }
}

function getHourlyTimelines(payload: unknown): Array<{
  time?: unknown;
  values?: unknown;
}> {
  const timelines = asRecord(asRecord(payload)?.timelines);
  const hourly = timelines?.hourly;

  return Array.isArray(hourly)
    ? hourly.flatMap((entry): Array<{ time?: unknown; values?: unknown }> => {
        const record = asRecord(entry);
        return record ? [record] : [];
      })
    : [];
}

function sumForecastPrecip(
  periods: WeatherForecastPeriod[],
  start: Date,
  end: Date,
) {
  return periods.reduce((total, period) => {
    const periodStart = new Date(period.startIso);

    if (periodStart < start || periodStart > end) {
      return total;
    }

    return total + (period.precipitationAmountIn ?? 0);
  }, 0);
}

function findNextRainIso(periods: WeatherForecastPeriod[], now: Date) {
  return (
    periods.find((period) => {
      const periodStart = new Date(period.startIso);
      const amount = period.precipitationAmountIn ?? 0;
      const chance = period.precipitationChancePercent ?? 0;

      return periodStart >= now && (amount >= 0.01 || chance >= 50);
    })?.startIso ?? null
  );
}

function maxTemperature(
  periods: WeatherForecastPeriod[],
  start: Date,
  end: Date,
) {
  const values = periods.flatMap((period): number[] => {
    const periodStart = new Date(period.startIso);
    return periodStart >= start &&
      periodStart <= end &&
      period.temperatureF !== null
      ? [period.temperatureF]
      : [];
  });

  return values.length > 0 ? Math.max(...values) : null;
}

function overnightLow(periods: WeatherForecastPeriod[], now: Date) {
  const tomorrowMorning = addHours(now, 18);
  const values = periods.flatMap((period): number[] => {
    const date = new Date(period.startIso);
    const hour = date.getHours();

    return date >= now &&
      date <= tomorrowMorning &&
      (hour >= 18 || hour <= 7) &&
      period.temperatureF !== null
      ? [period.temperatureF]
      : [];
  });

  return values.length > 0 ? Math.min(...values) : null;
}

function formatWeatherCode(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `Weather code ${value}`;
  }

  return 'Forecast';
}

function readNumberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
