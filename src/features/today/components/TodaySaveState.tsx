import { getSaveFeedback } from '../../../shared/sync/syncFeedback';
import { StatusBadge } from '../../shared/design/DesignPrimitives';
import styles from '../TodayPage.module.css';

export type TodaySaveStatus = 'error' | 'idle' | 'queued' | 'saved' | 'saving';

export function TodaySaveState({
  error,
  isOffline,
  status,
}: {
  error: string | null;
  isOffline: boolean;
  status: TodaySaveStatus;
}) {
  const feedback = getSaveFeedback({
    isOffline,
    status,
    surface: 'today',
  });

  if (!feedback.shouldRender && !error) {
    return null;
  }

  return (
    <div className={styles.saveState} aria-live="polite" role="status">
      {feedback.shouldRender ? (
        <StatusBadge tone={feedback.tone}>{feedback.label}</StatusBadge>
      ) : null}
      <span>{status === 'error' && error ? error : feedback.detail}</span>
    </div>
  );
}
