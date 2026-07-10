import {
  calculateWateringRecommendations,
  createCropGroupWateringTarget,
  createInitialWaterBalance,
  isWateringActivePlanting,
  resolveLifecycleWateringStage,
  resolvePlantingWateringStage,
} from './wateringModel';
import {
  BASELINE_AT,
  calculate,
  makeForecastWeather,
  makeHistoricalWeather,
  makePlanting,
  makeStructure,
  target,
} from './wateringTestFixtures';

describe('watering safety contracts', () => {
  it('emits gallons only for a reliable crop-group area', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const result = calculate({
      balances: [
        createInitialWaterBalance({
          asOfIso: BASELINE_AT,
          cropGroupId: tomato.id,
          depletionInches: 1,
        }),
      ],
      targets: [target(tomato, makeStructure(), 'mature', 'estimated')],
    });

    expect(result.recommendations[0]?.status).toBe('due');
    expect(result.recommendations[0]?.recommendedDepthInches).not.toBeNull();
    expect(result.recommendations[0]?.recommendedGallons).toBeNull();
    expect(result.recommendations[0]?.reasonCodes).toContain(
      'AREA_UNRELIABLE_NO_GALLONS',
    );
  });

  it('requires a durable baseline before any automatic amount is actionable', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const result = calculate({ targets: [target(tomato)] });

    expect(result.recommendations[0]?.status).toBe('checkSoil');
    expect(result.recommendations[0]?.reasonCodes[0]).toBe(
      'MISSING_BALANCE_BASELINE',
    );
    expect(result.recommendations[0]?.recommendedDepthInches).toBeNull();
  });

  it('rolls the daily recheck into the next local date', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const now = '2026-07-10T03:30:00.000Z';
    const result = calculateWateringRecommendations({
      applications: [],
      checkTimeLocal: '07:00',
      forecastWeather: makeForecastWeather({
        generatedAtIso: now,
        periods: [
          {
            endIso: '2026-07-10T14:00:00.000Z',
            expectedRainInches: 0,
            id: 'forecast-recheck',
            precipitationProbabilityPercent: 0,
            referenceEtInches: 0,
            startIso: now,
          },
        ],
      }),
      gardenId: 'garden-1',
      historicalWeather: makeHistoricalWeather({
        observations: [],
        sourceUpdatedAtIso: now,
      }),
      nowIso: now,
      priorBalances: [
        createInitialWaterBalance({ asOfIso: now, cropGroupId: tomato.id }),
      ],
      targets: [target(tomato)],
      timezone: 'America/Los_Angeles',
    });

    expect(result.recommendations[0]?.recheckAtIso).toBe(
      '2026-07-10T14:00:00.000Z',
    );
  });

  it('rejects non-growing or mismatched structure context', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');

    expect(() =>
      createCropGroupWateringTarget(tomato, {
        areaReliability: 'geometry',
        deepLink: '/app/plan?plantingId=tomato-group',
        structure: makeStructure({ id: 'different-bed' }),
      }),
    ).toThrow('must match');
    expect(() =>
      createCropGroupWateringTarget(tomato, {
        areaReliability: 'geometry',
        deepLink: '/app/plan?plantingId=tomato-group',
        structure: makeStructure({ type: 'path' }),
      }),
    ).toThrow('growing structure');
  });

  it('identifies only active canonical planting groups', () => {
    expect(isWateringActivePlanting(makePlanting('active', 'Bean'))).toBe(true);
    expect(
      isWateringActivePlanting(
        makePlanting('removed', 'Bean', { lifecycle: 'removed' }),
      ),
    ).toBe(false);
  });

  it('makes lifecycle stage fallback deterministic and explicit', () => {
    expect(
      resolveLifecycleWateringStage(
        makePlanting('new', 'Bean', { lifecycle: 'planted' }),
      ),
    ).toEqual({ source: 'lifecycleFallback', stage: 'establishing' });
    expect(
      resolveLifecycleWateringStage(
        makePlanting('ready', 'Bean', { lifecycle: 'harvestReady' }),
      ),
    ).toEqual({ source: 'lifecycleFallback', stage: 'fruiting' });
  });

  it('resolves the saved crop-group stage and rejects dishonest fallback provenance', () => {
    const manual = makePlanting('manual', 'Pepper', {
      wateringStage: 'flowering',
      wateringStageSource: 'manual',
    });
    expect(resolvePlantingWateringStage(manual)).toEqual({
      source: 'manual',
      stage: 'flowering',
    });

    expect(() =>
      resolvePlantingWateringStage(
        makePlanting('invalid-fallback', 'Pepper', {
          wateringStage: 'establishing',
        }),
      ),
    ).toThrow(/does not match/i);
  });
});
