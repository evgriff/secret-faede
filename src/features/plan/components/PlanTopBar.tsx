import type { Garden } from '../../../domain/gardens/GardenRepository';
import { getSaveFeedback } from '../../../shared/sync/syncFeedback';
import { StatusBadge } from '../../shared/design/DesignPrimitives';
import styles from './PlanTopBar.module.css';

export function PlanTopBar({
  canPublish,
  dirty,
  garden,
  isOptimizeActive,
  isOffline,
  onOpenChoosePlants,
  onOpenHistory,
  onOpenPlot,
  onOptimize,
  onPublish,
  onSave,
  saveStatus,
  workspaceState,
}: {
  canPublish: boolean;
  dirty: boolean;
  garden: Garden;
  isOptimizeActive: boolean;
  isOffline: boolean;
  onOpenChoosePlants(): void;
  onOpenHistory(): void;
  onOpenPlot(): void;
  onOptimize(): void;
  onPublish(): void;
  onSave(): void;
  saveStatus: 'error' | 'idle' | 'queued' | 'saved' | 'saving';
  workspaceState: 'draft' | 'published' | 'stale';
}) {
  const cloudState = getSaveFeedback({
    hasUnsavedChanges: dirty,
    isOffline,
    status: saveStatus,
    surface: 'plan',
  });
  const workspaceStatus = getWorkspaceStatus(workspaceState);

  return (
    <header className={styles.topBar} aria-label="Plan actions">
      <div className={styles.context}>
        <div className={styles.titleBlock}>
          <h1>Plan</h1>
          <span>
            {garden.plot.widthFt} ft by {garden.plot.depthFt} ft
          </span>
        </div>
        <div
          aria-label="Plan sync state"
          aria-live="polite"
          className={styles.statusGroup}
          role="status"
        >
          {cloudState.shouldRender ? (
            <StatusBadge tone={cloudState.tone}>{cloudState.label}</StatusBadge>
          ) : null}
          <StatusBadge tone={workspaceStatus.tone}>
            {workspaceStatus.label}
          </StatusBadge>
          {cloudState.detail ? (
            <span className={styles.syncHint}>{cloudState.detail}</span>
          ) : null}
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={`${styles.secondaryButton} ${styles.mobileHiddenAction}`}
          onClick={onOpenChoosePlants}
          title="Choose plants"
          type="button"
          aria-label="Choose plants"
        >
          Crops
        </button>
        <button
          aria-pressed={isOptimizeActive}
          className={`${styles.secondaryButton} ${
            isOptimizeActive ? styles.activeButton : ''
          } ${styles.mobileHiddenAction}`}
          onClick={onOptimize}
          type="button"
        >
          Optimize
        </button>
        <button
          className={styles.secondaryButton}
          onClick={onOpenPlot}
          title="Plot settings"
          type="button"
          aria-label="Plot settings"
        >
          Plot
        </button>
        <button
          className={styles.secondaryButton}
          onClick={onOpenHistory}
          type="button"
        >
          History
        </button>
        {dirty ? (
          <button
            className={styles.primaryButton}
            disabled={saveStatus === 'saving'}
            onClick={onSave}
            type="button"
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save'}
          </button>
        ) : null}
        <button
          className={styles.primaryButton}
          disabled={!canPublish || saveStatus === 'saving'}
          onClick={onPublish}
          type="button"
        >
          Publish
        </button>
      </div>
    </header>
  );
}

function getWorkspaceStatus(workspaceState: 'draft' | 'published' | 'stale') {
  if (workspaceState === 'stale') {
    return { label: 'Conflict', tone: 'danger' as const };
  }

  if (workspaceState === 'draft') {
    return { label: 'Draft differs', tone: 'warning' as const };
  }

  return { label: 'Matches published', tone: 'success' as const };
}
