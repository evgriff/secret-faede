import pageStyles from '../SettingsPage.module.css';
import type { DemoModeStatus } from '../settingsDemoMode';
import styles from './SettingsDemoPanel.module.css';

export function SettingsDemoPanel({
  canExit,
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
  error: string | null;
  isActive: boolean;
  isBusy: boolean;
  message: string | null;
  onExitDemo(): void;
  onLoadDemo(): void;
  onResetDemo(): void;
  status: DemoModeStatus;
}) {
  return (
    <section
      aria-label="Sample garden"
      className={styles.panel}
      data-demo-state={isActive ? 'demo' : 'real'}
    >
      <div>
        <p className={pageStyles.kicker}>Sample garden</p>
        <h2>Open a resettable garden example</h2>
        <p>
          Your saved garden stays primary. Open the Detroit sample only when
          you need a clean example on this device; the current garden is backed
          up first so you can return to it.
        </p>
      </div>
      <div className={styles.statusLine}>
        <strong>
          {isActive ? 'Sample garden active.' : 'Saved garden active.'}
        </strong>
        <span>
          {isActive
            ? 'Reset returns the example to its seeded baseline. Return to saved garden restores what was backed up on this device.'
            : 'Open the sample only when you want a clean example to explore without touching the saved garden.'}
        </span>
      </div>
      <div className={styles.actions}>
        <button
          className={pageStyles.button}
          disabled={isBusy}
          onClick={onLoadDemo}
          type="button"
        >
          {isBusy && status === 'loading'
            ? 'Opening sample...'
            : 'Open sample garden'}
        </button>
        <button
          className={pageStyles.secondaryButton}
          disabled={isBusy}
          onClick={onResetDemo}
          type="button"
        >
          Reset sample garden
        </button>
        <button
          className={pageStyles.secondaryButton}
          disabled={isBusy || !canExit}
          onClick={onExitDemo}
          title={
            canExit
              ? 'Restore the garden saved before opening the sample.'
              : 'No saved garden backup is available in this browser.'
          }
          type="button"
        >
          Return to saved garden
        </button>
      </div>
      {message ? <p className={pageStyles.saved}>{message}</p> : null}
      {error ? <p className={pageStyles.error}>{error}</p> : null}
      {status === 'exited' ? (
        <p className={styles.restoreNote}>
          The sample garden has been replaced by the saved garden from this
          browser.
        </p>
      ) : null}
    </section>
  );
}
