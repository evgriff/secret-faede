'use strict';

const {
  addDays,
  formatLocalDate,
  resolveLocalDateTimeIso,
} = require('./operationTime');

function buildWeatherInputs({ context, now, priorBalances, timezone }) {
  const nowIso = now.toISOString();
  const earliestBalanceIso = priorBalances
    .map((balance) => balance.asOfIso)
    .filter((value) => Number.isFinite(Date.parse(value)))
    .sort()[0];
  let historicalQuality = context.historicalQuality;
  let observations = [];

  if (earliestBalanceIso && Date.parse(earliestBalanceIso) < now.getTime()) {
    const ageHours =
      (now.getTime() - Date.parse(earliestBalanceIso)) / (60 * 60 * 1000);
    if (ageHours > 72) historicalQuality = 'insufficient';
    observations = ['fresh', 'cached'].includes(historicalQuality)
      ? buildHistoricalRainPeriods(
          context.recentPrecipitation,
          earliestBalanceIso,
          nowIso,
        )
      : [unknownHistoricalPeriod(earliestBalanceIso, nowIso)];
  }

  const forecastPeriods = buildForecastPeriods(
    context.forecast.days || [],
    now,
    timezone,
    finiteOrNull(context.agricultureMetrics.evapotranspirationNext24hIn),
  );

  return {
    forecastWeather: {
      generatedAtIso: context.forecast.generatedAtIso || null,
      periods: forecastPeriods,
      quality:
        forecastPeriods.length > 0 ? context.forecastQuality : 'insufficient',
      source: context.forecast.providerId,
    },
    historicalWeather: {
      observations,
      quality: historicalQuality,
      source: context.recentPrecipitation.providerId,
      sourceUpdatedAtIso: context.recentPrecipitation.generatedAtIso || null,
    },
  };
}

function createWeatherSnapshot({
  context,
  now,
  plan,
  validationWarnings,
  weatherInputs,
}) {
  const observedForDate = formatLocalDate(now, plan.plot.location.timezone);
  const alerts = context.alerts.slice(0, 10).map((alert) => ({
    endIso: alert.endIso || null,
    event: alert.event || 'Weather alert',
    headline: alert.headline || alert.event || 'Weather alert',
    id: alert.id || `${alert.event || 'alert'}:${observedForDate}`,
    severity: alert.severity || 'Unknown',
    startIso: alert.startIso || null,
    urgency: alert.urgency || 'Unknown',
  }));

  return {
    alerts,
    alertSummaries: alerts.map((alert) => alert.headline).slice(0, 4),
    capturedAtIso: now.toISOString(),
    current: {
      conditionSummary: context.currentConditions.conditionSummary,
      humidityPercent: context.currentConditions.humidityPercent,
      observedAtIso: context.currentConditions.observationTimeIso,
      temperatureF: context.currentConditions.temperatureF,
      windMph: context.currentConditions.windMph,
    },
    forecastWeather: weatherInputs.forecastWeather,
    frostRisk: ['fresh', 'cached'].includes(context.forecastQuality)
      ? frostRisk(context.forecast.overnightLowF)
      : 'none',
    gardenId: plan.id,
    heatRisk: ['fresh', 'cached'].includes(context.forecastQuality)
      ? heatRisk(context.forecast.dailyHighF)
      : 'none',
    historicalWeather: weatherInputs.historicalWeather,
    id: `weather:${now.toISOString()}`,
    observedForDate,
    overnightLowF: finiteOrNull(context.forecast.overnightLowF),
    providerId: context.currentConditions.providerId,
    quality: {
      failedSignals: context.failures,
      forecast: weatherInputs.forecastWeather.quality,
      historical: weatherInputs.historicalWeather.quality,
    },
    severeWeatherSeverity: severeWeatherSeverity(alerts),
    validationWarnings,
  };
}

function buildHistoricalRainPeriods(precipitation, startIso, endIso) {
  if (!Array.isArray(precipitation.observations)) {
    return [unknownHistoricalPeriod(startIso, endIso)];
  }
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  const rainEvents = precipitation.observations
    .flatMap((item) => {
      const eventEndMs = Date.parse(item.observedAtIso);
      const amount = finiteOrNull(item.precipitationIn);
      return amount !== null && amount >= 0 && Number.isFinite(eventEndMs)
        ? [{ amount, eventEndMs }]
        : [];
    })
    .filter((item) => item.eventEndMs > startMs && item.eventEndMs <= endMs)
    .sort((left, right) => left.eventEndMs - right.eventEndMs);
  const periods = [];
  let cursorMs = startMs;

  rainEvents.forEach((event, index) => {
    const rawStartMs = event.eventEndMs - 60 * 60 * 1000;
    const rainStartMs = Math.max(cursorMs, rawStartMs, startMs);
    if (rainStartMs > cursorMs) {
      periods.push(historicalPeriod(cursorMs, rainStartMs, 0, `dry:${index}`));
    }
    if (event.eventEndMs > rainStartMs) {
      const coveredFraction =
        (event.eventEndMs - rainStartMs) / (60 * 60 * 1000);
      periods.push(
        historicalPeriod(
          rainStartMs,
          event.eventEndMs,
          event.amount * coveredFraction,
          `rain:${index}`,
        ),
      );
      cursorMs = event.eventEndMs;
    }
  });
  if (cursorMs < endMs) {
    periods.push(historicalPeriod(cursorMs, endMs, 0, 'dry:tail'));
  }
  return periods;
}

function historicalPeriod(startMs, endMs, observedRainInches, suffix) {
  const startIso = new Date(startMs).toISOString();
  const endIso = new Date(endMs).toISOString();
  return {
    endIso,
    id: `weather-history:${suffix}:${startIso}:${endIso}`,
    observedRainInches,
    referenceEtInches: null,
    startIso,
  };
}

function unknownHistoricalPeriod(startIso, endIso) {
  return {
    endIso,
    id: `weather-history:unknown:${startIso}:${endIso}`,
    observedRainInches: null,
    referenceEtInches: null,
    startIso,
  };
}

function buildForecastPeriods(days, now, timezone, next24EtInches) {
  const nowMs = now.getTime();
  const etWindowEndMs = nowMs + 24 * 60 * 60 * 1000;
  const uniqueDays = new Map();
  days.forEach((day) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(day.date || '')) {
      uniqueDays.set(day.date, day);
    }
  });
  return [...uniqueDays.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([date, day]) => {
      const dayStartIso = resolveLocalDateTimeIso(date, '00:00', timezone);
      const endIso = resolveLocalDateTimeIso(
        addDays(date, 1),
        '00:00',
        timezone,
      );
      const startMs = Math.max(nowMs, Date.parse(dayStartIso));
      const endMs = Date.parse(endIso);
      if (endMs <= startMs) return [];
      const etOverlapMs = Math.max(
        0,
        Math.min(endMs, etWindowEndMs) - Math.max(startMs, nowMs),
      );
      return [
        {
          endIso,
          expectedRainInches: nonNegativeFiniteOrNull(day.expectedRainIn),
          id: `forecast:${date}`,
          precipitationProbabilityPercent: percentageOrNull(
            day.precipitationChancePercent,
          ),
          referenceEtInches:
            next24EtInches === null || etOverlapMs === 0
              ? null
              : next24EtInches * (etOverlapMs / (24 * 60 * 60 * 1000)),
          startIso: new Date(startMs).toISOString(),
        },
      ];
    });
}

function nonNegativeFiniteOrNull(value) {
  const finite = finiteOrNull(value);
  return finite !== null && finite >= 0 ? finite : null;
}

function percentageOrNull(value) {
  const finite = finiteOrNull(value);
  return finite !== null && finite >= 0 && finite <= 100 ? finite : null;
}

function frostRisk(lowF) {
  if (!Number.isFinite(lowF)) return 'none';
  return lowF <= 32 ? 'warning' : lowF <= 36 ? 'watch' : 'none';
}

function heatRisk(highF) {
  if (!Number.isFinite(highF)) return 'none';
  return highF >= 95 ? 'warning' : highF >= 88 ? 'watch' : 'none';
}

function severeWeatherSeverity(alerts) {
  return alerts.some((alert) => /extreme|severe/i.test(alert.severity))
    ? 'warning'
    : alerts.length > 0
      ? 'watch'
      : 'none';
}

function finiteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

module.exports = {
  buildWeatherInputs,
  createWeatherSnapshot,
};
