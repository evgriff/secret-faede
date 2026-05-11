import { afterEach, beforeEach, vi } from 'vitest';

import { NationalWeatherServiceProvider } from './nwsWeatherProvider';

const detroitLocation = {
  latitude: 42.3314,
  locationName: 'Detroit, MI',
  longitude: -83.0458,
  timezone: 'America/Detroit',
};

describe('NationalWeatherServiceProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T23:30:00.000Z'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('converts latest NWS millimeter precipitation quantities to inches', async () => {
    mockNwsFetch({
      latestObservation: {
        precipitationLastHour: {
          unitCode: 'wmoUnit:mm',
          value: 2.54,
        },
      },
    });

    const conditions =
      await new NationalWeatherServiceProvider().getCurrentConditions(
        detroitLocation,
      );

    expect(conditions.precipitationLastHourIn).toBe(0.1);
  });

  it('converts station precipitation by unit and avoids repeated special-observation double counting', async () => {
    mockNwsFetch({
      observations: [
        createObservation('2026-04-24T20:53:00+00:00', 1, 'wmoUnit:mm'),
        createObservation('2026-04-24T20:39:00+00:00', 0.1, 'wmoUnit:mm'),
        createObservation('2026-04-24T14:53:00+00:00', 3.3, 'wmoUnit:mm'),
        createObservation('2026-04-24T14:40:00+00:00', 3, 'wmoUnit:mm'),
        createObservation('2026-04-23T13:00:00+00:00', 0.0254, 'wmoUnit:m'),
        createObservation('2026-04-22T13:00:00+00:00', 0.5, 'wmoUnit:in'),
        createObservation('2026-04-24T12:00:00+00:00', 4, 'wmoUnit:cm'),
        createObservation('2026-04-24T11:00:00+00:00', -1, 'wmoUnit:mm'),
      ],
    });

    const precipitation =
      await new NationalWeatherServiceProvider().getRecentPrecipitation(
        detroitLocation,
        72,
      );

    expect(precipitation.observations).toHaveLength(4);
    expect(precipitation.last24hIn).toBe(0.17);
    expect(precipitation.last72hIn).toBe(1.67);
    expect(precipitation.totalIn).toBe(1.67);
  });

  it('keeps grid QPF millimeter conversion for forecast rain totals', async () => {
    mockNwsFetch({
      gridPrecipitationValues: [
        {
          validTime: '2026-04-25T00:00:00+00:00/PT6H',
          value: 25.4,
        },
        {
          validTime: '2026-04-26T00:00:00+00:00/PT6H',
          value: 2.54,
        },
      ],
    });

    const forecast = await new NationalWeatherServiceProvider().getForecast(
      detroitLocation,
    );

    expect(forecast.next24hPrecipIn).toBe(1);
    expect(forecast.next48hPrecipIn).toBe(1.1);
  });

  it('builds selected-day forecasts from NWS period forecasts and local-day grid QPF', async () => {
    mockNwsFetch({
      forecastPeriods: [
        createForecastPeriod(
          'Tonight',
          '2026-04-24T19:00:00-04:00',
          '2026-04-25T06:00:00-04:00',
          false,
          51,
          83,
          'Showers And Thunderstorms then Patchy Fog',
        ),
        createForecastPeriod(
          'Saturday',
          '2026-04-25T06:00:00-04:00',
          '2026-04-25T18:00:00-04:00',
          true,
          60,
          1,
          'Mostly Cloudy',
        ),
        createForecastPeriod(
          'Saturday Night',
          '2026-04-25T18:00:00-04:00',
          '2026-04-26T06:00:00-04:00',
          false,
          40,
          3,
          'Partly Cloudy',
        ),
        createForecastPeriod(
          'Sunday',
          '2026-04-26T06:00:00-04:00',
          '2026-04-26T18:00:00-04:00',
          true,
          64,
          2,
          'Mostly Sunny',
        ),
      ],
      gridPrecipitationValues: [
        {
          validTime: '2026-04-25T03:00:00+00:00/PT4H',
          value: 25.4,
        },
      ],
    });

    const forecast = await new NationalWeatherServiceProvider().getForecast(
      detroitLocation,
    );

    expect(forecast.days).toEqual([
      {
        conditionSummary: 'Showers And Thunderstorms then Patchy Fog',
        date: '2026-04-24',
        expectedRainIn: 0.25,
        highF: 51,
        precipitationChancePercent: 83,
        rainAmountSource: 'quantitativePrecipitation',
        rainLikely: true,
        rainSignalSource: 'quantitativePrecipitation',
        rainSummary: 'NWS QPF shows 0.25 in expected rain.',
        rainWindowEndIso: '2026-04-25T07:00:00.000Z',
        rainWindowStartIso: '2026-04-25T03:00:00.000Z',
      },
      {
        conditionSummary: 'Mostly Cloudy',
        date: '2026-04-25',
        expectedRainIn: 0.75,
        highF: 60,
        precipitationChancePercent: 3,
        rainAmountSource: 'quantitativePrecipitation',
        rainLikely: true,
        rainSignalSource: 'quantitativePrecipitation',
        rainSummary: 'NWS QPF shows 0.75 in expected rain.',
        rainWindowEndIso: '2026-04-25T07:00:00.000Z',
        rainWindowStartIso: '2026-04-25T03:00:00.000Z',
      },
      {
        conditionSummary: 'Mostly Sunny',
        date: '2026-04-26',
        expectedRainIn: 0,
        highF: 64,
        precipitationChancePercent: 2,
        rainAmountSource: 'none',
        rainLikely: false,
        rainSignalSource: null,
        rainSummary: null,
        rainWindowEndIso: null,
        rainWindowStartIso: null,
      },
    ]);
  });

  it('uses NWS probability grid as qualitative rain when QPF amount is unavailable', async () => {
    mockNwsFetch({
      forecastPeriods: [
        createForecastPeriod(
          'Tuesday',
          '2026-04-28T06:00:00-04:00',
          '2026-04-28T18:00:00-04:00',
          true,
          72,
          78,
          'Rain Showers Likely',
        ),
      ],
      gridProbabilityValues: [
        {
          validTime: '2026-04-28T06:00:00+00:00/PT6H',
          value: 78,
        },
      ],
    });

    const forecast = await new NationalWeatherServiceProvider().getForecast(
      detroitLocation,
    );

    expect(forecast.nextRainIso).toBe('2026-04-28T06:00:00.000Z');
    expect(forecast.days).toEqual([
      {
        conditionSummary: 'Rain Showers Likely',
        date: '2026-04-28',
        expectedRainIn: 0,
        highF: 72,
        precipitationChancePercent: 78,
        rainAmountSource: 'none',
        rainLikely: true,
        rainSignalSource: 'probabilityOfPrecipitation',
        rainSummary: '78% rain chance; amount not published by NWS.',
        rainWindowEndIso: '2026-04-28T12:00:00.000Z',
        rainWindowStartIso: '2026-04-28T06:00:00.000Z',
      },
    ]);
  });

  it('does not return a past next rain time from an ongoing grid interval', async () => {
    mockNwsFetch({
      gridPrecipitationValues: [
        {
          validTime: '2026-04-24T22:00:00+00:00/PT4H',
          value: 2.54,
        },
      ],
    });

    const forecast = await new NationalWeatherServiceProvider().getForecast(
      detroitLocation,
    );

    expect(forecast.nextRainIso).toBe('2026-04-24T23:30:00.000Z');
  });
});

function mockNwsFetch({
  forecastPeriods,
  gridProbabilityValues = [],
  gridPrecipitationValues = [],
  latestObservation = {},
  observations = [],
}: {
  forecastPeriods?: Array<Record<string, unknown>>;
  gridProbabilityValues?: Array<{ validTime: string; value: number }>;
  gridPrecipitationValues?: Array<{ validTime: string; value: number }>;
  latestObservation?: Record<string, unknown>;
  observations?: Array<Record<string, unknown>>;
}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.includes('/points/42.3314,-83.0458')) {
        return jsonResponse({
          properties: {
            forecast: 'https://api.weather.gov/gridpoints/DTX/42,30/forecast',
            forecastGridData: 'https://api.weather.gov/gridpoints/DTX/42,30',
            forecastHourly:
              'https://api.weather.gov/gridpoints/DTX/42,30/forecast/hourly',
            observationStations:
              'https://api.weather.gov/gridpoints/DTX/42,30/stations',
          },
        });
      }

      if (url.endsWith('/gridpoints/DTX/42,30/stations')) {
        return jsonResponse({
          features: [
            {
              properties: {
                stationIdentifier: 'KARB',
              },
            },
          ],
        });
      }

      if (url.endsWith('/stations/KARB/observations/latest')) {
        return jsonResponse({
          properties: {
            heatIndex: { value: null },
            relativeHumidity: { value: 70 },
            temperature: { value: 18 },
            textDescription: 'Light Rain',
            timestamp: '2026-04-24T23:00:00+00:00',
            windSpeed: { value: 6 },
            ...latestObservation,
          },
        });
      }

      if (url.includes('/stations/KARB/observations?')) {
        return jsonResponse({
          features: observations.map((properties) => ({
            properties,
          })),
        });
      }

      if (url.endsWith('/gridpoints/DTX/42,30/forecast')) {
        return jsonResponse({
          properties: {
            periods: forecastPeriods ?? [
              createForecastPeriod(
                'Tonight',
                '2026-04-24T19:00:00-04:00',
                '2026-04-25T06:00:00-04:00',
                false,
                51,
                83,
                'Showers And Thunderstorms',
              ),
              createForecastPeriod(
                'Saturday',
                '2026-04-25T06:00:00-04:00',
                '2026-04-25T18:00:00-04:00',
                true,
                60,
                1,
                'Mostly Cloudy',
              ),
            ],
          },
        });
      }

      if (url.endsWith('/gridpoints/DTX/42,30/forecast/hourly')) {
        return jsonResponse({
          properties: {
            periods: [
              {
                endTime: '2026-04-25T00:00:00+00:00',
                isDaytime: false,
                probabilityOfPrecipitation: { value: 50 },
                shortForecast: 'Rain',
                startTime: '2026-04-24T23:00:00+00:00',
                temperature: 64,
              },
            ],
          },
        });
      }

      if (url.endsWith('/gridpoints/DTX/42,30')) {
        return jsonResponse({
          properties: {
            probabilityOfPrecipitation: {
              values: gridProbabilityValues,
            },
            quantitativePrecipitation: {
              values: gridPrecipitationValues,
            },
          },
        });
      }

      return Promise.resolve(new Response(null, { status: 404 }));
    }),
  );
}

function createObservation(timestamp: string, value: number, unitCode: string) {
  return {
    precipitationLastHour: {
      unitCode,
      value,
    },
    timestamp,
  };
}

function createForecastPeriod(
  name: string,
  startTime: string,
  endTime: string,
  isDaytime: boolean,
  temperature: number,
  precipitationChancePercent: number,
  shortForecast: string,
) {
  return {
    endTime,
    isDaytime,
    name,
    probabilityOfPrecipitation: {
      unitCode: 'wmoUnit:percent',
      value: precipitationChancePercent,
    },
    shortForecast,
    startTime,
    temperature,
  };
}

function jsonResponse(value: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      headers: {
        'Content-Type': 'application/json',
      },
      status: 200,
    }),
  );
}
