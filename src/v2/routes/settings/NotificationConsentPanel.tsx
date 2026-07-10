import { useEffect, useRef, useState } from 'react';

import type { PushRegistrationState } from '../../domain';
import { Button, StatusBanner } from '../../ui';
import styles from './SettingsPage.module.css';
import type { DeviceCapability, SettingsDeviceCapabilities } from './types';

export function NotificationConsentPanel({
  capabilities,
  onPushEnabledChange,
  onRegistrationChange,
  onRegisterPush,
  pushEnabled,
  registration: initialRegistration,
}: {
  capabilities: SettingsDeviceCapabilities;
  onPushEnabledChange(enabled: boolean): void;
  onRegistrationChange(registration: PushRegistrationState): void;
  onRegisterPush?(): Promise<PushRegistrationState>;
  pushEnabled: boolean;
  registration: PushRegistrationState;
}) {
  const [registration, setRegistration] = useState(initialRegistration);
  const [isRegistering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const isRegistered =
    registration.permission === 'granted' && registration.registered;
  const isActive = pushEnabled && isRegistered;
  const canRequest =
    capabilities.push === 'available' &&
    registration.permission !== 'denied' &&
    Boolean(onRegisterPush);

  useEffect(() => setRegistration(initialRegistration), [initialRegistration]);

  async function enablePush() {
    if (inFlight.current || !onRegisterPush || !canRequest) return;
    inFlight.current = true;
    setRegistering(true);
    setError(null);
    try {
      const next = await onRegisterPush();
      setRegistration(next);
      onRegistrationChange(next);
      const enabled = next.permission === 'granted' && next.registered;
      if (enabled) onPushEnabledChange(true);
      if (!enabled) {
        setError(registrationFailureMessage(next));
      }
    } catch (caught) {
      setError(toMessage(caught));
    } finally {
      inFlight.current = false;
      setRegistering(false);
    }
  }

  return (
    <section aria-labelledby="delivery-title" className={styles.panel}>
      <div className={styles.sectionHeading}>
        <h2 id="delivery-title">Notification delivery</h2>
        <p>
          In-app history is always on. Push is active only after this device
          grants permission and completes registration.
        </p>
      </div>

      <div className={styles.deliveryRows}>
        <div>
          <span>In-app history</span>
          <strong>Always on</strong>
        </div>
        <div>
          <span>Push alerts</span>
          <strong>
            {pushStateLabel(isActive, isRegistered, pushEnabled, registration)}
          </strong>
        </div>
      </div>

      {isActive ? (
        <StatusBanner title="Push active" tone="success">
          Permission is granted and this device is registered.
        </StatusBanner>
      ) : (
        <StatusBanner title="Push is not active" tone="info">
          {pushInactiveMessage(capabilities.push, pushEnabled, registration)}
        </StatusBanner>
      )}
      {error ? (
        <StatusBanner live tone="error">
          {error}
        </StatusBanner>
      ) : null}

      <div className={styles.actions}>
        {isActive ? (
          <Button
            onClick={() => onPushEnabledChange(false)}
            variant="secondary"
          >
            Pause push alerts
          </Button>
        ) : isRegistered ? (
          <Button onClick={() => onPushEnabledChange(true)}>
            Resume push alerts
          </Button>
        ) : (
          <Button
            busyLabel="Enabling push…"
            disabled={!canRequest}
            isBusy={isRegistering}
            onClick={() => void enablePush()}
          >
            Enable push on this device
          </Button>
        )}
      </div>

      <h3>Device capabilities</h3>
      <dl className={styles.capabilityList}>
        <Capability label="Platform" value={capabilities.platform} />
        <Capability label="Push" value={capabilities.push} />
        <Capability
          label="Local reminders"
          value={capabilities.localNotifications}
        />
        <Capability label="Camera" value={capabilities.camera} />
      </dl>
    </section>
  );
}

function Capability({
  label,
  value,
}: {
  label: string;
  value: DeviceCapability | SettingsDeviceCapabilities['platform'];
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{humanize(value)}</dd>
    </div>
  );
}

function pushStateLabel(
  active: boolean,
  registered: boolean,
  pushEnabled: boolean,
  registration: PushRegistrationState,
) {
  if (active) return 'Active on this device';
  if (pushEnabled) return 'Account enabled; device not registered';
  if (registered) return 'Registered, paused';
  if (registration.permission === 'denied') return 'Permission denied';
  if (registration.permission === 'unsupported') return 'Unsupported';
  return 'Not enabled';
}

function pushInactiveMessage(
  capability: DeviceCapability,
  pushEnabled: boolean,
  registration: PushRegistrationState,
) {
  if (registration.permission === 'denied') {
    return 'This device denied permission. Review browser or operating-system settings before trying again.';
  }
  if (
    registration.permission === 'unsupported' ||
    capability === 'unsupported'
  ) {
    return 'Push notifications are not supported on this device.';
  }
  if (capability === 'unconfigured') {
    return 'Push setup is incomplete for this app build.';
  }
  if (capability === 'permissionDenied') {
    return 'Device permission is denied.';
  }
  if (pushEnabled) {
    return 'This account allows push alerts, but this device is not registered. Other registered devices remain enabled.';
  }
  return 'Enable push to request permission and register this device.';
}

function registrationFailureMessage(registration: PushRegistrationState) {
  if (registration.permission === 'denied') {
    return 'Permission was denied, so push remains off.';
  }
  if (registration.permission === 'unsupported') {
    return 'This device does not support push notifications.';
  }
  return 'Device registration did not complete, so push remains off.';
}

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function toMessage(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Push registration did not complete.';
}
