import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ErrorState, SaveStatus } from './AsyncStates';

describe('shared async states', () => {
  it('communicates queued and conflict-safe save states', () => {
    const { rerender } = render(<SaveStatus status="queued" />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Saved on this device; waiting to sync',
    );

    rerender(<SaveStatus status="conflict" />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Saved versions need review',
    );
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-live',
      'assertive',
    );
  });

  it('prevents concurrent retry requests', async () => {
    const user = userEvent.setup();
    let resolveRetry: () => void = () => undefined;
    const retry = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRetry = resolve;
        }),
    );
    render(<ErrorState onRetry={retry} />);

    const button = screen.getByRole('button', { name: 'Try again' });
    await user.click(button);
    await user.click(button);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    resolveRetry();
    expect(
      await screen.findByRole('button', { name: 'Try again' }),
    ).toBeEnabled();
  });
});
