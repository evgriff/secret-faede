import type {
  OptionalAgricultureMetrics,
  PrecipitationObservation,
  RecentPrecipitation,
  WeatherAlert,
  WeatherCurrentConditions,
  WeatherForecast,
  WeatherForecastPeriod,
  WeatherLocation,
  WeatherProvider,
} from '../../domain/weather/WeatherProvider';

const nwsBaseUrl = 'https://api.weather.gov';
const metersToInches = 39.3701;
const millimetersToInches = 0.0393701;
const kilometersPerHourToMph = 0.621371;

interface NwsPointMetadata {
  forecastGridData: string | null;
  forecastHourly: string | null;
  observationStations: string | null;
}

export class NationalWeatherServiceProvider implements WeatherProvider {
  readonly id = 'nationalWeatherService';
  readonly label = 'National Weather Service';

  async getCurrentConditions(
    location: WeatherLocation,
  ): Promise<WeatherCurrentConditions> {
    const stationId = await this.getPrimaryStationId(location);
    const observed = stationId
      ? await requestJson(
          `${nwsBaseUrl}/stations/${stationId}/observations/latest`,
        )
      : null;
    const properties = asRecord(asRecord(observed)?.properties);
    const temperatureC = readQuantity(properties, 'temperature');
    const windKmh = readQuantity(properties, 'windSpeed');

    return {
      capturedAtIso: new Date().toISOString(),
      conditionSummary: readString(properties?.textDescription, 'Observed'),
      feelsLikeF: celsiusToFahrenheit(readQuantity(properties, 'heatIndex')),
      humidityPercent: readQuantity(properties, 'relativeHumidity'),
      observationTimeIso: readStringOrNull(properties?.timestamp),
      precipitationLastHourIn: metersToOptionalInches(
        readQuantity(properties, 'precipitationLastHour'),
      ),
      providerId: this.id,
      sourceLabel: this.label,
      temperatureF: celsiusToFahrenheit(temperatureC),
      windMph:
        windKmh === null ? null : roundTo(windKmh * kilometersPerHourToMph, 1),
    };
  }

  async getForecast(location: WeatherLocation): Promise<WeatherForecast> {
    const point = await this.getPointMetadata(location);
    const hourly = point.forecastHourly
      ? await requestJson(point.forecastHourly)
      : null;
    const grid = point.forecastGridData
      ? await requestJson(point.forecastGridData)
      : null;
    const periods = parseHourlyForecastPeriods(hourly);
    const qpfValues = parseGridValues(grid, 'quantitativePrecipitation');
    const now = new Date();
    const in24h = addHours(now, 24);
    const in48h = addHours(now, 48);
    const next24hPrecipIn = sumGridPrecipitation(qpfValues, now, in24h);
    const next48hPrecipIn = sumGridPrecipitation(qpfValues, now, in48h);
    const nextRainIso =
      findNextGridRainIso(qpfValues, now) ??
      findNextLikelyRainIso(periods, now);

    return {
      dailyHighF: maxTemperature(periods, now, in24h),
      generatedAtIso: now.toISOString(),
      next24hPrecipIn: roundTo(next24hPrecipIn, 2),
      next48hPrecipIn: roundTo(next48hPrecipIn, 2),
      nextRainIso,
      overnightLowF: overnightLow(periods, now),
      periods,
      providerId: this.id,
      summary: periods[0]?.shortForecast ?? 'NWS hourly forecast',
    };
  }

  async getWeatherAlerts(location: WeatherLocation): Promise<WeatherAlert[]> {
    const url = new URL(`${nwsBaseUrl}/alerts/active`);
    url.searchParams.set('point', `${location.latitude},${location.longitude}`);
    const payload = await requestJson(url.toString());
    const features = asArray(asRecord(payload)?.features);

    return features.flatMap((feature): WeatherAlert[] => {
      const properties = asRecord(asRecord(feature)?.properties);

      if (!properties) {
        return [];
      }

      const event = readString(properties.event, 'Weather alert');
      const id =
        readStringOrNull(properties.id) ??
        `${event}-${readString(properties.sent, '')}`;

      return [
        {
          description: readString(properties.description),
          endIso: readStringOrNull(properties.ends),
          event,
          headline: readString(properties.headline, event),
          id,
          instruction: readString(properties.instruction),
          severity: readString(properties.severity, 'Unknown'),
          source: readString(properties.senderName, this.label),
          startIso: readStringOrNull(properties.effective),
          urgency: readString(properties.urgency, 'Unknown'),
        },
      ];
    });
  }

  async getRecentPrecipitation(
    location: WeatherLocation,
    hours: number,
  ): Promise<RecentPrecipitation> {
    const stationId = await this.getPrimaryStationId(location);
    const now = new Date();
    const start = addHours(now, -Math.max(hours, 1));
    const observations = stationId
      ? await this.getStationPrecipitation(stationId, start, now)
      : [];

    return {
      generatedAtIso: now.toISOString(),
      hours,
      last24hIn: roundTo(
        sumObservationsSince(observations, addHours(now, -24)),
        2,
      ),
      last72hIn: roundTo(
        sumObservationsSince(observations, addHours(now, -72)),
        2,
      ),
      observations,
      providerId: this.id,
      totalIn: roundTo(sumObservationPrecipitation(observations), 2),
    };
  }

  async getOptionalAgricultureMetrics(): Promise<OptionalAgricultureMetrics> {
    return {
      evapotranspirationIn: null,
      evapotranspirationNext24hIn: null,
      generatedAtIso: new Date().toISOString(),
      notes: ['NWS does not expose evapotranspiration in this client adapter.'],
      providerId: this.id,
    };
  }

  private async getPrimaryStationId(location: WeatherLocation) {
    const point = await this.getPointMetadata(location);

    if (!point.observationStations) {
      return null;
    }

    const stations = await requestJson(point.observationStations);
    const features = asArray(asRecord(stations)?.features);
    const firstStation = asRecord(asRecord(features[0])?.properties);

    return readStringOrNull(firstStation?.stationIdentifier);
  }

  private async getPointMetadata(
    location: WeatherLocation,
  ): Promise<NwsPointMetadata> {
    const payload = await requestJson(
      `${nwsBaseUrl}/points/${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`,
    );
    const properties = asRecord(asRecord(payload)?.properties);

    return {
      forecastGridData: readStringOrNull(properties?.forecastGridData),
      forecastHourly: readStringOrNull(properties?.forecastHourly),
      observationStations: readStringOrNull(properties?.observationStations),
    };
  }

  private async getStationPrecipitation(
    stationId: string,
    start: Date,
    end: Date,
  ): Promise<PrecipitationObservation[]> {
    const url = new URL(`${nwsBaseUrl}/stations/${stationId}/observations`);
    url.searchParams.set('start', start.toISOString());
    url.searchParams.set('end', end.toISOString());

    const payload = await requestJson(url.toString());
    const features = asArray(asRecord(payload)?.features);

    return features.flatMap((feature): PrecipitationObservation[] => {
      const properties = asRecord(asRecord(feature)?.properties);
      const observedAtIso = readStringOrNull(properties?.timestamp);
      const precipitationIn = metersToOptionalInches(
        readQuantity(properties, 'precipitationLastHour'),
      );

      if (!observedAtIso || precipitationIn === null || precipitationIn <= 0) {
        return [];
      }

      return [
        {
          observedAtIso,
          precipitationIn,
        },
      ];
    });
  }
}

async function requestJson(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/geo+json, application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`NWS request failed (${response.status}) for ${url}.`);
  }

  return response.json() as Promise<unknown>;
}

function parseHourlyForecastPeriods(payload: unknown): WeatherForecastPeriod[] {
  const periods = asArray(asRecord(asRecord(payload)?.properties)?.periods);

  return periods.flatMap((period): WeatherForecastPeriod[] => {
    const record = asRecord(period);
    const startIso = readStringOrNull(record?.startTime);
    const endIso = readStringOrNull(record?.endTime);

    if (!record || !startIso || !endIso) {
      return [];
    }

    return [
      {
        endIso,
        isDaytime:
          typeof record.isDaytime === 'boolean' ? record.isDaytime : null,
        precipitationAmountIn: null,
        precipitationChancePercent:
          readQuantity(record, 'probabilityOfPrecipitation') ??
          readNumberOrNull(record.probabilityOfPrecipitation),
        shortForecast: readString(record.shortForecast, 'Forecast'),
        startIso,
        temperatureF: readNumberOrNull(record.temperature),
      },
    ];
  });
}

function parseGridValues(payload: unknown, propertyName: string) {
  const property = asRecord(
    asRecord(asRecord(payload)?.properties)?.[propertyName],
  );
  const values = asArray(property?.values);

  return values.flatMap(
    (entry): Array<{ end: Date; start: Date; valueIn: number }> => {
      const record = asRecord(entry);
      const validTime = readStringOrNull(record?.validTime);
      const valueMm = readNumberOrNull(record?.value);
      const interval = validTime ? parseValidTime(validTime) : null;

      if (!interval || valueMm === null || valueMm <= 0) {
        return [];
      }

      return [
        {
          end: interval.end,
          start: interval.start,
          valueIn: valueMm * millimetersToInches,
        },
      ];
    },
  );
}

function sumGridPrecipitation(
  values: Array<{ end: Date; start: Date; valueIn: number }>,
  start: Date,
  end: Date,
) {
  return values.reduce((total, value) => {
    if (value.end <= start || value.start >= end) {
      return total;
    }

    return total + value.valueIn;
  }, 0);
}

function findNextGridRainIso(
  values: Array<{ end: Date; start: Date; valueIn: number }>,
  now: Date,
) {
  return (
    values
      .find((value) => value.start >= now && value.valueIn >= 0.01)
      ?.start.toISOString() ?? null
  );
}

function findNextLikelyRainIso(periods: WeatherForecastPeriod[], now: Date) {
  return (
    periods.find((period) => {
      const start = new Date(period.startIso);
      return (
        start >= now &&
        (period.precipitationChancePercent ?? 0) >= 50 &&
        isRainForecast(period.shortForecast)
      );
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

function parseValidTime(value: string) {
  const [startValue, durationValue] = value.split('/');
  const start = startValue ? new Date(startValue) : null;
  const hours = durationValue ? parseDurationHours(durationValue) : null;

  if (!start || Number.isNaN(start.getTime()) || hours === null) {
    return null;
  }

  return {
    end: addHours(start, hours),
    start,
  };
}

function parseDurationHours(value: string) {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?)?$/.exec(value);

  if (!match) {
    return null;
  }

  return Number(match[1] ?? 0) * 24 + Number(match[2] ?? 0);
}

function readQuantity(record: unknown, key: string) {
  const value = asRecord(asRecord(record)?.[key])?.value;
  return readNumberOrNull(value);
}

function readNumberOrNull(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function readStringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function celsiusToFahrenheit(value: number | null) {
  return value === null ? null : roundTo((value * 9) / 5 + 32, 1);
}

function metersToOptionalInches(value: number | null) {
  return value === null ? null : roundTo(value * metersToInches, 2);
}

function sumObservationPrecipitation(observations: PrecipitationObservation[]) {
  return observations.reduce(
    (total, observation) => total + observation.precipitationIn,
    0,
  );
}

function sumObservationsSince(
  observations: PrecipitationObservation[],
  start: Date,
) {
  return sumObservationPrecipitation(
    observations.filter(
      (observation) => new Date(observation.observedAtIso) >= start,
    ),
  );
}

function isRainForecast(value: string) {
  return /rain|shower|storm|drizzle/i.test(value);
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
