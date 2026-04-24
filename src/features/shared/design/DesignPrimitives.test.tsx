import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  ActionButton,
  Drawer,
  InfoChip,
  Modal,
  SegmentedControl,
  Sheet,
  StatusBadge,
} from './DesignPrimitives';

describe('DesignPrimitives', () => {
  it('separates passive status and info from actionable controls', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onFilter = vi.fn();

    render(
      <>
        <StatusBadge tone="success">Online</StatusBadge>
        <InfoChip>Raised bed</InfoChip>
        <ActionButton intent="success" onClick={onAction} priority="primary">
          Water done
        </ActionButton>
        <SegmentedControl
          label="Feed type"
          onChange={onFilter}
          options={[
            { label: 'All', value: 'all' },
            { label: 'Issues', value: 'issue' },
          ]}
          value="all"
        />
      </>,
    );

    expect(screen.getByText('Online')).toHaveAttribute('data-ui', 'status');
    expect(screen.getByText('Raised bed')).toHaveAttribute('data-ui', 'info');

    const action = screen.getByRole('button', { name: 'Water done' });
    expect(action).toHaveAttribute('data-ui', 'action');
    expect(action).toHaveAttribute('data-action-intent', 'success');

    const filter = screen.getByRole('button', { name: 'Issues' });
    expect(filter).toHaveAttribute('data-ui', 'filter');

    await user.click(action);
    await user.click(filter);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onFilter).toHaveBeenCalledWith('issue');
  });

  it('closes shared overlays from the backdrop, close button, and escape key', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { rerender } = render(
      <Modal
        backdropTestId="overlay-backdrop"
        closeLabel="Close overlay"
        onClose={onClose}
        title="Overlay title"
      >
        Overlay body
      </Modal>,
    );

    expect(screen.getByRole('button', { name: 'Close overlay' })).toBeVisible();
    fireEvent.pointerDown(screen.getByTestId('overlay-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Close overlay' }));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(
      <Sheet
        backdropTestId="sheet-backdrop"
        closeLabel="Close sheet"
        onClose={onClose}
        title="Sheet title"
      >
        Sheet body
      </Sheet>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);

    rerender(
      <Drawer
        backdropTestId="drawer-backdrop"
        closeLabel="Close drawer"
        onClose={onClose}
        title="Drawer title"
      >
        Drawer body
      </Drawer>,
    );

    expect(screen.getByRole('button', { name: 'Close drawer' })).toBeVisible();
    fireEvent.pointerDown(screen.getByTestId('drawer-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(4);
  });
});
