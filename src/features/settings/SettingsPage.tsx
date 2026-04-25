import { useEffect, useState } from 'react';

import { useServices } from '../../app/providers';
import {
  createDefaultUserProfile,
  type Garden,
  type UserProfile,
} from '../../domain/gardens/GardenRepository';
import { LoadingState } from '../../shared/ui/LoadingState';
import { useAuth } from '../auth/auth-context';
import { rebuildGardenWateringFromLatestSnapshot } from '../garden/wateringScheduleRefresh';
import { NotificationCenter } from './components/NotificationCenter';
import { SettingsDemoPanel } from './components/SettingsDemoPanel';
import {
  AlertDefaultsFields,
  AlertTypeFields,
  ConsentPanel,
  NotificationDeliveryFields,
  QuietHoursFields,
  SettingsActions,
} from './components/SettingsFormSections';
import { MobileDevicePanel } from './components/SettingsMobileDevicePanel';
import { createConsent, toErrorMessage } from './settingsHelpers';
import { useSettingsDemoMode } from './useSettingsDemoMode';
import styles from './SettingsPage.module.css';

export function SettingsPage() {
  const { state } = useAuth();
  const {
    gardenRepository,
    mobileDeviceService,
    notificationService,
    userProfileRepository,
  } = useServices();
  const authUser = state.user;
  const [error, setError] = useState<string | null>(null);
  const [garden, setGarden] = useState<Garden | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'saving'>(
    'idle',
  );
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [nativePushMessage, setNativePushMessage] = useState<string | null>(
    null,
  );
  const [localNotificationMessage, setLocalNotificationMessage] = useState<
    string | null
  >(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const mobileCapabilities = mobileDeviceService.getCapabilities();
  const demoMode = useSettingsDemoMode({
    authUser,
    garden,
    profile,
    setGarden,
    setPageError: setError,
    setProfile,
    setSaveStatus,
  });

  useEffect(() => {
    if (!authUser) {
      return;
    }

    let active = true;
    setStatus('loading');
    setError(null);

    void Promise.all([
      userProfileRepository.getUserProfile(authUser.uid, authUser.email),
      gardenRepository.getGarden(authUser.uid),
    ])
      .then(([savedProfile, savedGarden]) => {
        if (!active) {
          return;
        }

        setGarden(savedGarden);
        setProfile(
          savedProfile ??
            createDefaultUserProfile(authUser.uid, authUser.email),
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
  }, [authUser, gardenRepository, userProfileRepository]);

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
      const updatedProfile = {
        ...profile,
        updatedAtIso: new Date().toISOString(),
      };

      await userProfileRepository.saveUserProfile(updatedProfile);
      setProfile(updatedProfile);

      if (garden) {
        try {
          const updatedGarden = rebuildGardenWateringFromLatestSnapshot(
            garden,
            {
              now: new Date(),
              preserveDueWindowStart: false,
              profile: updatedProfile,
            },
          );

          await gardenRepository.saveGarden(updatedGarden);
          setGarden(updatedGarden);
        } catch (gardenSaveError) {
          setError(
            toErrorMessage(
              gardenSaveError,
              'Settings saved, but watering schedule could not be refreshed.',
            ),
          );
        }
      }

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

  async function enableNativePush() {
    if (!authUser || !profile) {
      return;
    }

    setNativePushMessage(null);

    try {
      const result = await notificationService.registerNativePush(authUser.uid);
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
      setNativePushMessage(result.message);
      await userProfileRepository.saveUserProfile(updatedProfile);
    } catch (pushError) {
      setNativePushMessage(
        toErrorMessage(pushError, 'Unable to enable native push.'),
      );
    }
  }

  async function enableLocalNotifications() {
    try {
      const result =
        await mobileDeviceService.requestLocalNotificationPermission();

      setLocalNotificationMessage(result.message);
    } catch (notificationError) {
      setLocalNotificationMessage(
        toErrorMessage(
          notificationError,
          'Unable to enable local notifications.',
        ),
      );
    }
  }

  async function updateNotificationLog(
    logId: string,
    values: Partial<NonNullable<Garden['notificationLogs'][number]>>,
  ) {
    if (!garden) {
      return;
    }

    const updatedGarden: Garden = {
      ...garden,
      notificationLogs: garden.notificationLogs.map((log) =>
        log.id === logId ? { ...log, ...values } : log,
      ),
      updatedAtIso: new Date().toISOString(),
    };

    setGarden(updatedGarden);

    try {
      await gardenRepository.saveGarden(updatedGarden);
    } catch (saveError) {
      setError(
        toErrorMessage(saveError, 'Unable to update notification status.'),
      );
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <p className={styles.kicker}>Defaults</p>
        <h1>Settings</h1>
        <p>Set time, location, alerts, and sample-garden controls.</p>
      </header>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void saveSettings();
        }}
      >
        <AlertDefaultsFields onProfileChange={setProfile} profile={profile} />

        <NotificationDeliveryFields
          onProfileChange={setProfile}
          profile={profile}
        />

        <AlertTypeFields onProfileChange={setProfile} profile={profile} />

        <QuietHoursFields onProfileChange={setProfile} profile={profile} />

        <ConsentPanel
          onEnableWebPush={() => void enableWebPush()}
          profile={profile}
          pushMessage={pushMessage}
        />

        <MobileDevicePanel
          capabilities={mobileCapabilities}
          localMessage={localNotificationMessage}
          nativePushMessage={nativePushMessage}
          onEnableLocalNotifications={() => void enableLocalNotifications()}
          onEnableNativePush={() => void enableNativePush()}
        />

        <details className={styles.disclosure}>
          <summary>Recent alerts</summary>
          <p className={styles.metaText}>
            Delivery history stays available here when you need it, but this
            route is for defaults first.
          </p>
          <NotificationCenter
            logs={garden?.notificationLogs ?? []}
            onAcknowledge={(logId) =>
              void updateNotificationLog(logId, {
                acknowledgedAtIso: new Date().toISOString(),
                snoozedUntilIso: null,
              })
            }
            onDismiss={(logId) =>
              void updateNotificationLog(logId, {
                dismissedAtIso: new Date().toISOString(),
                snoozedUntilIso: null,
              })
            }
            onSnooze={(logId) =>
              void updateNotificationLog(logId, {
                snoozedUntilIso: new Date(
                  Date.now() + 24 * 60 * 60 * 1000,
                ).toISOString(),
              })
            }
          />
        </details>

        <details
          className={styles.demoDisclosure}
          data-testid="sample-garden-disclosure"
          open={demoMode.state.isActive}
        >
          <summary>Sample garden</summary>
          <SettingsDemoPanel
            canExit={demoMode.state.canExit}
            error={demoMode.state.error}
            isActive={demoMode.state.isActive}
            isBusy={demoMode.state.isBusy}
            message={demoMode.state.message}
            onExitDemo={() => void demoMode.exitDemoGarden()}
            onLoadDemo={() => void demoMode.loadDemoGarden('loaded')}
            onResetDemo={() => void demoMode.loadDemoGarden('reset')}
            status={demoMode.state.status}
          />
        </details>

        <SettingsActions error={error} saveStatus={saveStatus} />
      </form>
    </section>
  );
}
