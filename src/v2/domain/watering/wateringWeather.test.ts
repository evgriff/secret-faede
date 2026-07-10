import { createInitialWaterBalance } from './wateringModel';
import {
  BASELINE_AT,
  NOW,
  calculate,
  makeForecastWeather,
  makeHistoricalWeather,
  makePlanting,
  makeStructure,
  target,
} from './wateringTestFixtures';

describe('watering weather boundaries', () => {
  it('uses observed weather for accrual and forecast rain only for suppression', () => {
    const tomato = makePlanting('tomato-group', 'Tomato', {
      waterProfile: {
        ...makePlanting('profile-source', 'Tomato').waterProfile,
        baseWeeklyInches: 1.5,
        depletionFraction: 0.45,
        rootDepthInches: 24,
      },
    });
    const result = calculate({
      balances: [
        createInitialWaterBalance({
          asOfIso: BASELINE_AT,
          cropGroupId: tomato.id,
          depletionInches: 1.5,
        }),
      ],
      forecast: makeForecastWeather({
        periods: [
          {
            endIso: '2026-07-10T12:00:00.000Z',
            expectedRainInches: 1,
            id: 'forecast-rain',
            precipitationProbabilityPercent: 100,
            referenceEtInches: 0,
            startIso: NOW,
          },
        ],
      }),
      historical: makeHistoricalWeather({
        observations: [
          {
            endIso: NOW,
            id: 'observed-day-1',
            observedRainInches: 0.2,
            referenceEtInches: 0.1,
            startIso: BASELINE_AT,
          },
        ],
      }),
      targets: [target(tomato, makeStructure(), 'fruiting')],
    });
    const recommendation = result.recommendations[0];

    expect(recommendation?.balance.depletionInches).toBe(1.485);
    expect(recommendation?.status).toBe('suppressed');
    expect(recommendation?.forecastRainCreditInches).toBe(0.9);
    expect(recommendation?.projectedDepletionInches).toBe(0.585);
    expect(recommendation?.reasonCodes).toContain('OBSERVED_RAIN_CREDITED');
    expect(recommendation?.reasonCodes).toContain('FORECAST_RAIN_SUPPRESSION');
  });

  it('exposes the exact overlap, probability, and capture-adjusted forecast rain credit', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const result = calculate({
      balances: [
        createInitialWaterBalance({
          asOfIso: BASELINE_AT,
          cropGroupId: tomato.id,
          depletionInches: 1,
        }),
      ],
      forecast: makeForecastWeather({
        periods: [
          {
            endIso: '2026-07-09T18:00:00.000Z',
            expectedRainInches: 1,
            id: 'partially-elapsed-rain',
            precipitationProbabilityPercent: 50,
            referenceEtInches: 0,
            startIso: '2026-07-09T06:00:00.000Z',
          },
          {
            endIso: '2026-07-11T12:00:00.000Z',
            expectedRainInches: 2,
            id: 'rain-after-near-term-window',
            precipitationProbabilityPercent: 100,
            referenceEtInches: 0,
            startIso: '2026-07-10T12:00:00.000Z',
          },
        ],
      }),
      targets: [target(tomato)],
    });

    expect(result.recommendations[0]?.forecastRainCreditInches).toBe(0.225);
  });

  it.each([
    ['stale', 'FORECAST_WEATHER_STALE'],
    ['insufficient', 'FORECAST_WEATHER_INSUFFICIENT'],
  ] as const)(
    'turns %s forecast data into a low-confidence soil check',
    (quality, reasonCode) => {
      const tomato = makePlanting('tomato-group', 'Tomato');
      const result = calculate({
        balances: [
          createInitialWaterBalance({
            asOfIso: BASELINE_AT,
            cropGroupId: tomato.id,
            depletionInches: 1,
          }),
        ],
        forecast: makeForecastWeather({
          periods:
            quality === 'insufficient' ? [] : makeForecastWeather().periods,
          quality,
        }),
        targets: [target(tomato)],
      });
      const recommendation = result.recommendations[0];

      expect(recommendation?.status).toBe('checkSoil');
      expect(recommendation?.confidence).toBe('low');
      expect(recommendation?.reasonCodes).toContain(reasonCode);
    },
  );

  it.each([
    ['stale', 'HISTORICAL_WEATHER_STALE'],
    ['insufficient', 'HISTORICAL_WEATHER_INSUFFICIENT'],
  ] as const)(
    'turns %s historical weather into a low-confidence soil check',
    (quality, reasonCode) => {
      const tomato = makePlanting('tomato-group', 'Tomato');
      const result = calculate({
        balances: [
          createInitialWaterBalance({
            asOfIso: BASELINE_AT,
            cropGroupId: tomato.id,
          }),
        ],
        historical: makeHistoricalWeather({ quality }),
        targets: [target(tomato)],
      });

      expect(result.recommendations[0]?.status).toBe('checkSoil');
      expect(result.recommendations[0]?.reasonCodes).toContain(reasonCode);
    },
  );

  it('does not treat a missing rain observation as zero rain', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const result = calculate({
      balances: [
        createInitialWaterBalance({
          asOfIso: BASELINE_AT,
          cropGroupId: tomato.id,
        }),
      ],
      historical: makeHistoricalWeather({
        observations: [
          {
            endIso: NOW,
            id: 'missing-rain',
            observedRainInches: null,
            referenceEtInches: 0.1,
            startIso: BASELINE_AT,
          },
        ],
      }),
      targets: [target(tomato)],
    });

    expect(result.recommendations[0]?.dataQuality).toBe('insufficient');
    expect(result.recommendations[0]?.reasonCodes).toContain(
      'MISSING_RAIN_OBSERVATION',
    );
  });

  it('uses forecast ET only to schedule a future threshold crossing', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const result = calculate({
      balances: [
        createInitialWaterBalance({
          asOfIso: BASELINE_AT,
          cropGroupId: tomato.id,
          depletionInches: 0.45,
        }),
      ],
      forecast: makeForecastWeather({
        periods: [
          {
            endIso: '2026-07-10T12:00:00.000Z',
            expectedRainInches: 0,
            id: 'forecast-et',
            precipitationProbabilityPercent: 0,
            referenceEtInches: 0.5,
            startIso: NOW,
          },
        ],
      }),
      historical: makeHistoricalWeather({
        observations: [
          {
            endIso: NOW,
            id: 'observed-day-1',
            observedRainInches: 0,
            referenceEtInches: 0,
            startIso: BASELINE_AT,
          },
        ],
      }),
      targets: [target(tomato)],
    });
    const recommendation = result.recommendations[0];

    expect(recommendation?.balance.depletionInches).toBe(0.45);
    expect(recommendation?.status).toBe('scheduled');
    expect(recommendation?.projectedDepletionInches).toBe(0.85);
    expect(recommendation?.scheduledForIso).toBe('2026-07-10T12:00:00.000Z');
  });

  it('keeps cached weather actionable while lowering confidence', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const result = calculate({
      balances: [
        createInitialWaterBalance({
          asOfIso: BASELINE_AT,
          cropGroupId: tomato.id,
          depletionInches: 1,
        }),
      ],
      forecast: makeForecastWeather({ quality: 'cached' }),
      targets: [target(tomato)],
    });

    expect(result.recommendations[0]?.status).toBe('due');
    expect(result.recommendations[0]?.confidence).toBe('medium');
    expect(result.recommendations[0]?.reasonCodes).toContain(
      'CACHED_WEATHER_USED',
    );
  });
});
