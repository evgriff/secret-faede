import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTestServices } from '../../test/testServices';
import { MockGardenRepository, MockUserProfileRepository } from '../data';
import { createDefaultProfile, type V2Services } from './services';
import { V2App } from './V2App';

describe('v2 application routing', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  });

  it('guards workspace routes and returns to the requested route after sign-in', async () => {
    window.history.replaceState({}, '', '/app/feed');
    render(<V2App services={await testV2Services()} />);

    expect(
      await screen.findByRole('heading', { name: 'Open the field book' }),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/sign-in');

    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText(/Email/),
      'primary.gardener@example.com',
    );
    await user.type(screen.getByLabelText(/Password/), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Feed' })).toBeVisible();
    expect(window.location.pathname).toBe('/app/feed');
  });

  it('keeps the sign-in form available when authentication fails', async () => {
    window.history.replaceState({}, '', '/sign-in');
    const services = await testV2Services();
    vi.spyOn(services.authService, 'signInWithPassword').mockRejectedValueOnce(
      new Error('The email or password is incorrect.'),
    );
    render(<V2App services={services} />);

    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText(/Email/),
      'primary.gardener@example.com',
    );
    await user.type(screen.getByLabelText(/Password/), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByText('The email or password is incorrect.'),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Open the field book' }),
    ).toBeVisible();
    expect(
      screen.queryByText('Checking for a trusted session on this device.'),
    ).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/sign-in');
  });

  it('signs out a rejected Firebase account and retains the denial context', async () => {
    window.history.replaceState({}, '', '/sign-in');
    const services = await testV2Services({
      accessClaims: {
        gardenAccess: false,
        secretFaeriesMember: false,
      },
      environment: {
        requestedMode: 'firebase',
        runtimeMode: 'firebase',
      },
    });
    const signOut = vi.spyOn(services.authService, 'signOut');
    render(<V2App services={services} />);

    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText(/Email/),
      'primary.gardener@example.com',
    );
    await user.type(screen.getByLabelText(/Password/), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', {
        name: 'This account cannot open the garden',
      }),
    ).toBeVisible();
    expect(screen.getByText(/primary\.gardener@example\.com/)).toBeVisible();
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(window.location.pathname).toBe('/access-denied');

    await user.click(screen.getByRole('button', { name: 'Return to sign in' }));
    expect(
      await screen.findByRole('heading', { name: 'Open the field book' }),
    ).toBeVisible();
    expect(signOut).toHaveBeenCalledTimes(2);
    expect(window.location.pathname).toBe('/sign-in');
  });

  it('uses Firebase claims without applying the mock email allowlist', async () => {
    window.history.replaceState({}, '', '/sign-in');
    const services = await testV2Services({
      allowedEmails: ['different@example.com'],
      allowlistError: 'Mock allowlist is intentionally invalid.',
      environment: {
        requestedMode: 'firebase',
        runtimeMode: 'firebase',
      },
    });
    render(<V2App services={services} />);

    expect(
      await screen.findByRole('heading', { name: 'Open the field book' }),
    ).toBeVisible();
    expect(
      screen.queryByText('Sign-in is unavailable'),
    ).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText(/Email/),
      'primary.gardener@example.com',
    );
    await user.type(screen.getByLabelText(/Password/), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('dialog', { name: 'Set up your garden' }),
    ).toBeVisible();
  });

  it('keeps the auth routes usable when optional device adapters fail', async () => {
    window.history.replaceState({}, '', '/sign-in');
    const services = await testV2Services();
    vi.spyOn(
      services.mobileDeviceService,
      'getNetworkStatus',
    ).mockRejectedValue(new Error('Native network status failed.'));
    vi.spyOn(
      services.mobileDeviceService,
      'subscribeToNetworkStatus',
    ).mockImplementation(() => {
      throw new Error('Native network subscription failed.');
    });
    vi.spyOn(
      services.notificationService,
      'subscribeToForegroundMessages',
    ).mockImplementation(() => {
      throw new Error('Foreground notification subscription failed.');
    });
    vi.spyOn(
      services.mobileDeviceService,
      'clearSessionHint',
    ).mockRejectedValue(new Error('Session hint cleanup failed.'));
    const captureError = vi.spyOn(services.telemetryService, 'captureError');

    render(<V2App services={services} />);

    expect(
      await screen.findByRole('heading', { name: 'Open the field book' }),
    ).toBeVisible();
    await waitFor(() => expect(captureError).toHaveBeenCalledTimes(4));
    expect(
      captureError.mock.calls.map(([, payload]) => payload?.context),
    ).toEqual(
      expect.arrayContaining([
        'v2_foreground_notification_subscription',
        'v2_network_status_bootstrap',
        'v2_network_status_subscription',
        'v2_session_hint_clear',
      ]),
    );
  });

  it('keeps the workspace open and reports a failed sign-out', async () => {
    window.history.replaceState({}, '', '/sign-in');
    const services = await testV2Services();
    render(<V2App services={services} />);

    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText(/Email/),
      'primary.gardener@example.com',
    );
    await user.type(screen.getByLabelText(/Password/), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByRole('dialog', { name: 'Set up your garden' }),
    ).toBeVisible();
    await createBlankGarden(user);
    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Set up your garden' }),
      ).not.toBeInTheDocument(),
    );

    vi.spyOn(services.authService, 'signOut').mockRejectedValueOnce(
      new Error('Connection failed.'),
    );
    await user.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(await screen.findByText('Sign-out failed')).toBeVisible();
    expect(
      screen.getByText(
        'Your session is still open. Check your connection, then try again.',
      ),
    ).toBeVisible();
    expect(window.location.pathname).toBe('/app/plan');
  });

  it('surfaces workspace subscription errors and recovers on retry', async () => {
    window.history.replaceState({}, '', '/sign-in');
    const services = await testV2Services();
    const subscribe = services.gardenRepository.subscribe.bind(
      services.gardenRepository,
    );
    let reportWorkspaceError: ((error: Error) => void) | undefined;
    vi.spyOn(services.gardenRepository, 'subscribe').mockImplementation(
      (userId, onChange, onError) => {
        reportWorkspaceError = onError;
        return subscribe(userId, onChange, onError);
      },
    );
    render(<V2App services={services} />);

    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText(/Email/),
      'primary.gardener@example.com',
    );
    await user.type(screen.getByLabelText(/Password/), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(
      await screen.findByRole('dialog', { name: 'Set up your garden' }),
    ).toBeVisible();

    act(() => reportWorkspaceError?.(new Error('Workspace stream stopped.')));
    expect(
      await screen.findByText('The garden workspace could not be opened'),
    ).toBeVisible();
    expect(screen.getByText('Workspace stream stopped.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('dialog', { name: 'Set up your garden' }),
    ).toBeVisible();
  });

  it('refreshes operations after publish without misreporting refresh failure', async () => {
    window.history.replaceState({}, '', '/sign-in');
    const services = await testV2Services();
    const refreshOperations = vi
      .spyOn(services.gardenOperationsService, 'refreshGardenOperations')
      .mockRejectedValueOnce(new Error('Operations refresh failed.'));
    const captureError = vi.spyOn(services.telemetryService, 'captureError');
    render(<V2App services={services} />);

    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText(/Email/),
      'primary.gardener@example.com',
    );
    await user.type(screen.getByLabelText(/Password/), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await createBlankGarden(user);
    await user.click(await screen.findByRole('button', { name: 'Publish' }));
    await user.click(
      screen.getByRole('button', { name: 'Publish shared plan' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Publish this private draft?' }),
      ).not.toBeInTheDocument(),
    );
    const currentUser = services.authService.getCurrentUser();
    expect(currentUser).not.toBeNull();
    expect(refreshOperations).toHaveBeenCalledWith(currentUser!.uid);
    await waitFor(() =>
      expect(captureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ context: 'v2_publish_operations_refresh' }),
      ),
    );
    expect(screen.getByRole('heading', { name: 'Home garden' })).toBeVisible();
  });

  it('creates the first measured plot and navigates across the rebuilt workspace', async () => {
    window.history.replaceState({}, '', '/sign-in');
    const services = await testV2Services();
    render(<V2App services={services} />);
    const user = userEvent.setup();
    await user.type(
      await screen.findByLabelText(/Email/),
      'primary.gardener@example.com',
    );
    await user.type(screen.getByLabelText(/Password/), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('dialog', { name: 'Set up your garden' }),
    ).toBeVisible();
    await createBlankGarden(user);

    await waitFor(() =>
      expect(
        screen.queryByRole('dialog', { name: 'Set up your garden' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { name: 'Home garden' })).toBeVisible();

    await user.click(screen.getAllByRole('link', { name: 'Today' })[0]!);
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeVisible();
    expect(
      screen.getByText(/Every card is calculated separately/),
    ).toBeVisible();

    const scrollTo = vi.mocked(window.scrollTo);
    expect(scrollTo).toHaveBeenCalledWith({
      behavior: 'auto',
      left: 0,
      top: 0,
    });
    scrollTo.mockClear();
    act(() => {
      window.history.pushState({}, '', '/app/today?focus=task&taskId=missing');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await waitFor(() =>
      expect(window.location.search).toBe('?focus=task&taskId=missing'),
    );
    expect(scrollTo).not.toHaveBeenCalled();

    await user.click(screen.getAllByRole('link', { name: 'Settings' })[0]!);
    expect(
      await screen.findByRole('heading', { name: 'Settings' }),
    ).toBeVisible();
    expect(screen.getAllByText('Primary Gardener')).not.toHaveLength(0);
    expect(screen.getByText('primary.gardener@example.com')).toBeVisible();
    const currentUser = services.authService.getCurrentUser();
    expect(currentUser).not.toBeNull();
    const savedProfile = await services.userProfileRepository.getProfile(
      currentUser!.uid,
    );
    expect(savedProfile).toMatchObject({
      displayName: 'Primary Gardener',
      email: 'primary.gardener@example.com',
    });
  });
});

async function testV2Services(
  options?: Parameters<typeof createTestServices>[0],
): Promise<V2Services> {
  const baseServices = await createTestServices(options);
  return {
    authService: baseServices.authService,
    environment: baseServices.environment,
    gardenRepository: new MockGardenRepository({
      storage: window.localStorage,
    }),
    gardenOperationsService: baseServices.gardenOperationsService,
    mediaStorageService: baseServices.mediaStorageService,
    mobileDeviceService: baseServices.mobileDeviceService,
    notificationService: baseServices.notificationService,
    resolvePhotoUrl: async (path) => path,
    telemetryService: baseServices.telemetryService,
    userProfileRepository: new MockUserProfileRepository(
      window.localStorage,
      (userId) => createDefaultProfile(userId),
    ),
    weatherProvider: baseServices.weatherProvider,
  };
}

async function createBlankGarden(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByLabelText(/Blank plot/));
  await user.type(screen.getByLabelText(/Location label/), 'Back garden');
  await user.type(
    screen.getByLabelText(/Weather location description/),
    'Detroit, MI',
  );
  await user.type(screen.getByLabelText(/Latitude/), '42.3314');
  await user.type(screen.getByLabelText(/Longitude/), '-83.0458');
  await user.type(screen.getByLabelText(/Hardiness zone/), '6b');
  await user.type(screen.getByLabelText(/Typical last frost/), '04-30');
  await user.type(screen.getByLabelText(/Typical first frost/), '10-15');
  await user.click(screen.getByRole('button', { name: 'Create garden plan' }));
}
