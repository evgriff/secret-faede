import golden from '../../../../test/fixtures/watering-v2.json';
import {
  calculateWateringRecommendations,
  createInitialWaterBalance,
} from './wateringModel';
import {
  BASELINE_AT,
  NOW,
  TIMEZONE,
  depthApplication,
  makeForecastWeather,
  makeHistoricalWeather,
  makePlanting,
  makeStructure,
  target,
} from './wateringTestFixtures';
import type {
  CropGroupWateringTarget,
  WateringCalculationInput,
  WateringCalculationResult,
} from './types';

interface FunctionsWateringModel {
  calculateWateringRecommendations(
    input: WateringCalculationInput,
  ): WateringCalculationResult;
}

const functionsModelPath = '../../../../functions/wateringModelV2.js';
const importedFunctionsModel = (await import(
  /* @vite-ignore */ functionsModelPath
)) as Partial<FunctionsWateringModel> & {
  default?: FunctionsWateringModel;
};
const functionsModel =
  importedFunctionsModel.default ??
  (importedFunctionsModel as FunctionsWateringModel);

function inputFor(
  targets: readonly CropGroupWateringTarget[],
  overrides: Partial<WateringCalculationInput> = {},
): WateringCalculationInput {
  return {
    applications: [],
    checkTimeLocal: '07:00',
    forecastWeather: makeForecastWeather(),
    gardenId: 'garden-1',
    historicalWeather: makeHistoricalWeather(),
    nowIso: NOW,
    priorBalances: targets.map((item) =>
      createInitialWaterBalance({
        asOfIso: BASELINE_AT,
        cropGroupId: item.planting.id,
      }),
    ),
    targets,
    timezone: TIMEZONE,
    ...overrides,
  };
}

function calculateBoth(input: WateringCalculationInput) {
  const client = calculateWateringRecommendations(input);
  const functions = functionsModel.calculateWateringRecommendations(
    structuredClone(input),
  );

  expect(functions).toEqual(client);
  return client;
}

describe('watering model cross-runtime parity', () => {
  it('matches the shared crop-group golden recommendations exactly', () => {
    const structure = makeStructure();
    const tomato = makePlanting('tomato-group', 'Tomato', {
      waterProfile: {
        baseWeeklyInches: 1.5,
        confidence: 'high',
        depletionFraction: 0.45,
        rootDepthInches: 24,
        source: 'curated',
        sourceVersion: 'extension-2026.1',
        stageCoefficients: {
          establishing: 1.2,
          flowering: 1,
          fruiting: 1.1,
          mature: 0.8,
        },
      },
      widthFt: 3,
    });
    const lettuce = makePlanting('lettuce-group', 'Lettuce', {
      waterProfile: {
        baseWeeklyInches: 1,
        confidence: 'high',
        depletionFraction: 0.4,
        rootDepthInches: 8,
        source: 'curated',
        sourceVersion: 'extension-2026.1',
        stageCoefficients: {
          establishing: 1.1,
          flowering: 1,
          fruiting: 1,
          mature: 0.8,
        },
      },
    });
    const targets = [
      target(tomato, structure, 'fruiting'),
      target(lettuce, structure, 'mature'),
    ];
    const result = calculateBoth(
      inputFor(targets, {
        forecastWeather: makeForecastWeather({
          periods: [
            {
              endIso: '2026-07-10T12:00:00.000Z',
              expectedRainInches: 0,
              id: 'forecast-day-1',
              precipitationProbabilityPercent: 100,
              referenceEtInches: 0.2,
              startIso: NOW,
            },
          ],
        }),
        historicalWeather: makeHistoricalWeather({
          observations: [
            {
              endIso: NOW,
              id: 'observed-day-1',
              observedRainInches: 0,
              referenceEtInches: 0.2,
              startIso: BASELINE_AT,
            },
          ],
        }),
        priorBalances: [
          createInitialWaterBalance({
            asOfIso: BASELINE_AT,
            cropGroupId: tomato.id,
            depletionInches: 1.2,
          }),
          createInitialWaterBalance({
            asOfIso: BASELINE_AT,
            cropGroupId: lettuce.id,
            depletionInches: 0.1,
          }),
        ],
      }),
    );

    expect(
      result.recommendations.map((recommendation) => ({
        balanceInches: recommendation.balance.depletionInches,
        cropGroupId: recommendation.target.cropGroupId,
        cropName: recommendation.target.cropName,
        recommendedDepthInches: recommendation.recommendedDepthInches,
        recommendedGallons: recommendation.recommendedGallons,
        rootZoneCapacityInches: recommendation.rootZoneCapacityInches,
        status: recommendation.status,
        triggerInches: recommendation.triggerDepletionInches,
      })),
    ).toEqual(golden.recommendations);
  });

  it('matches adjusted rain credit, cached reasons, and epsilon boundaries', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const cropTarget = target(tomato);
    const result = calculateBoth(
      inputFor([cropTarget], {
        forecastWeather: makeForecastWeather({
          periods: [
            {
              endIso: '2026-07-09T18:00:00.000Z',
              expectedRainInches: 1,
              id: 'partially-elapsed-rain',
              precipitationProbabilityPercent: 50,
              referenceEtInches: null,
              startIso: '2026-07-09T06:00:00.000Z',
            },
          ],
          quality: 'cached',
        }),
        historicalWeather: makeHistoricalWeather({ observations: [] }),
        priorBalances: [
          createInitialWaterBalance({
            asOfIso: NOW,
            cropGroupId: tomato.id,
            depletionInches: 0.779_999_5,
          }),
        ],
      }),
    );
    const recommendation = result.recommendations[0];

    expect(recommendation?.forecastRainCreditInches).toBe(0.225);
    expect(recommendation?.reasonCodes).toContain(
      'BALANCE_AT_OR_ABOVE_TRIGGER',
    );
    expect(recommendation?.reasonCodes).toEqual(
      expect.arrayContaining(['CACHED_WEATHER_USED', 'FORECAST_ET_ESTIMATED']),
    );
  });

  it('matches historical missing-ET estimation and confidence', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const result = calculateBoth(
      inputFor([target(tomato)], {
        historicalWeather: makeHistoricalWeather({
          observations: [
            {
              endIso: NOW,
              id: 'estimated-et',
              observedRainInches: 0,
              referenceEtInches: null,
              startIso: BASELINE_AT,
            },
          ],
        }),
      }),
    );

    expect(result.recommendations[0]?.confidence).toBe('medium');
    expect(result.recommendations[0]?.reasonCodes).toContain(
      'HISTORICAL_ET_ESTIMATED',
    );
  });

  it('matches first-class partial application credit and ledger outcome', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const result = calculateBoth(
      inputFor([target(tomato)], {
        applications: [
          depthApplication(
            'partial-water',
            0.25,
            '2026-07-08T16:00:00.000Z',
            'partial',
          ),
        ],
        priorBalances: [
          createInitialWaterBalance({
            asOfIso: BASELINE_AT,
            cropGroupId: tomato.id,
            depletionInches: 0.8,
          }),
        ],
      }),
    );

    expect(result.recommendations[0]?.balance.applicationLedger).toContainEqual(
      {
        applicationId: 'partial-water',
        creditedDepthInches: 0.25,
        outcome: 'partial',
        revision: 1,
      },
    );
  });
});
