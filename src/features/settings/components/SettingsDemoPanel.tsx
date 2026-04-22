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
      aria-label="sample garden"
      className={styles.panel}
      data-demo-state={isActive ? 'demo' : 'real'}
    >
      <div>
        <p className={pageStyles.kicker}>sample garden</p>
        <h2>Real garden or seeded demo</h2>
        <p>
          Real garden is the default. Enter the Detroit demo only for
          walkthroughs; this browser saves the current garden first so Exit demo
          can restore it.
        </p>
      </div>
      <div className={styles.statusLine}>
        <strong>
          {isActive ? 'Demo workspace active.' : 'Real garden workspace.'}
        </strong>
        <span>
          {isActive
            ? 'Reset returns this walkthrough to the seeded baseline. Exit demo restores the saved real garden.'
            : 'Enter demo for a release walkthrough, then exit back to this real garden.'}
        </span>
      </div>
      <div className={styles.actions}>
        <button
          className={pageStyles.button}
          disabled={isBusy}
          onClick={onLoadDemo}
          type="button"
        >
          {isBusy && status === 'loading' ? 'Entering demo...' : 'Enter demo'}
        </button>
        <button
          className={pageStyles.secondaryButton}
          disabled={isBusy}
          onClick={onResetDemo}
          type="button"
        >
          Reset seeded demo
        </button>
        <button
          className={pageStyles.secondaryButton}
          disabled={isBusy || !canExit}
          onClick={onExitDemo}
          title={
            canExit
              ? 'Restore the garden saved before demo mode.'
              : 'No real garden backup is available in this browser.'
          }
          type="button"
        >
          Exit demo
        </button>
      </div>
      {message ? <p className={pageStyles.saved}>{message}</p> : null}
      {error ? <p className={pageStyles.error}>{error}</p> : null}
      {status === 'exited' ? (
        <p className={styles.restoreNote}>
          The seeded demo has been replaced by the garden saved before demo
          mode.
        </p>
      ) : null}
    </section>
  );
}
