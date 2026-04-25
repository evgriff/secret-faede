'use strict';

const {
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
  sumGridPrecip,
  sumObservationPrecipitation,
  sumObservationsSince,
} = require('./weatherProviderUtils');

const nwsBaseUrl = 'https://api.weather.gov';

class NationalWeatherServiceProvider {
  id = 'nationalWeatherService';
  label = 'National Weather Service';

  constructor(logger) {
    this.logger = logger;
  }

  async getCurrentConditions(location) {
    const stationId = await this.getPrimaryStationId(location);
    const observed = stationId
      ? await this.requestJson(
          `${nwsBaseUrl}/stations/${stationId}/observations/latest`,
          minutes(15),
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

  async getForecast(location) {
    const point = await this.getPointMetadata(location);
    const [forecast, hourly, grid] = await Promise.all([
      point.forecast ? this.requestJson(point.forecast, minutes(30)) : null,
      point.forecastHourly
        ? this.requestJson(point.forecastHourly, minutes(30))
        : null,
      point.forecastGridData
        ? this.requestJson(point.forecastGridData, minutes(30))
        : null,
    ]);
    const dailyPeriods = parseHourlyPeriods(forecast);
    const periods = parseHourlyPeriods(hourly);
    const qpfValues = parseGridValues(grid, 'quantitativePrecipitation');
    const now = new Date();
    const in24h = addHours(now, 24);
    const in48h = addHours(now, 48);

    return {
      dailyHighF: maxTemperature(periods, now, in24h),
      days: buildForecastDays(
        dailyPeriods.length ? dailyPeriods : periods,
        qpfValues,
        location.timezone,
      ),
      generatedAtIso: now.toISOString(),
      next24hPrecipIn: roundTo(sumGridPrecip(qpfValues, now, in24h), 2),
      next48hPrecipIn: roundTo(sumGridPrecip(qpfValues, now, in48h), 2),
      nextRainIso:
        findNextGridRainIso(qpfValues, now) || findNextRainIso(periods, now),
      overnightLowF: overnightLow(periods, now),
      periods,
      providerId: this.id,
      summary: periods[0]?.shortForecast || 'NWS hourly forecast',
    };
  }

  async getWeatherAlerts(location) {
    const url = new URL(`${nwsBaseUrl}/alerts/active`);
    url.searchParams.set('point', `${location.latitude},${location.longitude}`);
    const payload = await this.requestJson(url.toString(), minutes(10));

    return asArray(asRecord(payload)?.features).flatMap((feature) => {
      const properties = asRecord(asRecord(feature)?.properties);

      if (!properties) {
        return [];
      }

      const event = readString(properties.event, 'Weather alert');
      return [
        {
          description: readString(properties.description),
          endIso: readStringOrNull(properties.ends),
          event,
          headline: readString(properties.headline, event),
          id:
            readStringOrNull(properties.id) ||
            `${event}-${readString(properties.sent, '')}`,
          instruction: readString(properties.instruction),
          severity: readString(properties.severity, 'Unknown'),
          source: readString(properties.senderName, this.label),
          startIso: readStringOrNull(properties.effective),
          urgency: readString(properties.urgency, 'Unknown'),
        },
      ];
    });
  }

  async getRecentPrecipitation(location, requestedHours) {
    const stationId = await this.getPrimaryStationId(location);
    const now = new Date();
    const start = addHours(now, -Math.max(requestedHours, 1));
    const observations = stationId
      ? await this.getStationPrecipitation(stationId, start, now)
      : [];

    return {
      generatedAtIso: now.toISOString(),
      hours: requestedHours,
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

  getOptionalAgricultureMetrics() {
    return Promise.resolve({
      evapotranspirationIn: null,
      evapotranspirationNext24hIn: null,
      generatedAtIso: new Date().toISOString(),
      notes: ['NWS does not expose evapotranspiration in this adapter.'],
      providerId: this.id,
    });
  }

  async getPrimaryStationId(location) {
    const point = await this.getPointMetadata(location);

    if (!point.observationStations) {
      return null;
    }

    const stations = await this.requestJson(
      point.observationStations,
      hours(12),
    );
    const firstStation = asRecord(
      asRecord(asArray(asRecord(stations)?.features)[0])?.properties,
    );
    return readStringOrNull(firstStation?.stationIdentifier);
  }

  getPointMetadata(location) {
    return this.requestJson(
      `${nwsBaseUrl}/points/${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`,
      hours(12),
    ).then((payload) => {
      const properties = asRecord(asRecord(payload)?.properties);
      return {
        forecast: readStringOrNull(properties?.forecast),
        forecastGridData: readStringOrNull(properties?.forecastGridData),
        forecastHourly: readStringOrNull(properties?.forecastHourly),
        observationStations: readStringOrNull(properties?.observationStations),
      };
    });
  }

  async getStationPrecipitation(stationId, start, end) {
    const url = new URL(`${nwsBaseUrl}/stations/${stationId}/observations`);
    url.searchParams.set('start', start.toISOString());
    url.searchParams.set('end', end.toISOString());
    const payload = await this.requestJson(url.toString(), minutes(60));

    const observations = asArray(asRecord(payload)?.features).flatMap(
      (feature) => {
        const properties = asRecord(asRecord(feature)?.properties);
        const observedAtIso = readStringOrNull(properties?.timestamp);
        const precipitationIn = readPrecipitationQuantityInches(
          properties,
          'precipitationLastHour',
        );

        return observedAtIso && precipitationIn && precipitationIn > 0
          ? [{ observedAtIso, precipitationIn }]
          : [];
      },
    );

    return coalesceHourlyPrecipitationObservations(observations);
  }

  requestJson(url, ttlMs) {
    return cachedJson({
      headers: {
        Accept: 'application/geo+json, application/json',
        'User-Agent':
          process.env.NWS_USER_AGENT || 'SecretFaede/0.1 garden operations',
      },
      logger: this.logger,
      ttlMs,
      url,
    });
  }
}

function coalesceHourlyPrecipitationObservations(observations) {
  const observationsByHour = new Map();

  observations.forEach((observation) => {
    const observedAt = new Date(observation.observedAtIso);

    if (Number.isNaN(observedAt.getTime())) {
      return;
    }

    const hourKey = observedAt.toISOString().slice(0, 13);
    const current = observationsByHour.get(hourKey);

    if (!current || observation.precipitationIn > current.precipitationIn) {
      observationsByHour.set(hourKey, observation);
    }
  });

  return [...observationsByHour.values()];
}

module.exports = {
  NationalWeatherServiceProvider,
};
