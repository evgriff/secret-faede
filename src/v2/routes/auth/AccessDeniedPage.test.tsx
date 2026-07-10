import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AccessDeniedPage } from './AccessDeniedPage';

describe('AccessDeniedPage', () => {
  it('shows the attempted account and protects the session-close action', async () => {
    const user = userEvent.setup();
    let finish: () => void = () => undefined;
    const onReturnToSignIn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <AccessDeniedPage
        attemptedEmail="blocked@example.com"
        onReturnToSignIn={onReturnToSignIn}
      />,
    );

    expect(
      screen.getByRole('heading', {
        name: 'This account cannot open the garden',
      }),
    ).toBeVisible();
    expect(screen.getByText('blocked@example.com')).toBeVisible();
    const button = screen.getByRole('button', { name: 'Return to sign in' });
    await user.click(button);
    await user.click(button);

    expect(onReturnToSignIn).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('button', { name: 'Closing session…' }),
    ).toBeDisabled();
    finish();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Return to sign in' }),
      ).toBeEnabled(),
    );
  });

  it('keeps recovery available when sign-out fails', async () => {
    const user = userEvent.setup();
    render(
      <AccessDeniedPage
        onReturnToSignIn={vi.fn().mockRejectedValue(new Error('offline'))}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Return to sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not return to sign in.',
    );
    expect(
      screen.getByRole('button', { name: 'Return to sign in' }),
    ).toBeEnabled();
  });
});
