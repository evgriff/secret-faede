import { TodaySaveState, type TodaySaveStatus } from './TodaySaveState';
import styles from '../TodayPage.module.css';

export function TodayPageHeader({
  error,
  isOffline,
  onSyncSchedule,
  openIssueCount,
  saveStatus,
  selectedTaskCount,
  wateringCount,
}: {
  error: string | null;
  isOffline: boolean;
  onSyncSchedule(): void;
  openIssueCount: number;
  saveStatus: TodaySaveStatus;
  selectedTaskCount: number;
  wateringCount: number;
}) {
  return (
    <header className={styles.header}>
      <div>
        <p className={styles.kicker}>Garden operations</p>
        <h1>Today</h1>
        <p className={styles.summary}>
          {selectedTaskCount} tasks, {wateringCount} watering, {openIssueCount}{' '}
          open issues
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
