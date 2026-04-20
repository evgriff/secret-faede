import { useEffect, useState } from 'react';

import { useServices } from '../../app/providers';
import {
  createDefaultUserProfile,
  type NotificationAlertType,
  type NotificationChannel,
  type NotificationConsent,
  type UserProfile,
} from '../../domain/gardens/GardenRepository';
import { LoadingState } from '../../shared/ui/LoadingState';
import { useAuth } from '../auth/auth-context';
import styles from './SettingsPage.module.css';

const channels: NotificationChannel[] = ['inApp', 'push', 'carrier messaging', 'email'];
const alertTypes: NotificationAlertType[] = [
  'watering',
  'frost',
  'heatStress',
  'severeWeather',
  'taskDue',
];

export function SettingsPage() {
  const { state } = useAuth();
  const { notificationService, userProfileRepository } = useServices();
  const authUser = state.user;
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'saving'>(
    'idle',
  );
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');

  useEffect(() => {
    if (!authUser) {
      return;
    }

    let active = true;
    setStatus('loading');
    setError(null);

    void userProfileRepository
      .getUserProfile(authUser.uid, authUser.email)
      .then((savedProfile) => {
        if (!active) {
          return;
        }

        setProfile(
          savedProfile ??
            createDefaultUserProfile(authUser.uid, authUser.email, null),
        );
        setStatus('ready');
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }

        setError(toErrorMessage(loadError, 'Unable to load settings.'));
        setStatus('ready');
      });

    return () => {
      active = false;
    };
  }, [authUser, userProfileRepository]);

  if (status === 'loading' || !profile) {
    return (
      <LoadingState
        message="Loading alert defaults."
        title="Loading settings"
      />
    );
  }

  async function saveSettings() {
    if (!profile) {
      return;
    }

    setSaveStatus('saving');
    setError(null);

    try {
      await userProfileRepository.saveUserProfile({
        ...profile,
        updatedAtIso: new Date().toISOString(),
      });
      setSaveStatus('saved');
    } catch (saveError) {
      setError(toErrorMessage(saveError, 'Unable to save settings.'));
      setSaveStatus('idle');
    }
  }

  async function enableWebPush() {
    if (!authUser || !profile) {
      return;
    }

    setPushMessage(null);

    try {
      const result = await notificationService.registerWebPush(authUser.uid);
      const now = new Date().toISOString();
      const updatedProfile: UserProfile = {
        ...profile,
        notificationPreference: {
          ...profile.notificationPreference,
          channelConsent: {
            ...profile.notificationPreference.channelConsent,
            push: createConsent(
              result.status === 'registered' ? 'granted' : 'denied',
              now,
            ),
          },
          channels: {
            ...profile.notificationPreference.channels,
            push: result.status === 'registered',
          },
          pushPermission:
            result.status === 'registered'
              ? 'granted'
              : result.status === 'denied'
                ? 'denied'
                : result.status === 'unsupported'
                  ? 'unsupported'
                  : 'unknown',
          pushTokenLastRegisteredAtIso: result.tokenRegisteredAtIso,
        },
        updatedAtIso: now,
      };

      setProfile(updatedProfile);
      setPushMessage(result.message);
      await userProfileRepository.saveUserProfile(updatedProfile);
    } catch (pushError) {
      setPushMessage(toErrorMessage(pushError, 'Unable to enable web push.'));
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Settings</h1>
        <p>Alert defaults for weather and watering decisions.</p>
      </header>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void saveSettings();
        }}
      >
        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Alert location</span>
            <input
              onChange={(event) =>
                setProfile({
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
                setProfile({
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
                setProfile({
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
            <span>carrier messaging phone E.164</span>
            <input
              onChange={(event) =>
                setProfile({
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
                setProfile({
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
                setProfile({
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

        <fieldset className={styles.channels}>
          <legend>Notification channels</legend>
          {channels.map((channel) => (
            <label className={styles.checkbox} key={channel}>
              <input
                checked={profile.notificationPreference.channels[channel]}
                onChange={(event) =>
                  setProfile({
                    ...profile,
                    notificationPreference: {
                      ...profile.notificationPreference,
                      channelConsent:
                        channel === 'carrier messaging' || channel === 'email'
                          ? {
                              ...profile.notificationPreference.channelConsent,
                              [channel]: createConsent(
                                event.currentTarget.checked
                                  ? 'granted'
                                  : 'revoked',
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

        <fieldset className={styles.channels}>
          <legend>Alert types</legend>
          {alertTypes.map((alertType) => (
            <label className={styles.checkbox} key={alertType}>
              <input
                checked={profile.notificationPreference.alertTypes[alertType]}
                onChange={(event) =>
                  setProfile({
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

        <div className={styles.grid}>
          <label className={styles.field}>
            <span>Quiet hours start</span>
            <input
              onChange={(event) =>
                setProfile({
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
                setProfile({
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

        <section className={styles.consentPanel}>
          <div>
            <h2>Consent</h2>
            <p>
              Enable only the channels you want. carrier messaging alerts are transactional
              garden-management messages about watering, frost, heat, severe
              weather, and due tasks. Message and data rates may apply. Disable
              carrier messaging here to unsubscribe.
            </p>
          </div>
          <button
            className={styles.secondaryButton}
            onClick={() => void enableWebPush()}
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
          {pushMessage ? (
            <p className={styles.metaText}>{pushMessage}</p>
          ) : null}
        </section>

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
      </form>
    </section>
  );
}

function readNumber(value: string, fallback: number) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatChannel(channel: NotificationChannel) {
  if (channel === 'inApp') {
    return 'In-app';
  }

  return channel.toUpperCase();
}

function formatAlertType(alertType: NotificationAlertType) {
  switch (alertType) {
    case 'frost':
      return 'Frost';
    case 'heatStress':
      return 'Heat stress';
    case 'severeWeather':
      return 'Severe weather';
    case 'taskDue':
      return 'Task due';
    case 'watering':
      return 'Watering';
  }
}

function createConsent(
  status: NotificationConsent['status'],
  now: string,
): NotificationConsent {
  return {
    consentCopyVersion: '2026-04-20',
    grantedAtIso: status === 'granted' ? now : null,
    revokedAtIso: status === 'revoked' || status === 'denied' ? now : null,
    status,
  };
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
