'use strict';

const {
  addHours,
  asRecord,
  cachedJson,
  findNextRainIso,
  maxTemperature,
  minutes,
  overnightLow,
  readNumberOrNull,
  readStringOrNull,
  roundTo,
  sumForecastPrecip,
} = require('./weatherProviderUtils');

class TomorrowIoProvider {
  id = 'tomorrowIo';
  label = 'Tomorrow.io';

  constructor(apiKey, fallbackProvider, logger) {
    this.apiKey = apiKey;
    this.fallbackProvider = fallbackProvider;
    this.logger = logger;
  }

  async getCurrentConditions(location) {
    try {
      const payload = await this.getForecastPayload(location);
      const firstHour = getHourlyTimelines(payload)[0];
      const values = asRecord(firstHour?.values);

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
        temperatureF: readNumberOrNull(values?.temperature),
        windMph: readNumberOrNull(values?.windSpeed),
      };
    } catch (error) {
      this.logFallback(error, 'currentConditions');
      return this.fallbackProvider.getCurrentConditions(location);
    }
  }

  async getForecast(location) {
    try {
      const payload = await this.getForecastPayload(location);
      const periods = getHourlyTimelines(payload).flatMap((timeline) => {
        const startIso = readStringOrNull(timeline.time);
        const values = asRecord(timeline.values);
        return startIso && values
          ? [
              {
                endIso: addHours(new Date(startIso), 1).toISOString(),
                isDaytime: null,
                precipitationAmountIn:
                  readNumberOrNull(values.precipitationAccumulation) ||
                  readNumberOrNull(values.precipitationIntensity),
                precipitationChancePercent: readNumberOrNull(
                  values.precipitationProbability,
                ),
                shortForecast: formatWeatherCode(values.weatherCode),
                startIso,
                temperatureF: readNumberOrNull(values.temperature),
              },
            ]
          : [];
      });
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
        summary: periods[0]?.shortForecast || 'Tomorrow.io forecast',
      };
    } catch (error) {
      this.logFallback(error, 'forecast');
      return this.fallbackProvider.getForecast(location);
    }
  }

  getWeatherAlerts(location) {
    return this.fallbackProvider.getWeatherAlerts(location);
  }

  getRecentPrecipitation(location, hoursValue) {
    return this.fallbackProvider.getRecentPrecipitation(location, hoursValue);
  }

  async getOptionalAgricultureMetrics(location) {
    try {
      const payload = await this.getForecastPayload(location);
      const now = new Date();
      const next24h = addHours(now, 24);
      const values = getHourlyTimelines(payload).flatMap((timeline) => {
        const timeIso = readStringOrNull(timeline.time);
        const time = timeIso ? new Date(timeIso) : null;
        const weather = asRecord(timeline.values);
        const value =
          readNumberOrNull(weather?.evapotranspiration) ||
          readNumberOrNull(weather?.evapotranspirationSum);

        return time && !Number.isNaN(time.getTime()) && value !== null
          ? [{ time, value }]
          : [];
      });
      const next24Value = values
        .filter((entry) => entry.time >= now && entry.time <= next24h)
        .reduce((total, entry) => total + entry.value, 0);

      return {
        evapotranspirationIn: values.length ? roundTo(next24Value, 2) : null,
        evapotranspirationNext24hIn: values.length
          ? roundTo(next24Value, 2)
          : null,
        generatedAtIso: now.toISOString(),
        notes: values.length
          ? ['Tomorrow.io evapotranspiration was included.']
          : ['Tomorrow.io response did not include evapotranspiration fields.'],
        providerId: this.id,
      };
    } catch (error) {
      this.logFallback(error, 'agricultureMetrics');
      return this.fallbackProvider.getOptionalAgricultureMetrics(location);
    }
  }

  getForecastPayload(location) {
    const url = new URL('https://api.tomorrow.io/v4/weather/forecast');
    url.searchParams.set(
      'location',
      `${location.latitude},${location.longitude}`,
    );
    url.searchParams.append('timesteps', '1h');
    url.searchParams.append('timesteps', '1d');
    url.searchParams.set('units', 'imperial');
    url.searchParams.set('apikey', this.apiKey);

    return cachedJson({
      headers: { Accept: 'application/json' },
      logger: this.logger,
      ttlMs: minutes(30),
      url: url.toString(),
    });
  }

  logFallback(error, kind) {
    this.logger.warn('Tomorrow.io request failed; falling back to NWS.', {
      error: error instanceof Error ? error.message : String(error),
      kind,
    });
  }
}

function getHourlyTimelines(payload) {
  const timelines = asRecord(asRecord(payload)?.timelines);
  return Array.isArray(timelines?.hourly)
    ? timelines.hourly.flatMap((entry) => {
        const record = asRecord(entry);
        return record ? [record] : [];
      })
    : [];
}

function formatWeatherCode(value) {
  return typeof value === 'number' && Number.isFinite(value)
    ? `Weather code ${value}`
    : 'Forecast';
}

module.exports = {
  TomorrowIoProvider,
};
