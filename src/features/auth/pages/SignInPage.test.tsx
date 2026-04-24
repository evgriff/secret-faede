import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderRoute } from '../../../test/render';
import { createTestServices } from '../../../test/testServices';

describe('SignInPage', () => {
  it('validates credentials and signs in with the mock password', async () => {
    const user = userEvent.setup();
    const services = await createTestServices();

    renderRoute('/sign-in', services);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('Enter a valid email address.'),
    ).toBeVisible();

    await user.type(screen.getByLabelText('Email'), 'primary.gardener@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    expect(
      screen.getByRole('checkbox', {
        name: 'Stay signed in on this trusted device',
      }),
    ).toBeChecked();
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'autocomplete',
      'email',
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('The email or password is incorrect.'),
    ).toBeVisible();

    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.click(screen.getByRole('checkbox', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', { name: 'Set up your garden' }),
    ).toBeVisible();
  });

  it('returns to the protected route that asked for sign-in', async () => {
    const user = userEvent.setup();
    const services = await createTestServices();

    renderRoute('/app/feed', services);

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeVisible();
    await user.type(screen.getByLabelText('Email'), 'primary.gardener@example.com');
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('button', { name: 'New entry' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Feed' }),
    ).toBeVisible();
    expect(await screen.findByText(/entries shown/i)).toBeVisible();
  });

  it('sends a password reset only for an allowed email', async () => {
    const user = userEvent.setup();
    const services = await createTestServices();

    renderRoute('/sign-in', services);

    await user.type(screen.getByLabelText('Email'), 'blocked@example.com');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(
      await screen.findByText('This email is not allowed for Secret Faede.'),
    ).toBeVisible();

    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'primary.gardener@example.com');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));

    expect(await screen.findByText('Password reset email sent.')).toBeVisible();
  });

  it('shows a fail-closed configuration message when the allowlist is invalid', async () => {
    const services = await createTestServices({
      allowlistError:
        'VITE_ALLOWED_EMAILS must contain exactly two distinct email addresses.',
    });

    renderRoute('/sign-in', services);

    expect(
      await screen.findByText(
        'VITE_ALLOWED_EMAILS must contain exactly two distinct email addresses.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });
});
