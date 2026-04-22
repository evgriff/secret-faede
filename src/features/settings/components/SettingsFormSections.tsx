import type { UserProfile } from '../../../domain/gardens/GardenRepository';
import {
  alertTypes,
  channels,
  createConsent,
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
        <span>carrier messaging fallback phone</span>
        <input
          onChange={(event) =>
            onProfileChange({
              ...profile,
              notificationPreference: {
                ...profile.notificationPreference,
                phoneE164: event.currentTarget.value.trim() || null,
              },
            })
          }
          placeholder="+17345550123"
          value={profile.notificationPreference.phoneE164 ?? ''}
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

export function NotificationChannelFields({
  onProfileChange,
  profile,
}: {
  onProfileChange(profile: UserProfile): void;
  profile: UserProfile;
}) {
  return (
    <fieldset className={styles.channels}>
      <legend>Notification channels</legend>
      <p className={styles.metaText}>
        In-app and push are primary. carrier messaging is optional fallback for frost, heat,
        and severe-weather alerts after consent and production carrier approval.
      </p>
      {channels.map((channel) => (
        <label className={styles.checkbox} key={channel}>
          <input
            checked={profile.notificationPreference.channels[channel]}
            onChange={(event) =>
              onProfileChange({
                ...profile,
                notificationPreference: {
                  ...profile.notificationPreference,
                  channelConsent:
                    channel === 'carrier messaging' || channel === 'email'
                      ? {
                          ...profile.notificationPreference.channelConsent,
                          [channel]: createConsent(
                            event.currentTarget.checked ? 'granted' : 'revoked',
                            new Date().toISOString(),
                          ),
                        }
                      : profile.notificationPreference.channelConsent,
                  channels: {
                    ...profile.notificationPreference.channels,
                    [channel]: event.currentTarget.checked,
                  },
                },
              })
            }
            type="checkbox"
          />
          {formatChannel(channel)}
        </label>
      ))}
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
          Enable push first for garden alerts. carrier messaging fallback is limited to
          high-value frost, heat, and severe-weather messages. Message and data
          rates may apply. Disable carrier messaging here to unsubscribe. Reply STOP to opt
          out or HELP for help if you receive carrier messaging from a live notification provider sender.
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
