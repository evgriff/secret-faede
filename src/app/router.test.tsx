import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  detroitClimateProfile,
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  createDefaultUserProfile,
} from '../domain/gardens/GardenRepository';
import type {
  OptionalAgricultureMetrics,
  RecentPrecipitation,
  WeatherAlert,
  WeatherCurrentConditions,
  WeatherForecast,
  WeatherLocation,
  WeatherProvider,
  WeatherRequestOptions,
} from '../domain/weather/WeatherProvider';
import {
  createSampleGarden,
  sampleGardenName,
} from '../domain/gardens/sampleGarden';
import {
  writeDemoModeBackup,
  writeDemoModeSession,
} from '../features/demo/demoModeStorage';
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
    expect(screen.getByLabelText('Shell status')).toHaveTextContent('Online');
    expect(screen.getByTitle('primary.gardener@example.com')).toHaveTextContent(
      'Primary Gardener',
    );
    expect(screen.queryByText(/Primary Gardener ·/)).not.toBeInTheDocument();
  });

  it('redirects allowlisted users from the root to their last workspace route', async () => {
    const services = await createConfiguredGardenServices();

    rememberAppRoute(routePaths.feed);
    renderRoute('/', services);

    expect(
      await screen.findByRole('button', { name: 'New entry' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Feed' }),
    ).toBeVisible();
    expect(
      await screen.findByText(
        /watering, harvests, issues, notes, and photos stay here/i,
      ),
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
    expect(screen.getByText('Field entry')).toBeVisible();
  });

  it('refreshes Today weather with force-refresh provider data and surfaces watering work', async () => {
    const user = userEvent.setup();
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });
    const currentUser = services.authService.getCurrentUser();
    const weatherProvider = new ChangingTodayWeatherProvider();

    if (!currentUser) {
      throw new Error('Expected signed-in test user.');
    }

    const profile = createDefaultUserProfile(
      currentUser.uid,
      currentUser.email,
    );
    await services.userProfileRepository.saveUserProfile({
      ...profile,
      notificationPreference: {
        ...profile.notificationPreference,
        defaultWateringCheckTime: '00:00',
      },
    });
    services.weatherProvider = weatherProvider;
    await services.gardenRepository.saveGarden({
      ...createDefaultGarden(currentUser.uid),
      plantings: [
        {
          ...createDefaultPlanting({
            id: 'tomato-1',
            label: 'Tomato',
            xFt: 3,
            yFt: 3,
          }),
          cropId: 'tomato',
          plantedOn: '2026-04-20',
          status: 'growing',
          weeklyWaterNeedInches: 1.75,
        },
      ],
      structures: [
        {
          ...createDefaultStructure({
            id: 'bed-1',
            type: 'raisedBed',
            xFt: 1,
            yFt: 1,
          }),
          label: 'Main bed',
        },
      ],
    });

    renderRoute('/app/today', services);

    const refreshButton = await screen.findByRole('button', {
      name: 'Refresh weather & watering schedule',
    });

    await user.click(refreshButton);

    expect(
      await screen.findByText('Weather and watering schedule refreshed.'),
    ).toBeVisible();
    expect(await screen.findByText('0.12in')).toBeVisible();
    expect(
      await screen.findByRole('heading', { name: 'Watering work' }),
    ).toBeVisible();

    await user.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText('0.02in')).toBeVisible();
    });
    expect(weatherProvider.forceRefreshCalls).toBe(10);
  });

  it('renders the authenticated Feed workspace', async () => {
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/app/feed', services);

    expect(
      await screen.findByRole('button', { name: 'New entry' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Feed' }),
    ).toBeVisible();
    expect(
      await screen.findByText(
        /watering, harvests, issues, notes, and photos stay here/i,
      ),
    ).toBeVisible();
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
      await screen.findByRole('button', { name: 'New entry' }),
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
      await screen.findByRole('button', { name: 'New entry' }),
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

  it('enters, resets, and exits the sample garden from Settings', async () => {
    const user = userEvent.setup();
    const services = await createConfiguredGardenServices();
    const currentUser = services.authService.getCurrentUser();

    if (!currentUser) {
      throw new Error('Expected signed-in test user.');
    }

    renderRoute('/app/settings', services);

    const disclosure = await screen.findByTestId('sample-garden-disclosure');
    const disclosureSummary = disclosure.querySelector('summary');

    if (!disclosureSummary) {
      throw new Error('Expected the sample garden disclosure summary.');
    }

    await user.click(disclosureSummary);
    await user.click(
      await screen.findByRole('button', { name: 'Open sample garden' }),
    );

    await waitFor(async () => {
      await expectDemoGardenName(services, currentUser.uid);
    });
    const sampleGarden = screen.getByRole('region', { name: 'Sample garden' });
    expect(sampleGarden).toHaveTextContent('Sample garden active.');

    await user.click(
      within(sampleGarden).getByRole('button', {
        name: 'Reset sample garden',
      }),
    );
    await waitFor(async () => {
      await expectDemoGardenName(services, currentUser.uid);
    });

    await user.click(
      within(sampleGarden).getByRole('button', {
        name: 'Back to my garden',
      }),
    );

    await waitFor(async () => {
      const garden = await services.gardenRepository.getGarden(currentUser.uid);

      expect(garden?.name).toBe('Home garden');
    });
  });

  it('shows the shell restore control only while the sample garden is active', async () => {
    const services = await createConfiguredGardenServices();
    const currentUser = services.authService.getCurrentUser();

    if (!currentUser) {
      throw new Error('Expected signed-in test user.');
    }

    const initialView = renderRoute('/app/plan', services);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Plan' }),
    ).toBeVisible();
    expect(
      screen.queryByTestId('sample-garden-shell-restore'),
    ).not.toBeInTheDocument();

    initialView.unmount();

    const realGarden = await services.gardenRepository.getGarden(
      currentUser.uid,
    );

    writeDemoModeBackup(currentUser.uid, {
      garden: realGarden ?? createDefaultGarden(currentUser.uid),
      profile: createDefaultUserProfile(currentUser.uid, currentUser.email),
      savedAtIso: '2026-04-24T12:00:00.000Z',
      sourceGardenName: realGarden?.name ?? 'Home garden',
    });
    await services.gardenRepository.saveGarden(
      createSampleGarden(currentUser.uid),
    );
    writeDemoModeSession(currentUser.uid);

    renderRoute('/app/today', services);

    const shellRestore = await screen.findByTestId(
      'sample-garden-shell-restore',
    );

    expect(shellRestore).toBeVisible();
    expect(shellRestore).toBeEnabled();
    expect(shellRestore).toHaveAccessibleName('Back to my garden');
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

  it('redirects Firebase users without membership claims to access denied', async () => {
    const services = await createTestServices({
      accessClaims: {
        gardenAccess: true,
        secretFaeriesMember: false,
      },
      environment: {
        requestedMode: 'firebase',
        runtimeMode: 'firebase',
      },
      signedInEmail: 'primary.gardener@example.com',
    });

    renderRoute('/', services);

    expect(
      await screen.findByRole('heading', {
        name: 'This email address is not authorized.',
      }),
    ).toBeVisible();
  });

  it('disables restore when sample mode has no saved-garden backup', async () => {
    const services = await createTestServices({
      signedInEmail: 'primary.gardener@example.com',
    });
    const currentUser = services.authService.getCurrentUser();

    if (!currentUser) {
      throw new Error('Expected signed-in test user.');
    }

    await services.gardenRepository.saveGarden(
      createSampleGarden(currentUser.uid),
    );
    writeDemoModeSession(currentUser.uid);

    renderRoute('/app/settings', services);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Settings' }),
    ).toBeVisible();
    const restoreButtons = await screen.findAllByRole('button', {
      name: 'Back to my garden',
    });

    expect(restoreButtons).toHaveLength(2);
    restoreButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
    expect(
      screen.getAllByText(
        /No saved garden backup is available on this device, so Back to my garden is unavailable\./i,
      ),
    ).toHaveLength(2);
  });
});

async function expectDemoGardenName(services: AppServices, uid: string) {
  const garden = await services.gardenRepository.getGarden(uid);

  expect(garden?.name).toBe(sampleGardenName);
}

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
      ...detroitClimateProfile,
      source: 'user',
    },
  });

  return services;
}

class ChangingTodayWeatherProvider implements WeatherProvider {
  readonly id = 'nationalWeatherService';
  readonly label = 'Test National Weather Service';
  forceRefreshCalls = 0;
  private recentRainCallIndex = 0;

  getCurrentConditions(
    _location: WeatherLocation,
    options?: WeatherRequestOptions,
  ): Promise<WeatherCurrentConditions> {
    this.recordForceRefresh(options);

    return Promise.resolve({
      capturedAtIso: '2026-04-24T23:00:00.000Z',
      conditionSummary:
        this.recentRainCallIndex === 0 ? 'Cloudy' : 'Partly Cloudy',
      feelsLikeF: 64,
      humidityPercent: 70,
      observationTimeIso: '2026-04-24T22:50:00.000Z',
      precipitationLastHourIn: 0,
      providerId: this.id,
      sourceLabel: this.label,
      temperatureF: 64,
      windMph: 6,
    });
  }

  getForecast(
    _location: WeatherLocation,
    options?: WeatherRequestOptions,
  ): Promise<WeatherForecast> {
    this.recordForceRefresh(options);

    return Promise.resolve({
      dailyHighF: 82,
      days: [
        {
          conditionSummary: 'Clouds clearing',
          date: '2026-04-24',
          expectedRainIn: 0,
          highF: 82,
          precipitationChancePercent: 10,
        },
      ],
      generatedAtIso: '2026-04-24T23:00:00.000Z',
      next24hPrecipIn: 0,
      next48hPrecipIn: 0,
      nextRainIso: null,
      overnightLowF: 54,
      periods: [],
      providerId: this.id,
      summary: 'Clouds clearing',
    });
  }

  getWeatherAlerts(
    _location: WeatherLocation,
    options?: WeatherRequestOptions,
  ): Promise<WeatherAlert[]> {
    this.recordForceRefresh(options);
    return Promise.resolve([]);
  }

  getRecentPrecipitation(
    _location: WeatherLocation,
    hours: number,
    options?: WeatherRequestOptions,
  ): Promise<RecentPrecipitation> {
    this.recordForceRefresh(options);
    const recentRain = this.recentRainCallIndex === 0 ? 0.12 : 0.02;

    this.recentRainCallIndex += 1;

    return Promise.resolve({
      generatedAtIso: '2026-04-24T23:00:00.000Z',
      hours,
      last24hIn: recentRain,
      last72hIn: recentRain,
      observations: [],
      providerId: this.id,
      totalIn: recentRain,
    });
  }

  getOptionalAgricultureMetrics(
    _location: WeatherLocation,
    options?: WeatherRequestOptions,
  ): Promise<OptionalAgricultureMetrics> {
    this.recordForceRefresh(options);

    return Promise.resolve({
      evapotranspirationIn: null,
      evapotranspirationNext24hIn: null,
      generatedAtIso: '2026-04-24T23:00:00.000Z',
      notes: [],
      providerId: this.id,
    });
  }

  private recordForceRefresh(options?: WeatherRequestOptions) {
    if (options?.forceRefresh) {
      this.forceRefreshCalls += 1;
    }
  }
}
