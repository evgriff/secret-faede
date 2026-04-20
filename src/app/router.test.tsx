import { screen } from '@testing-library/react';

import { renderRoute } from '../test/render';
import { createTestServices } from '../test/testServices';

describe('app routing', () => {
  it('redirects unauthenticated users from the root to sign-in', async () => {
    const services = await createTestServices();

    renderRoute('/', services);

    expect(
      await screen.findByRole('heading', {
        name: 'Sign in with an email link.',
      }),
    ).toBeVisible();
  });

  it('redirects allowlisted users from the root to the garden editor', async () => {
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/', services);

    expect(
      await screen.findByRole('heading', { name: 'Garden editor' }),
    ).toBeVisible();
  });

  it('renders the garden editor at the app route', async () => {
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app', services);

    expect(
      await screen.findByRole('heading', {
        name: 'Garden editor',
      }),
    ).toBeVisible();
  });

  it('redirects non-allowlisted users from the root to access denied', async () => {
    const services = await createTestServices({
      signedInEmail: 'blocked@example.com',
    });

    renderRoute('/', services);

    expect(
      await screen.findByRole('heading', {
        name: 'This email address is not authorized.',
      }),
    ).toBeVisible();
  });
});
