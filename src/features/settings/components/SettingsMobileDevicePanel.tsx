import type { MobileDeviceCapabilities } from '../../../domain/mobile/MobileDeviceService';
import styles from '../SettingsPage.module.css';

export function MobileDevicePanel({
  capabilities,
  localMessage,
  nativePushMessage,
  onEnableLocalNotifications,
  onEnableNativePush,
}: {
  capabilities: MobileDeviceCapabilities;
  localMessage: string | null;
  nativePushMessage: string | null;
  onEnableLocalNotifications(): void;
  onEnableNativePush(): void;
}) {
  return (
    <section className={styles.consentPanel}>
      <div>
        <h2>Device</h2>
        <p className={styles.metaText}>
          {capabilities.isNative
            ? `${formatPlatform(capabilities.platform)} shell active`
            : 'Web/PWA mode active'}
        </p>
        <p className={styles.metaText}>
          Local reminders stay on this device. Native push shares the same push
          preference as web push when the shell supports it.
        </p>
      </div>
      <div className={styles.inlineButtonRow}>
        {capabilities.nativePush ? (
          <button
            className={styles.secondaryButton}
            onClick={onEnableNativePush}
            type="button"
          >
            Enable device push
          </button>
        ) : null}
        {capabilities.localNotifications ? (
          <>
            <button
              className={styles.secondaryButton}
              onClick={onEnableLocalNotifications}
              type="button"
            >
              Enable local alerts
            </button>
          </>
        ) : null}
      </div>
      {nativePushMessage ? (
        <p className={styles.metaText}>{nativePushMessage}</p>
      ) : null}
      {localMessage ? <p className={styles.metaText}>{localMessage}</p> : null}
    </section>
  );
}

function formatPlatform(platform: MobileDeviceCapabilities['platform']) {
  return platform === 'ios'
    ? 'iOS'
    : platform === 'android'
      ? 'Android'
      : 'Web';
}
