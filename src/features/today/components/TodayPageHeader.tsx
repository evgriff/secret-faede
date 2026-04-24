import { TodaySaveState, type TodaySaveStatus } from './TodaySaveState';
import styles from '../TodayPage.module.css';

export function TodayPageHeader({
  error,
  isOffline,
  onSyncSchedule,
  saveStatus,
}: {
  error: string | null;
  isOffline: boolean;
  onSyncSchedule(): void;
  saveStatus: TodaySaveStatus;
}) {
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.kicker}>Today's work</p>
        <h1>Today</h1>
        <p className={styles.summary}>
          Watering, checks, harvests, and field notes for the selected day.
        </p>
      </div>
      <div className={styles.actions}>
        <button
          className={styles.secondaryButton}
          onClick={onSyncSchedule}
          type="button"
        >
          Sync schedule
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
