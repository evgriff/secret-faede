import pageStyles from '../SettingsPage.module.css';
import type { DemoModeStatus } from '../settingsDemoMode';
import {
  sampleGardenActiveLabel,
  sampleGardenRestoreDisabledMessage,
  sampleGardenRestoreLabel,
  sampleGardenRestoreTitle,
} from '../settingsDemoSession';
import styles from './SettingsDemoPanel.module.css';

export function SettingsDemoPanel({
  canExit,
  canUseDemo,
  error,
  isActive,
  isBusy,
  message,
  onExitDemo,
  onLoadDemo,
  onResetDemo,
  status,
}: {
  canExit: boolean;
  canUseDemo: boolean;
  error: string | null;
  isActive: boolean;
  isBusy: boolean;
  message: string | null;
  onExitDemo(): void;
  onLoadDemo(): void;
  onResetDemo(): void;
  status: DemoModeStatus;
}) {
  const restoreHelpText = !canUseDemo
    ? 'The resettable sample is restricted to Primary Gardener on the production workspace.'
    : isActive
      ? canExit
        ? `Reset returns the sample to its seeded baseline. ${sampleGardenRestoreLabel} restores what was backed up on this device.`
        : sampleGardenRestoreDisabledMessage
      : 'Open the sample only when you want a clean example to explore without touching your garden.';

  return (
    <section
      aria-label="Sample garden"
      className={styles.panel}
      data-demo-state={isActive ? 'demo' : 'real'}
    >
      <div>
        <p className={pageStyles.kicker}>Sample garden</p>
        <h2>Open a resettable sample garden</h2>
        <p>
          Your saved garden stays primary. Primary Gardener can open the Detroit
          sample when a clean example is needed on this device; the current
          garden is backed up first so it can be restored.
        </p>
      </div>
      <div className={styles.statusLine}>
        <strong>
          {isActive
            ? sampleGardenActiveLabel
            : canUseDemo
              ? 'Your garden is active.'
              : 'Sample garden unavailable.'}
        </strong>
        <span>{restoreHelpText}</span>
      </div>
      <div className={styles.actions}>
        <button
          className={pageStyles.button}
          disabled={isBusy || !canUseDemo}
          onClick={onLoadDemo}
          type="button"
        >
          {isBusy && status === 'loading'
            ? 'Opening sample...'
            : 'Open sample garden'}
        </button>
        <button
          className={pageStyles.secondaryButton}
          disabled={isBusy || !canUseDemo}
          onClick={onResetDemo}
          type="button"
        >
          Reset sample garden
        </button>
        <button
          className={pageStyles.secondaryButton}
          disabled={isBusy || !canExit || !canUseDemo}
          onClick={onExitDemo}
          title={
            canExit
              ? sampleGardenRestoreTitle.available
              : sampleGardenRestoreTitle.unavailable
          }
          type="button"
        >
          {sampleGardenRestoreLabel}
        </button>
      </div>
      {message ? <p className={pageStyles.saved}>{message}</p> : null}
      {error ? <p className={pageStyles.error}>{error}</p> : null}
      {isActive && !canExit ? (
        <p className={styles.restoreWarning}>
          {sampleGardenRestoreLabel} stays disabled until this device has a
          saved garden backup to restore.
        </p>
      ) : null}
      {status === 'exited' ? (
        <p className={styles.restoreNote}>
          The sample garden has been replaced by your garden from this device.
        </p>
      ) : null}
    </section>
  );
}
