import { TodaySaveState, type TodaySaveStatus } from './TodaySaveState';
import styles from '../TodayPage.module.css';

export function TodayPageHeader({
  error,
  isOffline,
  onRefreshWeatherAndWatering,
  saveStatus,
}: {
  error: string | null;
  isOffline: boolean;
  onRefreshWeatherAndWatering(): void;
  saveStatus: TodaySaveStatus;
}) {
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.kicker}>Today's work</p>
        <h1>Today</h1>
        <p className={styles.summary}>
          Do the watering, harvests, checks, and issue follow-up for the
          selected day. Notes and photos belong in Feed.
        </p>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.secondaryButton}
          onClick={onRefreshWeatherAndWatering}
          type="button"
        >
          Refresh weather &amp; watering schedule
        </button>
        <TodaySaveState
          error={error}
          isOffline={isOffline}
          status={saveStatus}
        />
      </div>
    </header>
  );
}
