import styles from '../LogPage.module.css';

export type LogSaveStatus = 'error' | 'idle' | 'queued' | 'saved' | 'saving';

export function LogSaveState({
  error,
  isOffline,
  saveStatus,
}: {
  error: string | null;
  isOffline: boolean;
  saveStatus: LogSaveStatus;
}) {
  return (
    <div className={styles.saveState}>
      {saveStatus === 'saving' ? <span>Saving...</span> : null}
      {saveStatus === 'saved' ? <span>Saved</span> : null}
      {saveStatus === 'queued' ? <span>Queued locally</span> : null}
      {isOffline && saveStatus !== 'queued' ? (
        <span>Offline notes and harvests will queue</span>
      ) : null}
      {saveStatus === 'error' && error ? (
        <span role="alert">{error}</span>
      ) : null}
    </div>
  );
}
