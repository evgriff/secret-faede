import type { WaterApplication } from './types';
import { createInitialWaterBalance } from './wateringModel';
import {
  BASELINE_AT,
  NOW,
  calculate,
  depthApplication,
  makeHistoricalWeather,
  makePlanting,
  target,
} from './wateringTestFixtures';

describe('durable crop-group water balances', () => {
  it('credits full and partial water while giving skipped work zero credit', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const skipped: WaterApplication = {
      appliedAtIso: '2026-07-09T10:00:00.000Z',
      cropGroupId: tomato.id,
      id: 'skipped-water',
      method: 'hand',
      outcome: 'skipped',
      recordedAtIso: '2026-07-09T10:01:00.000Z',
      recordedByUserId: 'user-1',
      revision: 1,
      skipReason: 'Soil was already damp',
    };
    const result = calculate({
      applications: [
        depthApplication('full-water', 0.5, '2026-07-08T14:00:00.000Z'),
        depthApplication(
          'partial-water',
          0.2,
          '2026-07-08T16:00:00.000Z',
          'partial',
        ),
        skipped,
      ],
      balances: [
        createInitialWaterBalance({
          asOfIso: BASELINE_AT,
          cropGroupId: tomato.id,
          depletionInches: 0.8,
        }),
      ],
      targets: [target(tomato)],
    });
    const recommendation = result.recommendations[0];

    expect(recommendation?.balance.depletionInches).toBe(0.18);
    expect(recommendation?.balance.applicationLedger).toEqual([
      {
        applicationId: 'full-water',
        creditedDepthInches: 0.5,
        outcome: 'applied',
        revision: 1,
      },
      {
        applicationId: 'partial-water',
        creditedDepthInches: 0.2,
        outcome: 'partial',
        revision: 1,
      },
      {
        applicationId: 'skipped-water',
        creditedDepthInches: 0,
        outcome: 'skipped',
        revision: 1,
      },
    ]);
    expect(recommendation?.reasonCodes).toContain(
      'SKIPPED_APPLICATION_ZERO_CREDIT',
    );
  });

  it('drains excess water instead of rolling it into later demand', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const result = calculate({
      applications: [
        depthApplication('excess-water', 5, '2026-07-08T14:00:00.000Z'),
      ],
      balances: [
        createInitialWaterBalance({
          asOfIso: BASELINE_AT,
          cropGroupId: tomato.id,
          depletionInches: 0.2,
        }),
      ],
      targets: [target(tomato)],
    });

    expect(result.recommendations[0]?.balance.depletionInches).toBe(0.08);
    expect(result.recommendations[0]?.reasonCodes).toContain(
      'EXCESS_WATER_DRAINED',
    );
  });

  it('credits a newly recorded backdated application exactly once', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const water = depthApplication(
      'backdated-water',
      0.5,
      '2026-07-07T14:00:00.000Z',
    );
    const firstResult = calculate({
      applications: [water],
      balances: [
        createInitialWaterBalance({
          asOfIso: BASELINE_AT,
          cropGroupId: tomato.id,
          depletionInches: 0.8,
        }),
      ],
      targets: [target(tomato)],
    });
    const first = firstResult.recommendations[0];
    const rerun = calculate({
      applications: [water],
      balances: first ? [first.balance] : [],
      historical: makeHistoricalWeather({ observations: [] }),
      targets: [target(tomato)],
    });

    expect(first?.balance.depletionInches).toBe(0.38);
    expect(first?.reasonCodes).toContain('BACKDATED_APPLICATION_CREDITED');
    expect(rerun.recommendations[0]?.balance.depletionInches).toBe(0.38);
  });

  it('nets same-time application revisions independently of input order', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const newCredit = depthApplication(
      'application-a',
      0.5,
      '2026-07-07T14:00:00.000Z',
    );
    const removedCredit: WaterApplication = {
      appliedAtIso: '2026-07-07T14:00:00.000Z',
      cropGroupId: tomato.id,
      id: 'application-b',
      method: 'hand',
      outcome: 'skipped',
      recordedAtIso: '2026-07-09T11:30:00.000Z',
      recordedByUserId: 'user-1',
      revision: 2,
      skipReason: 'Corrected the earlier entry.',
    };
    const balance = {
      ...createInitialWaterBalance({
        asOfIso: NOW,
        cropGroupId: tomato.id,
        depletionInches: 0.1,
      }),
      applicationLedger: [
        {
          applicationId: removedCredit.id,
          creditedDepthInches: 0.5,
          outcome: 'applied' as const,
          revision: 1,
        },
      ],
    };
    const calculateOrdered = (applications: readonly WaterApplication[]) =>
      calculate({
        applications,
        balances: [balance],
        historical: makeHistoricalWeather({ observations: [] }),
        targets: [target(tomato)],
      });
    const forward = calculateOrdered([newCredit, removedCredit]);
    const reversed = calculateOrdered([removedCredit, newCredit]);

    expect(forward).toEqual(reversed);
    expect(forward.recommendations[0]?.balance.depletionInches).toBe(0.1);
  });

  it('converts reliable gallons to effective depth', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const gallons: WaterApplication = {
      amount: {
        area: { reliability: 'measured', squareFeet: 4 },
        gallons: 1.246,
        unit: 'gallons',
      },
      appliedAtIso: '2026-07-08T14:00:00.000Z',
      cropGroupId: tomato.id,
      efficiency: { confidence: 'high', fraction: 1, source: 'calibrated' },
      id: 'measured-gallons',
      method: 'hand',
      outcome: 'applied',
      recordedAtIso: '2026-07-09T11:00:00.000Z',
      recordedByUserId: 'user-1',
      revision: 1,
    };
    const result = calculate({
      applications: [gallons],
      balances: [
        createInitialWaterBalance({
          asOfIso: BASELINE_AT,
          cropGroupId: tomato.id,
          depletionInches: 0.8,
        }),
      ],
      targets: [target(tomato)],
    });

    expect(result.recommendations[0]?.balance.depletionInches).toBe(0.38);
  });

  it('requires a soil check when an applied amount cannot be quantified', () => {
    const tomato = makePlanting('tomato-group', 'Tomato');
    const unknown: WaterApplication = {
      amount: { unit: 'unknown' },
      appliedAtIso: '2026-07-09T10:00:00.000Z',
      cropGroupId: tomato.id,
      efficiency: { confidence: 'low', fraction: 1, source: 'estimated' },
      id: 'unknown-water',
      method: 'other',
      outcome: 'applied',
      recordedAtIso: '2026-07-09T10:01:00.000Z',
      recordedByUserId: 'user-1',
      revision: 1,
    };
    const result = calculate({
      applications: [unknown],
      balances: [
        createInitialWaterBalance({
          asOfIso: BASELINE_AT,
          cropGroupId: tomato.id,
        }),
      ],
      targets: [target(tomato)],
    });

    expect(result.recommendations[0]?.status).toBe('checkSoil');
    expect(result.recommendations[0]?.reasonCodes).toContain(
      'UNKNOWN_APPLICATION_AMOUNT',
    );
  });
});
