import { screen, waitFor } from '@testing-library/react';

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

  it('redirects the app shell index to the garden workspace', async () => {
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

  it('renders the authenticated tasks workspace', async () => {
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app/tasks', services);

    expect(await screen.findByText('Upcoming work')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Tasks' })).toBeVisible();
    });
  });

  it('renders the authenticated journal workspace', async () => {
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app/journal', services);

    expect(await screen.findByText('Harvest totals')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Journal' })).toBeVisible();
    });
  });

  it('renders editable settings for authenticated users', async () => {
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app/settings', services);

    expect(
      await screen.findByRole('heading', { name: 'Settings' }),
    ).toBeVisible();
    expect(await screen.findByDisplayValue('Detroit, MI')).toBeVisible();
    expect(await screen.findByLabelText('Watering check time')).toHaveValue(
      '07:00',
    );
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
