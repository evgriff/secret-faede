import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SignInPage } from './SignInPage';

function renderSignIn(
  overrides: Partial<React.ComponentProps<typeof SignInPage>> = {},
) {
  const props: React.ComponentProps<typeof SignInPage> = {
    onPasswordReset: vi.fn().mockResolvedValue(undefined),
    onSignIn: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return { props, ...render(<SignInPage {...props} />) };
}

describe('SignInPage', () => {
  it('validates, normalizes, and submits the private-account credentials', async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn().mockResolvedValue(undefined);
    renderSignIn({
      isEmailAllowed: (email) => email === 'gardener@example.com',
      onSignIn,
    });

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText(/enter a complete email address/i)).toBeVisible();
    expect(screen.getByText('Enter your password.')).toBeVisible();

    await user.type(screen.getByLabelText(/email/i), '  Gardener@Example.com ');
    await user.type(screen.getByLabelText(/^password/i), 'secret');
    await user.click(screen.getByRole('checkbox', { name: /show password/i }));
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(onSignIn).toHaveBeenCalledTimes(1));
    expect(onSignIn).toHaveBeenCalledWith({
      email: 'gardener@example.com',
      password: 'secret',
      rememberDevice: true,
    });
  });

  it('allows only one auth operation at a time', async () => {
    const user = userEvent.setup();
    let finishSignIn: () => void = () => undefined;
    const onSignIn = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSignIn = resolve;
        }),
    );
    const onPasswordReset = vi.fn().mockResolvedValue(undefined);
    renderSignIn({ onPasswordReset, onSignIn });

    await user.type(screen.getByLabelText(/email/i), 'gardener@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Reset password' }),
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onPasswordReset).not.toHaveBeenCalled();

    finishSignIn();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled(),
    );
  });

  it('uses non-enumerating reset copy and fails closed on configuration errors', async () => {
    const user = userEvent.setup();
    const onPasswordReset = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderSignIn({ onPasswordReset });

    await user.type(screen.getByLabelText(/email/i), 'unknown@example.com');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(
      await screen.findByText(
        /if that address belongs to a configured account/i,
      ),
    ).toBeVisible();

    rerender(
      <SignInPage
        configurationError="Private account configuration is unavailable."
        onPasswordReset={onPasswordReset}
        onSignIn={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Private account configuration is unavailable.',
    );
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });
});
