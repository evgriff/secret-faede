import { createEmptyGardenPlan } from '../../data';
import { makePlanting } from '../../domain/watering/wateringTestFixtures';
import { applyPlantingInspectorUpdate } from './planPageHelpers';

describe('plan page inspector updates', () => {
  it('preserves an individual coordinate edit when the group center is unchanged', () => {
    const plan = createEmptyGardenPlan(new Date('2026-07-09T12:00:00.000Z'));
    const group = makePlanting('carrot-group', 'Carrot');
    plan.plantings = [group];
    const next = structuredClone(group);
    next.instances[0]!.xFt = 1.5;

    const updated = applyPlantingInspectorUpdate(plan, next);

    expect(updated.plantings[0]!.instances[0]!.xFt).toBe(1.5);
    expect(updated.plantings[0]!.xFt).toBe(group.xFt);
  });

  it('moves every individual point by the snapped group-center delta', () => {
    const plan = createEmptyGardenPlan(new Date('2026-07-09T12:00:00.000Z'));
    plan.plot.widthFt = 20;
    plan.plot.depthFt = 20;
    const group = makePlanting('bean-group', 'Bean');
    plan.plantings = [group];

    const updated = applyPlantingInspectorUpdate(plan, {
      ...group,
      xFt: 2,
      yFt: 3,
    });

    expect(updated.plantings[0]).toMatchObject({ xFt: 2, yFt: 3 });
    expect(updated.plantings[0]!.instances[0]).toMatchObject({
      xFt: 2,
      yFt: 3,
    });
  });
});
