import { getSaveFeedback } from '../../../shared/sync/syncFeedback';
import { StatusBadge } from '../../shared/design/DesignPrimitives';
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
  const feedback = getSaveFeedback({
    isOffline,
    status: saveStatus,
    surface: 'feed',
  });

  if (!feedback.shouldRender && !error) {
    return null;
  }

  return (
    <div className={styles.saveState} aria-live="polite" role="status">
      {feedback.shouldRender ? (
        <StatusBadge tone={feedback.tone}>{feedback.label}</StatusBadge>
      ) : null}
      <span>{saveStatus === 'error' && error ? error : feedback.detail}</span>
    </div>
  );
}
