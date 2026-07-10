import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createEmptyGardenPlan } from '../../data';
import type { PlantingGroup } from '../../domain';
import {
  makePlanting,
  makeStructure,
} from '../../domain/watering/wateringTestFixtures';
import { PlantingInspector, StructureInspector } from './PlanInspectors';

describe('PlantingInspector watering stage', () => {
  it('moves lifecycle-derived stages with lifecycle transitions', async () => {
    const user = userEvent.setup();
    const group = makePlanting('bean-group', 'Bean', {
      lifecycle: 'planted',
      wateringStage: 'establishing',
      wateringStageSource: 'lifecycleFallback',
    });
    const onUpdate = vi.fn();
    renderInspector(group, onUpdate);

    expect(screen.getByText(/stage source: lifecycle fallback/i)).toBeVisible();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Lifecycle' }),
      'growing',
    );

    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lifecycle: 'growing',
        wateringStage: 'mature',
        wateringStageSource: 'lifecycleFallback',
      }),
    );
  });

  it('records manual stage selection and can reset it to lifecycle', async () => {
    const user = userEvent.setup();
    const group = makePlanting('tomato-group', 'Tomato', {
      lifecycle: 'harvestReady',
      wateringStage: 'flowering',
      wateringStageSource: 'plantingEvent',
    });
    const onUpdate = vi.fn();
    const view = renderInspector(group, onUpdate);

    expect(
      screen.getByText(/stage source: recorded planting event/i),
    ).toBeVisible();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Watering stage' }),
      'mature',
    );
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        wateringStage: 'mature',
        wateringStageSource: 'manual',
      }),
    );

    onUpdate.mockClear();
    view.rerender(
      <PlantingInspector
        group={{
          ...group,
          wateringStage: 'mature',
          wateringStageSource: 'manual',
        }}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onUpdate={onUpdate}
        plan={planFor(group)}
      />,
    );
    expect(screen.getByText(/stage source: manual observation/i)).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Reset stage from lifecycle' }),
    );
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        wateringStage: 'fruiting',
        wateringStageSource: 'lifecycleFallback',
      }),
    );
  });

  it('edits planting dates and replaces an invalid stored date', async () => {
    const user = userEvent.setup();
    const group = makePlanting('lettuce-group', 'Lettuce', {
      plantedOn: 'not-a-date',
      plannedFor: null,
    });
    const onUpdate = vi.fn();
    renderInspector(group, onUpdate);

    expect(screen.getByText(/real date in YYYY-MM-DD/i)).toBeVisible();
    await user.type(
      screen.getByLabelText('Planned planting date'),
      '2026-07-12',
    );
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ plannedFor: '2026-07-12' }),
    );

    onUpdate.mockClear();
    fireEvent.change(screen.getByLabelText('Actually planted on'), {
      target: { value: '2026-07-10' },
    });
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ plantedOn: '2026-07-10' }),
    );
  });

  it('edits a labeled individual position only inside the crop-group footprint', async () => {
    const user = userEvent.setup();
    const group = makePlanting('carrot-group', 'Carrot');
    const onUpdate = vi.fn();
    renderInspector(group, onUpdate);

    await user.click(screen.getByText(/edit 1 individual plant position/i));
    const xField = screen.getByLabelText(
      `${group.instances[0]!.label} X in feet`,
    );
    fireEvent.change(xField, { target: { value: '1.5' } });
    expect(onUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        instances: [expect.objectContaining({ xFt: 1.5 })],
      }),
    );

    onUpdate.mockClear();
    fireEvent.change(xField, {
      target: { value: String(planFor(group).plot.widthFt + 1) },
    });
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe('StructureInspector rotation', () => {
  it('accepts rotations from zero through less than 360 degrees', () => {
    const structure = makeStructure({ rotationDegrees: 15 });
    const onUpdate = vi.fn();
    render(
      <StructureInspector
        onDelete={vi.fn()}
        onUpdate={onUpdate}
        plan={planFor(makePlanting('example-group', 'Example crop'))}
        structure={structure}
      />,
    );

    const rotation = screen.getByLabelText('Structure rotation in degrees');
    expect(rotation).toHaveAttribute('min', '0');
    expect(rotation).toHaveAttribute('max', '359.999');

    fireEvent.change(rotation, { target: { value: '127.5' } });
    expect(onUpdate).toHaveBeenLastCalledWith({
      ...structure,
      rotationDegrees: 127.5,
    });

    onUpdate.mockClear();
    fireEvent.change(rotation, { target: { value: '360' } });
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

function renderInspector(
  group: ReturnType<typeof makePlanting>,
  onUpdate: (group: PlantingGroup) => void,
) {
  return render(
    <PlantingInspector
      group={group}
      onDelete={vi.fn()}
      onDuplicate={vi.fn()}
      onUpdate={onUpdate}
      plan={planFor(group)}
    />,
  );
}

function planFor(group: ReturnType<typeof makePlanting>) {
  const plan = createEmptyGardenPlan(new Date('2026-07-09T12:00:00.000Z'));
  plan.plantings = [group];
  plan.structures = [makeStructure()];
  return plan;
}
