import { screen } from '@testing-library/react';

import {
  annArborClimateProfile,
  createDefaultGarden,
} from '../domain/gardens/GardenRepository';
import type { AppServices } from '../infrastructure/runtime/services';
import { rememberAppRoute } from '../features/auth/sessionResume';
import { routePaths } from '../shared/lib/routes';
import { renderRoute } from '../test/render';
import { createTestServices } from '../test/testServices';

describe('app routing', () => {
  it('redirects unauthenticated users from the root to sign-in', async () => {
    const services = await createTestServices();

    renderRoute('/', services);

    expect(
      await screen.findByRole('heading', {
        name: 'Sign in',
      }),
    ).toBeVisible();
  });

  it('redirects allowlisted users from the root to Plan', async () => {
    const services = await createConfiguredGardenServices();

    renderRoute('/', services);

    expect(await screen.findByRole('heading', { name: 'Plan' })).toBeVisible();
  });

  it('redirects allowlisted users from the root to their last workspace route', async () => {
    const services = await createConfiguredGardenServices();

    rememberAppRoute(routePaths.feed);
    renderRoute('/', services);

    expect(
      await screen.findByRole('region', { name: 'Feed summary' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Feed' }),
    ).toBeVisible();
  });

  it('redirects the app shell index to Plan', async () => {
    const services = await createConfiguredGardenServices();

    renderRoute('/app', services);

    expect(
      await screen.findByRole('heading', {
        name: 'Plan',
      }),
    ).toBeVisible();
  });

  it('renders the authenticated Today workspace', async () => {
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app/today', services);

    expect(
      await screen.findByRole('heading', { name: 'Field weather' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Today' }),
    ).toBeVisible();
  });

  it('renders the authenticated Feed workspace', async () => {
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app/feed', services);

    expect(
      await screen.findByRole('region', { name: 'Feed summary' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Feed' }),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: 'Post' })).toBeVisible();
    expect(screen.getByText(/memories shown/i)).toBeVisible();
  });

  it('redirects the legacy garden route to Plan', async () => {
    const services = await createConfiguredGardenServices();

    renderRoute('/app/garden', services);

    expect(await screen.findByRole('heading', { name: 'Plan' })).toBeVisible();
  });

  it('redirects the legacy tasks route to Today', async () => {
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app/tasks', services);

    expect(
      await screen.findByRole('heading', { name: 'Field weather' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Today' }),
    ).toBeVisible();
  });

  it('redirects the legacy log route to Feed', async () => {
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app/log', services);

    expect(
      await screen.findByRole('region', { name: 'Feed summary' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Feed' }),
    ).toBeVisible();
  });

  it('redirects the legacy journal route to Feed', async () => {
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app/journal', services);

    expect(
      await screen.findByRole('region', { name: 'Feed summary' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Feed' }),
    ).toBeVisible();
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

async function createConfiguredGardenServices(): Promise<AppServices> {
  const services = await createTestServices({
    signedInEmail: 'primary.gardener@example.com',
  });
  const currentUser = services.authService.getCurrentUser();

  if (!currentUser) {
    throw new Error('Expected signed-in test user.');
  }

  await services.gardenRepository.saveGarden({
    ...createDefaultGarden(currentUser.uid),
    climateProfile: {
      ...annArborClimateProfile,
      source: 'user',
    },
  });

  return services;
}
