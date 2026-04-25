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
  return (
    values
      .find((entry) => entry.start >= now && entry.value > 0)
      ?.start.toISOString() || null
  );
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
  return (
    periods.find((period) => {
      const periodStart = new Date(period.startIso);
      return (
        periodStart >= now &&
        ((period.precipitationAmountIn || 0) >= 0.01 ||
          (period.precipitationChancePercent || 0) >= 50)
      );
    })?.startIso || null
  );
}

function buildForecastDays(periods, qpfValues, timezone) {
  const rainByDate = allocateGridPrecipitationByLocalDate(qpfValues, timezone);
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
    days.set(date, current);
  });

  rainByDate.forEach((_rain, date) => {
    if (!days.has(date)) {
      days.set(date, {
        firstSummary: null,
        highF: null,
        precipitationChancePercent: null,
        preferredSummary: null,
      });
    }
  });

  return [...days.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 14)
    .map(([date, day]) => ({
      conditionSummary:
        day.preferredSummary || day.firstSummary || 'NWS forecast',
      date,
      expectedRainIn: roundTo(rainByDate.get(date) || 0, 2),
      highF: day.highF,
      precipitationChancePercent: day.precipitationChancePercent,
    }));
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
