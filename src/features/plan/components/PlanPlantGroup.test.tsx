import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { createDefaultPlanting } from '../../../domain/gardens/GardenRepository';
import { PlanPlantGroup } from './PlanPlantGroup';

describe('PlanPlantGroup', () => {
  it('renders compact accessible support badges for plant-level supports', () => {
    render(
      <PlanPlantGroup
        index={0}
        isCropFocused={false}
        isDragging={false}
        isFocusDimmed={false}
        isHoverLabelVisible={false}
        isLabelVisible={false}
        isResizing={false}
        isSelected
        onHideLabel={vi.fn()}
        onOpenEditor={vi.fn()}
        onPlantHoverChange={vi.fn()}
        onPlantPointerDown={vi.fn()}
        onPlantPointerEnd={vi.fn()}
        onPlantPointerMove={vi.fn()}
        onPlantResizePointerDown={vi.fn()}
        onResizePointerEnd={vi.fn()}
        onResizePointerMove={vi.fn()}
        onSelectItem={vi.fn()}
        plant={{
          ...createDefaultPlanting({
            id: 'tomato-1',
            label: 'Tomato',
            xFt: 4,
            yFt: 4,
          }),
          cropId: 'tomato',
        }}
        previewOffset={null}
        previewRect={null}
        structures={[]}
        warnings={[]}
      />,
    );

    expect(screen.getByLabelText('cage support missing')).toBeInTheDocument();
    expect(screen.getByLabelText('cage support missing')).toContainElement(
      document.querySelector('[data-support-icon="cage"]'),
    );
  });

  it('uses pinned clicks for short plant name pills only', () => {
    render(
      <PlanPlantGroup
        index={0}
        isCropFocused={false}
        isDragging={false}
        isFocusDimmed={false}
        isHoverLabelVisible={false}
        isLabelVisible
        isResizing={false}
        isSelected
        onHideLabel={vi.fn()}
        onOpenEditor={vi.fn()}
        onPlantHoverChange={vi.fn()}
        onPlantPointerDown={vi.fn()}
        onPlantPointerEnd={vi.fn()}
        onPlantPointerMove={vi.fn()}
        onPlantResizePointerDown={vi.fn()}
        onResizePointerEnd={vi.fn()}
        onResizePointerMove={vi.fn()}
        onSelectItem={vi.fn()}
        plant={{
          ...createDefaultPlanting({
            id: 'snap-peas-1',
            label: 'Snap peas',
            xFt: 4,
            yFt: 4,
          }),
          blockDepthFt: 2,
          blockWidthFt: 2,
          instances: [
            { id: 'snap-peas-1-plant-1', label: 'Snap peas 1', xFt: 3, yFt: 3 },
            { id: 'snap-peas-1-plant-2', label: 'Snap peas 2', xFt: 5, yFt: 3 },
            { id: 'snap-peas-1-plant-3', label: 'Snap peas 3', xFt: 3, yFt: 5 },
            { id: 'snap-peas-1-plant-4', label: 'Snap peas 4', xFt: 5, yFt: 5 },
          ],
          mode: 'block',
          plantCount: 4,
        }}
        previewOffset={null}
        previewRect={null}
        structures={[]}
        warnings={[]}
      />,
    );

    expect(screen.getByText('Snap peas')).toBeInTheDocument();
    expect(screen.queryByText('4 plants')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Adjust Snap peas spacing' }),
    ).not.toBeInTheDocument();
  });
});
