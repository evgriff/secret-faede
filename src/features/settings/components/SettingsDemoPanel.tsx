import styles from '../SettingsPage.module.css';

export type DemoModeStatus = 'idle' | 'loading' | 'loaded' | 'reset';

export function SettingsDemoPanel({
  onLoadDemo,
  onResetDemo,
  status,
}: {
  onLoadDemo(): void;
  onResetDemo(): void;
  status: DemoModeStatus;
}) {
  const isLoading = status === 'loading';

  return (
    <section className={styles.demoPanel}>
      <div>
        <p className={styles.kicker}>sample garden</p>
        <h2>Detroit demo garden</h2>
        <p>
          Load a stable garden with beds, crops, warnings, watering, tasks,
          issues, harvests, alert history, and coherent settings.
        </p>
      </div>
      <div className={styles.demoActions}>
        <button
          className={styles.button}
          disabled={isLoading}
          onClick={onLoadDemo}
          type="button"
        >
          {isLoading ? 'Loading demo...' : 'Load demo garden'}
        </button>
        <button
          className={styles.secondaryButton}
          disabled={isLoading}
          onClick={onResetDemo}
          type="button"
        >
          Reset demo
        </button>
      </div>
      {status === 'loaded' ? (
        <p className={styles.saved}>Demo garden loaded.</p>
      ) : null}
      {status === 'reset' ? (
        <p className={styles.saved}>Demo garden reset.</p>
      ) : null}
    </section>
  );
}
