import { screen } from '@testing-library/react';

import { buildSelectedGardenStorageKey } from '../features/gardens/storage';
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

  it('redirects authenticated users without a selection to garden selection', async () => {
    const services = await createTestServices({
      signedInEmail: 'gardener@example.com',
    });

    renderRoute('/', services);

    expect(
      await screen.findByRole('heading', {
        name: 'Choose the garden context for this session.',
      }),
    ).toBeVisible();
  });

  it('redirects authenticated users with a saved garden selection into the garden route', async () => {
    const services = await createTestServices({
      signedInEmail: 'gardener@example.com',
    });
    const user = services.authService.getCurrentUser();

    if (!user) {
      throw new Error('Expected an authenticated mock user.');
    }

    window.localStorage.setItem(
      buildSelectedGardenStorageKey(user.uid),
      'north-lot',
    );

    renderRoute('/', services);

    expect(
      await screen.findByRole('heading', { name: 'North Lot' }),
    ).toBeVisible();
  });
});
