import { render, screen, within } from '@testing-library/react';

import { createEmptyGardenPlan } from '../../data';
import { makeStructure } from '../../domain/watering/wateringTestFixtures';
import { PlotCanvas } from './PlotCanvas';

describe('PlotCanvas orientation', () => {
  it('renders saved structure rotation and the plot north orientation', () => {
    const plan = createEmptyGardenPlan(new Date('2026-07-09T12:00:00.000Z'));
    plan.plot.northDegrees = 92.5;
    plan.structures = [
      makeStructure({
        id: 'rotated-bed',
        label: 'Diagonal bed',
        rotationDegrees: 37,
      }),
    ];

    render(
      <PlotCanvas
        onMove={vi.fn()}
        onSelect={vi.fn()}
        plan={plan}
        selectedId="rotated-bed"
        showGrid
      />,
    );

    const structure = screen.getByRole('button', {
      name: /diagonal bed.*rotated 37 degrees clockwise/i,
    });
    expect(structure).toHaveStyle({ transform: 'rotate(37deg)' });
    expect(structure).toHaveAttribute('aria-pressed', 'true');

    const north = screen.getByRole('img', {
      name: /north points 92.5 degrees clockwise from the top/i,
    });
    expect(within(north).getByText('↑')).toHaveStyle({
      transform: 'rotate(92.5deg)',
    });
    expect(within(north).getByText('N · 92.5°')).toBeVisible();
  });
});
