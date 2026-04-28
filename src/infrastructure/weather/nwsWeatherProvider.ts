import type {
  OptionalAgricultureMetrics,
  PrecipitationObservation,
  RecentPrecipitation,
  WeatherAlert,
  WeatherCurrentConditions,
  WeatherForecast,
  WeatherForecastDay,
  WeatherForecastPeriod,
  WeatherLocation,
  WeatherProvider,
  WeatherRequestOptions,
} from '../../domain/weather/WeatherProvider';

const nwsBaseUrl = 'https://api.weather.gov';
const metersToInches = 39.3701;
const millimetersToInches = 0.0393701;
const kilometersPerHourToMph = 0.621371;

interface GridPrecipitationValue {
  end: Date;
  start: Date;
  valueIn: number;
}

interface GridProbabilityValue {
  end: Date;
  start: Date;
  valuePercent: number;
}

interface NwsPointMetadata {
  forecast: string | null;
  forecastGridData: string | null;
  forecastHourly: string | null;
  observationStations: string | null;
}

export class NationalWeatherServiceProvider implements WeatherProvider {
  readonly id = 'nationalWeatherService';
  readonly label = 'National Weather Service';

  async getCurrentConditions(
    location: WeatherLocation,
    _options: WeatherRequestOptions = {},
  ): Promise<WeatherCurrentConditions> {
    void _options;
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
      precipitationLastHourIn: readPrecipitationQuantityInches(
        properties,
        'precipitationLastHour',
      ),
      providerId: this.id,
      sourceLabel: this.label,
      temperatureF: celsiusToFahrenheit(temperatureC),
      windMph:
        windKmh === null ? null : roundTo(windKmh * kilometersPerHourToMph, 1),
    };
  }

  async getForecast(
    location: WeatherLocation,
    _options: WeatherRequestOptions = {},
  ): Promise<WeatherForecast> {
    void _options;
    const point = await this.getPointMetadata(location);
    const forecast = point.forecast ? await requestJson(point.forecast) : null;
    const hourly = point.forecastHourly
      ? await requestJson(point.forecastHourly)
      : null;
    const grid = point.forecastGridData
      ? await requestJson(point.forecastGridData)
      : null;
    const dailyPeriods = parseForecastPeriods(forecast);
    const periods = parseHourlyForecastPeriods(hourly);
    const qpfValues = parseGridValues(grid, 'quantitativePrecipitation');
    const probabilityValues = parseGridProbabilityValues(
      grid,
      'probabilityOfPrecipitation',
    );
    const now = new Date();
    const in24h = addHours(now, 24);
    const in48h = addHours(now, 48);
    const next24hPrecipIn = sumGridPrecipitation(qpfValues, now, in24h);
    const next48hPrecipIn = sumGridPrecipitation(qpfValues, now, in48h);
    const days = buildForecastDays(
      dailyPeriods.length > 0 ? dailyPeriods : periods,
      qpfValues,
      probabilityValues,
      location.timezone,
    );
    const nextRainIso =
      findNextGridRainIso(qpfValues, now) ??
      findNextProbabilityRainIso(probabilityValues, now) ??
      findNextLikelyRainIso(periods, now);

    return {
      dailyHighF: maxTemperature(periods, now, in24h),
      days,
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

  async getWeatherAlerts(
    location: WeatherLocation,
    _options: WeatherRequestOptions = {},
  ): Promise<WeatherAlert[]> {
    void _options;
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
    _options: WeatherRequestOptions = {},
  ): Promise<RecentPrecipitation> {
    void _options;
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

  async getOptionalAgricultureMetrics(
    _location: WeatherLocation,
    _options: WeatherRequestOptions = {},
  ): Promise<OptionalAgricultureMetrics> {
    void _options;
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
      forecast: readStringOrNull(properties?.forecast),
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

    const observations = features.flatMap(
      (feature): PrecipitationObservation[] => {
        const properties = asRecord(asRecord(feature)?.properties);
        const observedAtIso = readStringOrNull(properties?.timestamp);
        const precipitationIn = readPrecipitationQuantityInches(
          properties,
          'precipitationLastHour',
        );

        if (
          !observedAtIso ||
          precipitationIn === null ||
          precipitationIn <= 0
        ) {
          return [];
        }

        return [
          {
            observedAtIso,
            precipitationIn,
          },
        ];
      },
    );

    return coalesceHourlyPrecipitationObservations(observations);
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
  return parseForecastPeriods(payload);
}

function parseForecastPeriods(payload: unknown): WeatherForecastPeriod[] {
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

function parseGridValues(
  payload: unknown,
  propertyName: string,
): GridPrecipitationValue[] {
  const property = asRecord(
    asRecord(asRecord(payload)?.properties)?.[propertyName],
  );
  const values = asArray(property?.values);

  return values.flatMap((entry): GridPrecipitationValue[] => {
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
  });
}

function parseGridProbabilityValues(
  payload: unknown,
  propertyName: string,
): GridProbabilityValue[] {
  const property = asRecord(
    asRecord(asRecord(payload)?.properties)?.[propertyName],
  );
  const values = asArray(property?.values);

  return values.flatMap((entry): GridProbabilityValue[] => {
    const record = asRecord(entry);
    const validTime = readStringOrNull(record?.validTime);
    const valuePercent = readNumberOrNull(record?.value);
    const interval = validTime ? parseValidTime(validTime) : null;

    if (!interval || valuePercent === null) {
      return [];
    }

    return [
      {
        end: interval.end,
        start: interval.start,
        valuePercent: Math.max(Math.min(valuePercent, 100), 0),
      },
    ];
  });
}

function sumGridPrecipitation(
  values: GridPrecipitationValue[],
  start: Date,
  end: Date,
) {
  return values.reduce((total, value) => {
    const overlapMs = getIntervalOverlapMs(value.start, value.end, start, end);
    const durationMs = value.end.getTime() - value.start.getTime();

    if (overlapMs <= 0 || durationMs <= 0) {
      return total;
    }

    return total + value.valueIn * (overlapMs / durationMs);
  }, 0);
}

function buildForecastDays(
  periods: WeatherForecastPeriod[],
  qpfValues: GridPrecipitationValue[],
  probabilityValues: GridProbabilityValue[],
  timezone: string,
): WeatherForecastDay[] {
  const rainByDate = allocateGridPrecipitationByLocalDate(qpfValues, timezone);
  const probabilityByDate = allocateGridProbabilityByLocalDate(
    probabilityValues,
    timezone,
  );
  const days = new Map<
    string,
    {
      firstSummary: string | null;
      highF: number | null;
      precipitationChancePercent: number | null;
      rainPeriodEndIso: string | null;
      rainPeriodStartIso: string | null;
      rainTextLikely: boolean;
      preferredSummary: string | null;
    }
  >();

  periods.forEach((period) => {
    const periodStart = new Date(period.startIso);

    if (Number.isNaN(periodStart.getTime())) {
      return;
    }

    const date = formatLocalDate(periodStart, timezone);
    const current = days.get(date) ?? {
      firstSummary: null,
      highF: null,
      precipitationChancePercent: null,
      rainPeriodEndIso: null,
      rainPeriodStartIso: null,
      rainTextLikely: false,
      preferredSummary: null,
    };

    current.firstSummary ??= period.shortForecast;
    if (period.isDaytime === true) {
      current.preferredSummary ??= period.shortForecast;
    }

    if (
      period.temperatureF !== null &&
      (period.isDaytime !== false || current.highF === null)
    ) {
      current.highF =
        current.highF === null
          ? period.temperatureF
          : Math.max(current.highF, period.temperatureF);
    }

    current.precipitationChancePercent =
      current.precipitationChancePercent === null
        ? period.precipitationChancePercent
        : period.precipitationChancePercent === null
          ? current.precipitationChancePercent
          : Math.max(
              current.precipitationChancePercent,
              period.precipitationChancePercent,
            );
    if (isRainForecast(period.shortForecast)) {
      current.rainTextLikely = true;
      current.rainPeriodStartIso ??= period.startIso;
      current.rainPeriodEndIso = period.endIso;
    }
    days.set(date, current);
  });

  new Set([...rainByDate.keys(), ...probabilityByDate.keys()]).forEach(
    (date) => {
      if (!days.has(date)) {
        days.set(date, {
          firstSummary: null,
          highF: null,
          precipitationChancePercent: null,
          rainPeriodEndIso: null,
          rainPeriodStartIso: null,
          rainTextLikely: false,
          preferredSummary: null,
        });
      }
    },
  );

  return [...days.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 14)
    .map(([date, day]) => {
      const expectedRainIn = roundTo(rainByDate.get(date) ?? 0, 2);
      const probabilitySignal = probabilityByDate.get(date);
      const maxChance =
        probabilitySignal?.maxChancePercent ??
        day.precipitationChancePercent ??
        null;
      const rainFromProbability =
        (probabilitySignal?.maxChancePercent ?? 0) >= 50;
      const rainFromText =
        day.rainTextLikely && (day.precipitationChancePercent ?? 0) >= 30;
      const hasQuantitativeRain = expectedRainIn >= 0.01;
      const rainLikely =
        hasQuantitativeRain || rainFromProbability || rainFromText;
      const signalSource: WeatherForecastDay['rainSignalSource'] =
        hasQuantitativeRain
          ? 'quantitativePrecipitation'
          : rainFromProbability
            ? 'probabilityOfPrecipitation'
            : rainFromText
              ? 'forecastText'
              : null;
      const quantitativeWindow = hasQuantitativeRain
        ? findFirstGridRainWindowIso(qpfValues, date, timezone)
        : null;
      const rainWindowStartIso = hasQuantitativeRain
        ? quantitativeWindow?.startIso
        : (probabilitySignal?.startIso ?? day.rainPeriodStartIso);
      const rainWindowEndIso = hasQuantitativeRain
        ? quantitativeWindow?.endIso
        : (probabilitySignal?.endIso ?? day.rainPeriodEndIso);

      return {
        conditionSummary:
          day.preferredSummary ?? day.firstSummary ?? 'NWS forecast',
        date,
        expectedRainIn,
        highF: day.highF,
        precipitationChancePercent: maxChance,
        rainAmountSource: hasQuantitativeRain
          ? ('quantitativePrecipitation' as const)
          : ('none' as const),
        rainLikely,
        rainSignalSource: signalSource,
        rainSummary: buildRainSignalSummary({
          expectedRainIn,
          maxChance,
          rainLikely,
          signalSource,
        }),
        rainWindowEndIso,
        rainWindowStartIso,
      };
    });
}

function allocateGridPrecipitationByLocalDate(
  values: GridPrecipitationValue[],
  timezone: string,
) {
  const totals = new Map<string, number>();

  values.forEach((value) => {
    const durationMs = value.end.getTime() - value.start.getTime();

    if (durationMs <= 0) {
      return;
    }

    let cursor = value.start;

    while (cursor < value.end) {
      const date = formatLocalDate(cursor, timezone);
      const segmentEnd = findNextLocalDateBoundary(cursor, value.end, timezone);
      const segmentMs = segmentEnd.getTime() - cursor.getTime();
      const segmentRain = value.valueIn * (segmentMs / durationMs);

      totals.set(date, (totals.get(date) ?? 0) + segmentRain);
      cursor = segmentEnd;
    }
  });

  return new Map(
    [...totals.entries()].map(([date, total]) => [date, roundTo(total, 2)]),
  );
}

function allocateGridProbabilityByLocalDate(
  values: GridProbabilityValue[],
  timezone: string,
) {
  const signals = new Map<
    string,
    { endIso: string; maxChancePercent: number; startIso: string }
  >();

  values.forEach((value) => {
    if (value.valuePercent < 1 || value.end <= value.start) {
      return;
    }

    let cursor = value.start;

    while (cursor < value.end) {
      const date = formatLocalDate(cursor, timezone);
      const segmentEnd = findNextLocalDateBoundary(cursor, value.end, timezone);
      const current = signals.get(date);

      if (!current || value.valuePercent > current.maxChancePercent) {
        signals.set(date, {
          endIso: segmentEnd.toISOString(),
          maxChancePercent: Math.round(value.valuePercent),
          startIso: cursor.toISOString(),
        });
      }

      cursor = segmentEnd;
    }
  });

  return signals;
}

function findNextGridRainIso(values: GridPrecipitationValue[], now: Date) {
  const next = values.find((value) => value.end > now && value.valueIn >= 0.01);

  return next
    ? new Date(Math.max(next.start.getTime(), now.getTime())).toISOString()
    : null;
}

function findNextProbabilityRainIso(values: GridProbabilityValue[], now: Date) {
  const next = values.find(
    (value) => value.end > now && value.valuePercent >= 50,
  );

  return next
    ? new Date(Math.max(next.start.getTime(), now.getTime())).toISOString()
    : null;
}

function findNextLikelyRainIso(periods: WeatherForecastPeriod[], now: Date) {
  const next = periods.find((period) => {
    const end = new Date(period.endIso);
    return (
      end > now &&
      (period.precipitationChancePercent ?? 0) >= 50 &&
      isRainForecast(period.shortForecast)
    );
  });

  if (!next) {
    return null;
  }

  const start = new Date(next.startIso);
  return new Date(Math.max(start.getTime(), now.getTime())).toISOString();
}

function findFirstGridRainWindowIso(
  values: GridPrecipitationValue[],
  date: string,
  timezone: string,
) {
  const value = values.find(
    (entry) =>
      entry.valueIn >= 0.01 &&
      (formatLocalDate(entry.start, timezone) === date ||
        formatLocalDate(new Date(entry.end.getTime() - 1), timezone) === date),
  );

  return value
    ? { endIso: value.end.toISOString(), startIso: value.start.toISOString() }
    : null;
}

function buildRainSignalSummary({
  expectedRainIn,
  maxChance,
  rainLikely,
  signalSource,
}: {
  expectedRainIn: number;
  maxChance: number | null;
  rainLikely: boolean;
  signalSource:
    | 'forecastText'
    | 'probabilityOfPrecipitation'
    | 'quantitativePrecipitation'
    | null;
}) {
  if (!rainLikely) {
    return null;
  }

  if (signalSource === 'quantitativePrecipitation') {
    return `NWS QPF shows ${expectedRainIn.toFixed(2)} in expected rain.`;
  }

  if (maxChance !== null) {
    return `${maxChance}% rain chance; amount not published by NWS.`;
  }

  return 'Rain mentioned by NWS; amount not published.';
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

function findNextLocalDateBoundary(start: Date, end: Date, timezone: string) {
  const startDate = formatLocalDate(start, timezone);
  let probe = new Date(
    Math.min(end.getTime(), start.getTime() + 60 * 60 * 1000),
  );

  while (probe < end && formatLocalDate(probe, timezone) === startDate) {
    probe = new Date(Math.min(end.getTime(), probe.getTime() + 60 * 60 * 1000));
  }

  if (probe >= end && formatLocalDate(probe, timezone) === startDate) {
    return end;
  }

  let low = start;
  let high = probe;

  while (high.getTime() - low.getTime() > 1000) {
    const middle = new Date((low.getTime() + high.getTime()) / 2);

    if (formatLocalDate(middle, timezone) === startDate) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return high;
}

function getIntervalOverlapMs(
  firstStart: Date,
  firstEnd: Date,
  secondStart: Date,
  secondEnd: Date,
) {
  return Math.max(
    Math.min(firstEnd.getTime(), secondEnd.getTime()) -
      Math.max(firstStart.getTime(), secondStart.getTime()),
    0,
  );
}

function formatLocalDate(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
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

function readPrecipitationQuantityInches(record: unknown, key: string) {
  const quantity = asRecord(asRecord(record)?.[key]);
  const value = readNumberOrNull(quantity?.value);
  const unitCode = readStringOrNull(quantity?.unitCode);

  return convertPrecipitationQuantityToInches(value, unitCode);
}

function convertPrecipitationQuantityToInches(
  value: number | null,
  unitCode: string | null,
) {
  if (value === null || value < 0 || !unitCode) {
    return null;
  }

  const normalizedUnit = unitCode.toLowerCase();

  if (normalizedUnit.endsWith(':mm') || normalizedUnit === 'mm') {
    return roundTo(value * millimetersToInches, 2);
  }

  if (normalizedUnit.endsWith(':m') || normalizedUnit === 'm') {
    return roundTo(value * metersToInches, 2);
  }

  if (
    normalizedUnit.endsWith(':in') ||
    normalizedUnit === 'in' ||
    normalizedUnit.includes('inch')
  ) {
    return roundTo(value, 2);
  }

  return null;
}

function coalesceHourlyPrecipitationObservations(
  observations: PrecipitationObservation[],
) {
  const observationsByHour = new Map<string, PrecipitationObservation>();

  for (const observation of observations) {
    const observedAt = new Date(observation.observedAtIso);

    if (Number.isNaN(observedAt.getTime())) {
      continue;
    }

    const hourKey = observedAt.toISOString().slice(0, 13);
    const current = observationsByHour.get(hourKey);

    if (!current || observation.precipitationIn > current.precipitationIn) {
      observationsByHour.set(hourKey, observation);
    }
  }

  return [...observationsByHour.values()];
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
