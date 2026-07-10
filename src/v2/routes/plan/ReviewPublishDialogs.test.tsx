import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ReviewDialog } from './ReviewPublishDialogs';
import type { PlanIssue } from './planModel';

describe('ReviewDialog', () => {
  it('never offers to ignore a blocking physical conflict', async () => {
    const user = userEvent.setup();
    const onIgnore = vi.fn();
    const issues: PlanIssue[] = [
      {
        id: 'overlap:a:b',
        message: 'Tomato and bean need the same mature space.',
        plantingGroupIds: ['a', 'b'],
        severity: 'blocking',
        title: 'Crop groups overlap',
        type: 'overlap',
      },
      {
        id: 'water-confidence:a',
        message: 'Review the estimated water profile.',
        plantingGroupIds: ['a'],
        severity: 'attention',
        title: 'Water profile needs confirmation',
        type: 'waterConfidence',
      },
    ];
    render(
      <ReviewDialog
        ignoredIssueIds={new Set()}
        isOpen
        issues={issues}
        onClose={vi.fn()}
        onIgnore={onIgnore}
        onRestore={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/physical conflict must be resolved before publishing/i),
    ).toBeVisible();
    expect(
      screen.getAllByRole('button', { name: 'Ignore for now' }),
    ).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Ignore for now' }));
    expect(onIgnore).toHaveBeenCalledWith('water-confidence:a');
  });
});
