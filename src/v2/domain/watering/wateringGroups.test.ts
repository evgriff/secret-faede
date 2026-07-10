import golden from '../../../../test/fixtures/watering-v2.json';
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

describe('crop-group watering targets', () => {
  it('produces one golden recommendation per crop group in the same bed', () => {
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
    const result = calculate({
      balances: [
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
      forecast: makeForecastWeather({
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
      historical: makeHistoricalWeather({
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
      targets: [
        target(tomato, structure, 'fruiting'),
        target(lettuce, structure, 'mature'),
      ],
    });

    expect(result.recommendations).toHaveLength(2);
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
    expect(result.modelVersion).toBe(golden.modelVersion);
    expect(result.calculationRevision).toBe(golden.calculationRevision);
    expect(result.recommendations[0]?.target).toMatchObject({
      deepLink: '/app/today?focus=watering&cropGroupId=tomato-group',
      kind: 'cropGroup',
      plantingIds: ['tomato-group'],
      structureId: 'shared-bed',
    });
  });

  it('applies root, soil, drainage, and lifecycle factors with provenance', () => {
    const profile = {
      ...makePlanting('profile-source', 'Pepper').waterProfile,
      rootDepthInches: 24,
    };
    const shallow = makePlanting('shallow-group', 'Pepper', {
      waterProfile: profile,
    });
    const deep = makePlanting('deep-group', 'Pepper', {
      waterProfile: profile,
    });
    const result = calculate({
      balances: [
        createInitialWaterBalance({
          asOfIso: BASELINE_AT,
          cropGroupId: shallow.id,
        }),
        createInitialWaterBalance({
          asOfIso: BASELINE_AT,
          cropGroupId: deep.id,
        }),
      ],
      historical: makeHistoricalWeather({
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
      targets: [
        target(
          shallow,
          makeStructure({
            drainage: 'fast',
            soilDepthInches: 6,
            soilType: 'sandy',
          }),
          'establishing',
        ),
        target(deep, makeStructure(), 'mature'),
      ],
    });
    const [shallowResult, deepResult] = result.recommendations;

    expect(shallowResult?.rootZoneCapacityInches).toBe(0.42);
    expect(deepResult?.rootZoneCapacityInches).toBe(3.12);
    expect(shallowResult?.balance.depletionInches).toBeGreaterThan(
      deepResult?.balance.depletionInches ?? Number.POSITIVE_INFINITY,
    );
    expect(shallowResult?.reasonCodes).toContain(
      'ROOT_ZONE_LIMITED_BY_SOIL_DEPTH',
    );
    expect(shallowResult?.basis.cropProfile).toMatchObject({
      rootDepthInches: 24,
      source: 'curated',
      sourceVersion: 'extension-2026.1',
      stage: 'establishing',
      stageCoefficient: 1.2,
      stageSource: 'manual',
    });
  });

  it('keeps container and mulch context explicit', () => {
    const crop = makePlanting('container-group', 'Basil', { mulched: true });
    const container = makeStructure({
      depthFt: 2,
      id: 'shared-bed',
      mulched: true,
      soilDepthInches: 14,
      type: 'container',
      widthFt: 2,
    });
    const result = calculate({
      balances: [
        createInitialWaterBalance({
          asOfIso: BASELINE_AT,
          cropGroupId: crop.id,
        }),
      ],
      targets: [target(crop, container)],
    });
    const recommendation = result.recommendations[0];

    expect(recommendation?.reasonCodes).toContain('CONTAINER_DEMAND_ADJUSTED');
    expect(recommendation?.reasonCodes).toContain('MULCH_DEMAND_ADJUSTED');
    expect(recommendation?.basis.structure).toMatchObject({
      isContainer: true,
      mulched: true,
      soilDepthInches: 14,
    });
  });
});
