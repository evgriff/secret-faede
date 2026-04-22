import type { UserProfile } from '../../../domain/gardens/GardenRepository';
import {
  alertTypes,
  formatAlertType,
  formatChannel,
  formatDateTime,
  readNumber,
} from '../settingsHelpers';
import styles from '../SettingsPage.module.css';

export function AlertDefaultsFields({
  onProfileChange,
  profile,
}: {
  onProfileChange(profile: UserProfile): void;
  profile: UserProfile;
}) {
  return (
    <div className={styles.grid}>
      <label className={styles.field}>
        <span>Alert location</span>
        <input
          onChange={(event) =>
            onProfileChange({
              ...profile,
              alertLocationQuery: event.currentTarget.value,
            })
          }
          value={profile.alertLocationQuery}
        />
      </label>
      <label className={styles.field}>
        <span>Timezone</span>
        <input
          onChange={(event) =>
            onProfileChange({
              ...profile,
              notificationPreference: {
                ...profile.notificationPreference,
                timezone: event.currentTarget.value,
              },
              timezone: event.currentTarget.value,
            })
          }
          value={profile.timezone}
        />
      </label>
      <label className={styles.field}>
        <span>Watering check time</span>
        <input
          onChange={(event) =>
            onProfileChange({
              ...profile,
              notificationPreference: {
                ...profile.notificationPreference,
                defaultWateringCheckTime: event.currentTarget.value,
              },
            })
          }
          type="time"
          value={profile.notificationPreference.defaultWateringCheckTime}
        />
      </label>
      <label className={styles.field}>
        <span>Water alert threshold inches</span>
        <input
          min="0"
          onChange={(event) =>
            onProfileChange({
              ...profile,
              notificationPreference: {
                ...profile.notificationPreference,
                wateringAlertThresholdIn: readNumber(
                  event.currentTarget.value,
                  profile.notificationPreference.wateringAlertThresholdIn,
                ),
              },
            })
          }
          step="0.05"
          type="number"
          value={profile.notificationPreference.wateringAlertThresholdIn}
        />
      </label>
      <label className={styles.field}>
        <span>Frost alert threshold F</span>
        <input
          onChange={(event) =>
            onProfileChange({
              ...profile,
              notificationPreference: {
                ...profile.notificationPreference,
                frostAlertThresholdF: readNumber(
                  event.currentTarget.value,
                  profile.notificationPreference.frostAlertThresholdF,
                ),
              },
            })
          }
          step="1"
          type="number"
          value={profile.notificationPreference.frostAlertThresholdF}
        />
      </label>
    </div>
  );
}

export function NotificationDeliveryFields({
  onProfileChange,
  profile,
}: {
  onProfileChange(profile: UserProfile): void;
  profile: UserProfile;
}) {
  return (
    <fieldset className={styles.channels}>
      <legend>Notification delivery</legend>
      <p className={styles.metaText}>
        In-app logs are always recorded. Push alerts can reach this browser or a
        native device after permission is granted.
      </p>
      <div className={styles.deliveryStatus}>
        <span>{formatChannel('inApp')}</span>
        <strong>Always on</strong>
      </div>
      <label className={styles.checkbox}>
        <input
          checked={profile.notificationPreference.channels.push}
          onChange={(event) =>
            onProfileChange({
              ...profile,
              notificationPreference: {
                ...profile.notificationPreference,
                channels: {
                  ...profile.notificationPreference.channels,
                  inApp: true,
                  push: event.currentTarget.checked,
                },
              },
            })
          }
          type="checkbox"
        />
        Push alerts
      </label>
    </fieldset>
  );
}

export function AlertTypeFields({
  onProfileChange,
  profile,
}: {
  onProfileChange(profile: UserProfile): void;
  profile: UserProfile;
}) {
  return (
    <fieldset className={styles.channels}>
      <legend>Alert types</legend>
      <p className={styles.metaText}>
        Alerts stay tied to garden operations: watering, weather risk, and due
        field work.
      </p>
      {alertTypes.map((alertType) => (
        <label className={styles.checkbox} key={alertType}>
          <input
            checked={profile.notificationPreference.alertTypes[alertType]}
            onChange={(event) =>
              onProfileChange({
                ...profile,
                notificationPreference: {
                  ...profile.notificationPreference,
                  alertTypes: {
                    ...profile.notificationPreference.alertTypes,
                    [alertType]: event.currentTarget.checked,
                  },
                },
              })
            }
            type="checkbox"
          />
          {formatAlertType(alertType)}
        </label>
      ))}
    </fieldset>
  );
}

export function QuietHoursFields({
  onProfileChange,
  profile,
}: {
  onProfileChange(profile: UserProfile): void;
  profile: UserProfile;
}) {
  return (
    <div className={styles.grid}>
      <label className={styles.field}>
        <span>Quiet hours start</span>
        <input
          onChange={(event) =>
            onProfileChange({
              ...profile,
              notificationPreference: {
                ...profile.notificationPreference,
                quietHours: {
                  ...profile.notificationPreference.quietHours,
                  startLocalTime: event.currentTarget.value,
                },
              },
            })
          }
          type="time"
          value={profile.notificationPreference.quietHours.startLocalTime}
        />
      </label>
      <label className={styles.field}>
        <span>Quiet hours end</span>
        <input
          onChange={(event) =>
            onProfileChange({
              ...profile,
              notificationPreference: {
                ...profile.notificationPreference,
                quietHours: {
                  ...profile.notificationPreference.quietHours,
                  endLocalTime: event.currentTarget.value,
                },
              },
            })
          }
          type="time"
          value={profile.notificationPreference.quietHours.endLocalTime}
        />
      </label>
    </div>
  );
}

export function ConsentPanel({
  onEnableWebPush,
  profile,
  pushMessage,
}: {
  onEnableWebPush(): void;
  profile: UserProfile;
  pushMessage: string | null;
}) {
  return (
    <section className={styles.consentPanel}>
      <div>
        <h2>Consent</h2>
        <p>
          Enable push for garden alerts that should reach you outside the app.
          You can pause push delivery above without changing the durable in-app
          history.
        </p>
      </div>
      <button
        className={styles.secondaryButton}
        onClick={onEnableWebPush}
        type="button"
      >
        Enable web push
      </button>
      <p className={styles.metaText}>
        Push permission: {profile.notificationPreference.pushPermission}
        {profile.notificationPreference.pushTokenLastRegisteredAtIso
          ? `, registered ${formatDateTime(
              profile.notificationPreference.pushTokenLastRegisteredAtIso,
            )}`
          : ''}
      </p>
      {pushMessage ? <p className={styles.metaText}>{pushMessage}</p> : null}
    </section>
  );
}

export function SettingsActions({
  error,
  saveStatus,
}: {
  error: string | null;
  saveStatus: 'idle' | 'saved' | 'saving';
}) {
  return (
    <div className={styles.actions}>
      <button
        className={styles.button}
        disabled={saveStatus === 'saving'}
        type="submit"
      >
        {saveStatus === 'saving' ? 'Saving...' : 'Save settings'}
      </button>
      {saveStatus === 'saved' ? (
        <span className={styles.saved}>Saved</span>
      ) : null}
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
