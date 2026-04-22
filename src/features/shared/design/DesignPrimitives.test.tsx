import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  ActionButton,
  InfoChip,
  SegmentedControl,
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
});
