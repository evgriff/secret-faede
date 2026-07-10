import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

import { SettingsPage } from './SettingsPage';
import { plan, profile } from './settingsTestFixtures';

describe('SettingsPage', () => {
  it('renders identity, shared controls, capabilities, and private history', async () => {
    const user = userEvent.setup();
    renderSettings({
      deliveryHistory: [
        {
          body: 'Tomatoes need water.',
          channel: 'push',
          createdAtIso: '2026-07-09T12:00:00.000Z',
          id: 'water-alert',
          kind: 'watering',
          reason: 'Deficit crossed threshold.',
          status: 'sent',
          title: 'Water tomatoes',
        },
        {
          body: 'Low of 34°F expected.',
          channel: 'inApp',
          createdAtIso: '2026-07-08T12:00:00.000Z',
          id: 'frost-alert',
          kind: 'frost',
          reason: null,
          status: 'suppressed',
          title: 'Frost watch',
        },
      ],
    });

    expect(screen.getByText('Primary Gardener')).toBeVisible();
    expect(screen.getByText('gardener@example.com')).toBeVisible();
    expect(screen.getByLabelText(/^Garden timezone/)).toHaveValue(
      'America/Detroit',
    );
    expect(screen.getByText('Local reminders')).toBeVisible();
    expect(screen.getAllByText('Available').length).toBeGreaterThan(0);
    expect(screen.getByText('Water tomatoes')).toBeVisible();
    expect(screen.getByText('Sent to push service')).toBeVisible();
    expect(screen.getByText('Frost watch')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Frost' }));
    expect(screen.queryByText('Water tomatoes')).not.toBeInTheDocument();
    expect(screen.getByText('Frost watch')).toBeVisible();
  });

  it('validates coordinates, timezone, frost data, and focuses the first invalid field', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue('saved');
    renderSettings({ onSave });

    await user.clear(screen.getByLabelText(/^Latitude/));
    await user.clear(screen.getByLabelText(/^Garden timezone/));
    await user.type(screen.getByLabelText(/^Garden timezone/), 'Detroit-ish');
    await user.clear(screen.getByLabelText(/^Typical first frost/));
    await user.type(screen.getByLabelText(/^Typical first frost/), '02-31');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    expect(screen.getAllByText(/enter both coordinates/i)).toHaveLength(2);
    expect(screen.getByText(/valid IANA timezone/i)).toBeVisible();
    expect(screen.getByText(/valid month and day/i)).toBeVisible();
    await waitFor(() =>
      expect(screen.getByLabelText(/^Garden timezone/)).toHaveFocus(),
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('preserves operational coordinates and reports a queued settings save', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue('queued');
    renderSettings({ onSave });

    const location = screen.getByLabelText(/^Location label/);
    await user.clear(location);
    await user.type(location, 'Back garden');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[0].plan.plot.location.coordinates).toEqual({
      latitude: 42.3314,
      longitude: -83.0458,
    });
    expect(screen.getByText('Saved locally; waiting to sync')).toBeVisible();
  });

  it('enables push only after granted permission and completed registration', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue('saved');
    const onRegisterPush = vi.fn().mockResolvedValue({
      permission: 'granted',
      registered: true,
      tokenUpdatedAtIso: '2026-07-09T12:00:00.000Z',
    });
    const enabledProfile = profile();
    enabledProfile.notificationPreferences.pushEnabled = true;
    renderSettings({ onRegisterPush, onSave, profile: enabledProfile });

    expect(screen.getByText('Push is not active')).toBeVisible();
    expect(
      screen.getByText('Account enabled; device not registered'),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Enable push on this device' }),
    );
    expect(await screen.findByText('Push active')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(
      onSave.mock.calls[0]?.[0].profile.notificationPreferences.pushEnabled,
    ).toBe(true);
  });

  it('preserves account push consent while this device remains unregistered', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue('saved');
    const enabledProfile = profile();
    enabledProfile.notificationPreferences.pushEnabled = true;
    const onRegisterPush = vi.fn();
    renderSettings({ onRegisterPush, onSave, profile: enabledProfile });

    const location = screen.getByLabelText(/^Location label/);
    await user.clear(location);
    await user.type(location, 'Other device garden');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onRegisterPush).not.toHaveBeenCalled();
    expect(
      onSave.mock.calls[0]?.[0].profile.notificationPreferences.pushEnabled,
    ).toBe(true);
  });

  it('does not claim or save push when registration is denied or incomplete', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue('saved');
    const onRegisterPush = vi.fn().mockResolvedValue({
      permission: 'denied',
      registered: false,
      tokenUpdatedAtIso: null,
    });
    renderSettings({ onRegisterPush, onSave });

    await user.click(
      screen.getByRole('button', { name: 'Enable push on this device' }),
    );
    expect(await screen.findByText(/permission was denied/i)).toBeVisible();
    expect(screen.getByText('Push is not active')).toBeVisible();
    expect(screen.queryByText('Push active')).not.toBeInTheDocument();
    const location = screen.getByLabelText(/^Location label/);
    await user.clear(location);
    await user.type(location, 'Denied-device garden');
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(
      onSave.mock.calls[0]?.[0].profile.notificationPreferences.pushEnabled,
    ).toBe(false);
  });

  it('retains dirty values and reports save failures without duplicate submits', async () => {
    const user = userEvent.setup();
    let rejectSave: (error: Error) => void = () => undefined;
    const onSave = vi.fn(
      () =>
        new Promise<'saved'>((_, reject: (error: Error) => void) => {
          rejectSave = reject;
        }),
    );
    renderSettings({ onSave });

    const location = screen.getByLabelText(/^Location label/);
    await user.clear(location);
    await user.type(location, 'Back garden');
    expect(screen.getByText('Unsaved changes')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(
      screen.getByRole('button', { name: 'Saving settings…' }),
    ).toBeDisabled();
    expect(onSave).toHaveBeenCalledTimes(1);
    rejectSave(new Error('Profile write failed.'));

    expect(await screen.findByText(/profile write failed/i)).toBeVisible();
    expect(screen.getByText('Changes are not saved')).toBeVisible();
    expect(location).toHaveValue('Back garden');
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('submits from the keyboard and exposes load retry failures accessibly', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue('saved');
    const rendered = renderSettings({ onSave });
    const location = screen.getByLabelText(/^Location label/);
    await user.clear(location);
    await user.type(location, 'Keyboard garden{Enter}');
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    const onRetry = vi.fn().mockResolvedValue(undefined);
    rendered.rerender(
      <SettingsPage
        {...baseProps()}
        errorMessage="Profile load failed."
        loadState="error"
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Profile load failed.');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

function renderSettings(
  overrides: Partial<ComponentProps<typeof SettingsPage>> = {},
) {
  return render(<SettingsPage {...baseProps()} {...overrides} />);
}

function baseProps(): ComponentProps<typeof SettingsPage> {
  return {
    deliveryHistory: [],
    deviceCapabilities: {
      camera: 'available',
      localNotifications: 'available',
      platform: 'web',
      push: 'available',
    },
    identity: {
      displayName: 'Primary Gardener',
      email: 'gardener@example.com',
    },
    onRegisterPush: vi.fn().mockResolvedValue({
      permission: 'granted',
      registered: true,
      tokenUpdatedAtIso: '2026-07-09T12:00:00.000Z',
    }),
    onSave: vi.fn().mockResolvedValue('saved'),
    plan: plan(),
    profile: profile(),
    pushRegistration: {
      permission: 'prompt',
      registered: false,
      tokenUpdatedAtIso: null,
    },
  };
}
