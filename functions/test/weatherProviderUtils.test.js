'use strict';

const assert = require('node:assert/strict');
const {
  buildForecastDays,
  findNextGridRainIso,
  findNextProbabilityRainIso,
  parseGridValues,
  readPrecipitationQuantityInches,
} = require('../weatherProviderUtils');

assert.equal(
  readPrecipitationQuantityInches(
    {
      precipitationLastHour: {
        unitCode: 'wmoUnit:mm',
        value: 2.54,
      },
    },
    'precipitationLastHour',
  ),
  0.1,
);

assert.equal(
  readPrecipitationQuantityInches(
    {
      precipitationLastHour: {
        unitCode: 'wmoUnit:m',
        value: 0.0254,
      },
    },
    'precipitationLastHour',
  ),
  1,
);

assert.equal(
  readPrecipitationQuantityInches(
    {
      precipitationLastHour: {
        unitCode: 'wmoUnit:in',
        value: 0.5,
      },
    },
    'precipitationLastHour',
  ),
  0.5,
);

assert.equal(
  readPrecipitationQuantityInches(
    {
      precipitationLastHour: {
        unitCode: 'wmoUnit:cm',
        value: 2,
      },
    },
    'precipitationLastHour',
  ),
  null,
);

assert.equal(
  readPrecipitationQuantityInches(
    {
      precipitationLastHour: {
        unitCode: 'wmoUnit:mm',
        value: -1,
      },
    },
    'precipitationLastHour',
  ),
  null,
);

assert.deepEqual(
  buildForecastDays(
    [
      {
        endIso: '2026-04-25T06:00:00-04:00',
        isDaytime: false,
        precipitationChancePercent: 83,
        shortForecast: 'Showers And Thunderstorms then Patchy Fog',
        startIso: '2026-04-24T19:00:00-04:00',
        temperatureF: 51,
      },
      {
        endIso: '2026-04-25T18:00:00-04:00',
        isDaytime: true,
        precipitationChancePercent: 1,
        shortForecast: 'Mostly Cloudy',
        startIso: '2026-04-25T06:00:00-04:00',
        temperatureF: 60,
      },
      {
        endIso: '2026-04-26T06:00:00-04:00',
        isDaytime: false,
        precipitationChancePercent: 3,
        shortForecast: 'Partly Cloudy',
        startIso: '2026-04-25T18:00:00-04:00',
        temperatureF: 40,
      },
    ],
    parseGridValues(
      {
        properties: {
          quantitativePrecipitation: {
            values: [
              {
                validTime: '2026-04-25T03:00:00+00:00/PT4H',
                value: 25.4,
              },
            ],
          },
        },
      },
      'quantitativePrecipitation',
    ),
    'America/Detroit',
  ),
  [
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
  ],
);

assert.deepEqual(
  buildForecastDays(
    [
      {
        endIso: '2026-04-28T18:00:00-04:00',
        isDaytime: true,
        precipitationChancePercent: 78,
        shortForecast: 'Rain Showers Likely',
        startIso: '2026-04-28T06:00:00-04:00',
        temperatureF: 72,
      },
    ],
    [],
    parseGridValues(
      {
        properties: {
          probabilityOfPrecipitation: {
            values: [
              {
                validTime: '2026-04-28T06:00:00+00:00/PT6H',
                value: 78,
              },
            ],
          },
        },
      },
      'probabilityOfPrecipitation',
    ),
    'America/Detroit',
  ),
  [
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
  ],
);

assert.equal(
  findNextGridRainIso(
    parseGridValues(
      {
        properties: {
          quantitativePrecipitation: {
            values: [
              {
                validTime: '2026-04-24T22:00:00+00:00/PT4H',
                value: 2.54,
              },
            ],
          },
        },
      },
      'quantitativePrecipitation',
    ),
    new Date('2026-04-24T23:30:00.000Z'),
  ),
  '2026-04-24T23:30:00.000Z',
);

assert.equal(
  findNextProbabilityRainIso(
    parseGridValues(
      {
        properties: {
          probabilityOfPrecipitation: {
            values: [
              {
                validTime: '2026-04-28T06:00:00+00:00/PT6H',
                value: 78,
              },
            ],
          },
        },
      },
      'probabilityOfPrecipitation',
    ),
    new Date('2026-04-24T23:30:00.000Z'),
  ),
  '2026-04-28T06:00:00.000Z',
);

console.log('weatherProviderUtils tests passed');
