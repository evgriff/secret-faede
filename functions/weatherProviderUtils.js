'use strict';

const cache = new Map();
const metersToInches = 39.3701;
const millimetersToInches = 0.0393701;
const kilometersPerHourToMph = 0.621371;

async function cachedJson({ headers, logger, ttlMs, url }) {
  const cacheKey = url.replace(/apikey=[^&]+/i, 'apikey=redacted');
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.cachedAtMs < ttlMs) {
    return cached.value;
  }

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Weather request failed (${response.status}).`);
    }

    const value = await response.json();
    cache.set(cacheKey, { cachedAtMs: Date.now(), value });
    return value;
  } catch (error) {
    if (cached) {
      logger.warn('Using stale cached weather after provider failure.', {
        error: error instanceof Error ? error.message : String(error),
        url: cacheKey,
      });
      return cached.value;
    }

    throw error;
  }
}

function parseHourlyPeriods(payload) {
  return asArray(asRecord(asRecord(payload)?.properties)?.periods).flatMap(
    (period) => {
      const record = asRecord(period);
      const startIso = readStringOrNull(record?.startTime);
      const endIso = readStringOrNull(record?.endTime);

      return record && startIso && endIso
        ? [
            {
              endIso,
              isDaytime:
                typeof record.isDaytime === 'boolean' ? record.isDaytime : null,
              precipitationAmountIn: null,
              precipitationChancePercent:
                readQuantity(record, 'probabilityOfPrecipitation') ||
                readNumberOrNull(record.probabilityOfPrecipitation),
              shortForecast: readString(record.shortForecast, 'Forecast'),
              startIso,
              temperatureF: readNumberOrNull(record.temperature),
            },
          ]
        : [];
    },
  );
}

function parseGridValues(payload, propertyName) {
  return asArray(
    asRecord(asRecord(asRecord(payload)?.properties)?.[propertyName])?.values,
  ).flatMap((entry) => {
    const record = asRecord(entry);
    const validTime = readStringOrNull(record?.validTime);
    const value = readNumberOrNull(record?.value);

    if (!validTime || value === null) {
      return [];
    }

    return [
      {
        end: parseValidTimeEnd(validTime),
        start: parseValidTimeStart(validTime),
        value,
      },
    ];
  });
}

function sumGridPrecip(values, start, end) {
  return values.reduce((total, entry) => {
    const overlapMs = getIntervalOverlapMs(entry.start, entry.end, start, end);
    const durationMs = entry.end.getTime() - entry.start.getTime();

    return overlapMs <= 0 || durationMs <= 0
      ? total
      : total +
          Math.max(entry.value * millimetersToInches, 0) *
            (overlapMs / durationMs);
  }, 0);
}

function findNextGridRainIso(values, now) {
  const next = values.find(
    (entry) => entry.end > now && entry.value * millimetersToInches >= 0.01,
  );

  return next
    ? new Date(Math.max(next.start.getTime(), now.getTime())).toISOString()
    : null;
}

function findNextProbabilityRainIso(values, now) {
  const next = values.find((entry) => entry.end > now && entry.value >= 50);

  return next
    ? new Date(Math.max(next.start.getTime(), now.getTime())).toISOString()
    : null;
}

function sumForecastPrecip(periods, start, end) {
  return periods.reduce((total, period) => {
    const periodStart = new Date(period.startIso);
    return periodStart < start || periodStart > end
      ? total
      : total + (period.precipitationAmountIn || 0);
  }, 0);
}

function findNextRainIso(periods, now) {
  const next = periods.find((period) => {
    const periodStart = new Date(period.startIso);
    const periodEnd = new Date(period.endIso);
    return (
      periodEnd > now &&
      ((period.precipitationAmountIn || 0) >= 0.01 ||
        ((period.precipitationChancePercent || 0) >= 50 &&
          isRainForecast(period.shortForecast)))
    );
  });

  if (!next) {
    return null;
  }

  const start = new Date(next.startIso);
  return new Date(Math.max(start.getTime(), now.getTime())).toISOString();
}

function buildForecastDays(
  periods,
  qpfValues,
  probabilityValuesOrTimezone = [],
  timezoneMaybe,
) {
  const probabilityValues = Array.isArray(probabilityValuesOrTimezone)
    ? probabilityValuesOrTimezone
    : [];
  const timezone =
    typeof probabilityValuesOrTimezone === 'string'
      ? probabilityValuesOrTimezone
      : timezoneMaybe;
  const rainByDate = allocateGridPrecipitationByLocalDate(qpfValues, timezone);
  const probabilityByDate = allocateGridProbabilityByLocalDate(
    probabilityValues,
    timezone,
  );
  const days = new Map();

  periods.forEach((period) => {
    const periodStart = new Date(period.startIso);

    if (Number.isNaN(periodStart.getTime())) {
      return;
    }

    const date = formatLocalDate(periodStart, timezone);
    const current = days.get(date) || {
      firstSummary: null,
      highF: null,
      precipitationChancePercent: null,
      preferredSummary: null,
      rainPeriodEndIso: null,
      rainPeriodStartIso: null,
      rainTextLikely: false,
    };

    current.firstSummary ||= period.shortForecast;
    if (period.isDaytime === true) {
      current.preferredSummary ||= period.shortForecast;
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
      current.rainPeriodStartIso ||= period.startIso;
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
          preferredSummary: null,
          rainPeriodEndIso: null,
          rainPeriodStartIso: null,
          rainTextLikely: false,
        });
      }
    },
  );

  return [...days.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 14)
    .map(([date, day]) => {
      const expectedRainIn = roundTo(rainByDate.get(date) || 0, 2);
      const probabilitySignal = probabilityByDate.get(date);
      const maxChance =
        probabilitySignal?.maxChancePercent ??
        day.precipitationChancePercent ??
        null;
      const rainFromProbability =
        (probabilitySignal?.maxChancePercent || 0) >= 50;
      const rainFromText =
        day.rainTextLikely && (day.precipitationChancePercent || 0) >= 30;
      const hasQuantitativeRain = expectedRainIn >= 0.01;
      const rainLikely =
        hasQuantitativeRain || rainFromProbability || rainFromText;
      const rainSignalSource = hasQuantitativeRain
        ? 'quantitativePrecipitation'
        : rainFromProbability
          ? 'probabilityOfPrecipitation'
          : rainFromText
            ? 'forecastText'
            : null;
      const quantitativeWindow = hasQuantitativeRain
        ? findFirstGridRainWindowIso(qpfValues, date, timezone)
        : null;

      return {
        conditionSummary:
          day.preferredSummary || day.firstSummary || 'NWS forecast',
        date,
        expectedRainIn,
        highF: day.highF,
        precipitationChancePercent: maxChance,
        rainAmountSource: hasQuantitativeRain
          ? 'quantitativePrecipitation'
          : 'none',
        rainLikely,
        rainSignalSource,
        rainSummary: buildRainSignalSummary({
          expectedRainIn,
          maxChance,
          rainLikely,
          rainSignalSource,
        }),
        rainWindowEndIso: hasQuantitativeRain
          ? quantitativeWindow?.endIso
          : probabilitySignal?.endIso || day.rainPeriodEndIso,
        rainWindowStartIso: hasQuantitativeRain
          ? quantitativeWindow?.startIso
          : probabilitySignal?.startIso || day.rainPeriodStartIso,
      };
    });
}

function allocateGridPrecipitationByLocalDate(values, timezone) {
  const totals = new Map();

  values.forEach((entry) => {
    const durationMs = entry.end.getTime() - entry.start.getTime();

    if (durationMs <= 0) {
      return;
    }

    let cursor = entry.start;

    while (cursor < entry.end) {
      const date = formatLocalDate(cursor, timezone);
      const segmentEnd = findNextLocalDateBoundary(cursor, entry.end, timezone);
      const segmentMs = segmentEnd.getTime() - cursor.getTime();
      const segmentRain =
        Math.max(entry.value * millimetersToInches, 0) *
        (segmentMs / durationMs);

      totals.set(date, (totals.get(date) || 0) + segmentRain);
      cursor = segmentEnd;
    }
  });

  return new Map(
    [...totals.entries()].map(([date, total]) => [date, roundTo(total, 2)]),
  );
}

function allocateGridProbabilityByLocalDate(values, timezone) {
  const signals = new Map();

  values.forEach((entry) => {
    if (entry.value < 1 || entry.end <= entry.start) {
      return;
    }

    let cursor = entry.start;

    while (cursor < entry.end) {
      const date = formatLocalDate(cursor, timezone);
      const segmentEnd = findNextLocalDateBoundary(cursor, entry.end, timezone);
      const current = signals.get(date);

      if (!current || entry.value > current.maxChancePercent) {
        signals.set(date, {
          endIso: segmentEnd.toISOString(),
          maxChancePercent: Math.round(Math.min(entry.value, 100)),
          startIso: cursor.toISOString(),
        });
      }

      cursor = segmentEnd;
    }
  });

  return signals;
}

function findFirstGridRainWindowIso(values, date, timezone) {
  const value = values.find(
    (entry) =>
      entry.value * millimetersToInches >= 0.01 &&
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
  rainSignalSource,
}) {
  if (!rainLikely) {
    return null;
  }

  if (rainSignalSource === 'quantitativePrecipitation') {
    return `NWS QPF shows ${expectedRainIn.toFixed(2)} in expected rain.`;
  }

  if (maxChance !== null) {
    return `${maxChance}% rain chance; amount not published by NWS.`;
  }

  return 'Rain mentioned by NWS; amount not published.';
}

function maxTemperature(periods, start, end) {
  const values = periods.flatMap((period) => {
    const periodStart = new Date(period.startIso);
    return periodStart >= start &&
      periodStart <= end &&
      period.temperatureF !== null
      ? [period.temperatureF]
      : [];
  });
  return values.length ? Math.max(...values) : null;
}

function overnightLow(periods, now) {
  const morning = addHours(now, 18);
  const values = periods.flatMap((period) => {
    const date = new Date(period.startIso);
    const hour = date.getHours();
    return date >= now &&
      date <= morning &&
      (hour >= 18 || hour <= 7) &&
      period.temperatureF !== null
      ? [period.temperatureF]
      : [];
  });
  return values.length ? Math.min(...values) : null;
}

function sumObservationsSince(observations, since) {
  return observations.reduce((total, observation) => {
    const observedAt = new Date(observation.observedAtIso);
    return observedAt >= since ? total + observation.precipitationIn : total;
  }, 0);
}

function sumObservationPrecipitation(observations) {
  return observations.reduce(
    (total, observation) => total + observation.precipitationIn,
    0,
  );
}

function parseValidTimeStart(value) {
  return new Date(value.split('/')[0]);
}

function parseValidTimeEnd(value) {
  const [startIso, duration = 'PT1H'] = value.split('/');
  const hoursValue = Number(/PT(\d+)H/.exec(duration)?.[1] || 1);
  return addHours(new Date(startIso), hoursValue);
}

function findNextLocalDateBoundary(start, end, timezone) {
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

function getIntervalOverlapMs(firstStart, firstEnd, secondStart, secondEnd) {
  return Math.max(
    Math.min(firstEnd.getTime(), secondEnd.getTime()) -
      Math.max(firstStart.getTime(), secondStart.getTime()),
    0,
  );
}

function formatLocalDate(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value || '0000';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  const day = parts.find((part) => part.type === 'day')?.value || '01';

  return `${year}-${month}-${day}`;
}

function readQuantity(record, key) {
  const quantity = asRecord(record?.[key]);
  return readNumberOrNull(quantity?.value);
}

function readPrecipitationQuantityInches(record, key) {
  const quantity = asRecord(record?.[key]);
  const value = readNumberOrNull(quantity?.value);
  const unitCode = readStringOrNull(quantity?.unitCode);

  return convertPrecipitationQuantityToInches(value, unitCode);
}

function metersToOptionalInches(value) {
  return value === null ? null : roundTo(value * metersToInches, 2);
}

function convertPrecipitationQuantityToInches(value, unitCode) {
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

function celsiusToFahrenheit(value) {
  return value === null ? null : roundTo((value * 9) / 5 + 32, 1);
}

function readNumberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function readStringOrNull(value) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function isRainForecast(value) {
  return /rain|shower|storm|drizzle/i.test(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : null;
}

function addHours(date, amount) {
  return new Date(date.getTime() + amount * 60 * 60 * 1000);
}

function minutes(value) {
  return value * 60 * 1000;
}

function hours(value) {
  return minutes(value * 60);
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

module.exports = {
  addHours,
  asArray,
  asRecord,
  buildForecastDays,
  cachedJson,
  celsiusToFahrenheit,
  findNextGridRainIso,
  findNextProbabilityRainIso,
  findNextRainIso,
  hours,
  kilometersPerHourToMph,
  maxTemperature,
  metersToOptionalInches,
  minutes,
  overnightLow,
  parseGridValues,
  parseHourlyPeriods,
  readPrecipitationQuantityInches,
  readNumberOrNull,
  readQuantity,
  readString,
  readStringOrNull,
  roundTo,
  sumForecastPrecip,
  sumGridPrecip,
  sumObservationPrecipitation,
  sumObservationsSince,
};
