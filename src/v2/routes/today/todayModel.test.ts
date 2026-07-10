import type { GardenTask } from '../../domain';
import { createInitialWaterBalance } from '../../domain/watering';
import {
  BASELINE_AT,
  calculate,
  makePlanting,
  target,
} from '../../domain/watering/wateringTestFixtures';
import {
  createWateringLogDraft,
  filterTasksByDateRange,
  recommendationDisplay,
  taskAction,
  validateWateringLogDraft,
  wateringLogInput,
  wateringMethodEfficiency,
} from './todayModel';

describe('Today task ranges', () => {
  const tasks = [
    makeTask('overdue', '2026-07-08'),
    makeTask('today', '2026-07-09'),
    makeTask('three-day-edge', '2026-07-11'),
    makeTask('week-edge', '2026-07-15'),
    makeTask('later', '2026-07-16'),
  ];

  it('uses inclusive garden-date ranges without a fixed calendar column count', () => {
    expect(
      filterTasksByDateRange(tasks, '2026-07-09', 'today').map(
        (task) => task.id,
      ),
    ).toEqual(['overdue', 'today']);
    expect(
      filterTasksByDateRange(tasks, '2026-07-09', 'next3Days').map(
        (task) => task.id,
      ),
    ).toEqual(['overdue', 'today', 'three-day-edge']);
    expect(
      filterTasksByDateRange(tasks, '2026-07-09', 'next7Days').map(
        (task) => task.id,
      ),
    ).toEqual(['overdue', 'today', 'three-day-edge', 'week-edge']);
    expect(filterTasksByDateRange(tasks, '2026-07-09', 'all')).toHaveLength(5);
  });

  it('turns snooze and defer into explicit garden dates', () => {
    expect(taskAction('task-1', 'snooze', '2026-11-01')).toEqual({
      action: 'snooze',
      nextDueOn: '2026-11-02',
      taskId: 'task-1',
    });
    expect(taskAction('task-1', 'defer', '2026-11-01').nextDueOn).toBe(
      '2026-11-08',
    );
    expect(taskAction('task-1', 'complete', '2026-11-01').nextDueOn).toBeNull();
  });
});

describe('Today watering commands', () => {
  const crop = makePlanting('basil-group', 'Basil');

  it('creates a skipped record with no amount and explicit zero credit', () => {
    const recommendation = calculate({ targets: [target(crop)] })
      .recommendations[0];
    expect(recommendation).toBeDefined();
    if (!recommendation) return;

    const draft = {
      ...createWateringLogDraft(recommendation, '2026-07-09'),
      amount: '20',
      outcome: 'skipped' as const,
      skipReason: 'Soil was still moist',
    };

    expect(validateWateringLogDraft(draft)).toEqual({});
    expect(wateringLogInput(recommendation, draft)).toEqual({
      amount: null,
      creditedDepthInches: 0,
      cropGroupId: 'basil-group',
      method: 'drip',
      occurredOn: '2026-07-09',
      outcome: 'skipped',
      recommendationId: recommendation.id,
      skipReason: 'Soil was still moist',
    });
  });

  it('requires a measured amount for applied and partial watering', () => {
    const recommendation = calculate({
      balances: [
        createInitialWaterBalance({
          asOfIso: BASELINE_AT,
          cropGroupId: crop.id,
          depletionInches: 1,
        }),
      ],
      targets: [target(crop)],
    }).recommendations[0];
    expect(recommendation).toBeDefined();
    if (!recommendation) return;

    const draft = {
      ...createWateringLogDraft(recommendation, '2026-07-09'),
      amount: '0',
      outcome: 'partial' as const,
    };
    expect(validateWateringLogDraft(draft)).toEqual({
      amount: 'Enter a measured amount greater than zero.',
    });
    expect(
      wateringLogInput(recommendation, { ...draft, amount: '1.25' }),
    ).toMatchObject({
      amount: { value: 1.25 },
      outcome: 'partial',
      skipReason: null,
    });
    expect(
      validateWateringLogDraft(
        { ...draft, amount: '1', occurredOn: '2026-02-30' },
        '2026-07-09',
      ),
    ).toMatchObject({ occurredOn: expect.stringContaining('Choose the date') });
    expect(
      validateWateringLogDraft(
        { ...draft, amount: '1', occurredOn: '2026-07-10' },
        '2026-07-09',
      ),
    ).toMatchObject({ occurredOn: expect.stringContaining('future') });
  });

  it('credits measured water with a transparent method-specific estimate', () => {
    expect(wateringMethodEfficiency('drip')).toEqual({
      confidence: 'medium',
      fraction: 0.9,
      source: 'estimated',
    });
    expect(wateringMethodEfficiency('sprinkler')).toEqual({
      confidence: 'low',
      fraction: 0.65,
      source: 'estimated',
    });
  });

  it('never presents an exact amount for a check-soil recommendation', () => {
    const recommendation = calculate({ targets: [target(crop)] })
      .recommendations[0];
    expect(recommendation).toBeDefined();
    if (!recommendation) return;
    expect(recommendationDisplay(recommendation).amount).toBeNull();
    expect(recommendationDisplay(recommendation).instruction).toContain(
      'cannot support an exact amount',
    );
  });
});

function makeTask(id: string, dueOn: string): GardenTask {
  return {
    completedAtIso: null,
    createdAtIso: '2026-07-01T12:00:00.000Z',
    dueOn,
    id,
    kind: 'weed',
    notes: '',
    priority: 'medium',
    reason: 'Keep weeds from competing with the crop.',
    sourceId: null,
    status: 'open',
    target: { id: null, kind: 'garden', label: 'Whole garden' },
    title: id,
    updatedAtIso: '2026-07-01T12:00:00.000Z',
  };
}
