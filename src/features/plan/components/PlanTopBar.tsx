import type { Garden } from '../../../domain/gardens/GardenRepository';
import { getSaveFeedback } from '../../../shared/sync/syncFeedback';
import { StatusBadge } from '../../shared/design/DesignPrimitives';
import styles from './PlanTopBar.module.css';

export function PlanTopBar({
  canPublish,
  dirty,
  garden,
  isOffline,
  onAddPlants,
  onOpenPlot,
  onPublish,
  onReviewProblems,
  onSave,
  saveStatus,
  workspaceState,
}: {
  canPublish: boolean;
  dirty: boolean;
  garden: Garden;
  isOffline: boolean;
  onAddPlants(): void;
  onOpenPlot(): void;
  onPublish(): void;
  onReviewProblems(): void;
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
          <div className={styles.titleRow}>
            <h1>Plan</h1>
            <button
              className={styles.plotButton}
              onClick={onOpenPlot}
              title="Plot settings"
              type="button"
            >
              Plot settings
            </button>
          </div>
          <span>
            {garden.plot.widthFt} ft by {garden.plot.depthFt} ft
          </span>
        </div>
        <div
          aria-label="Plan status"
          aria-live="polite"
          className={styles.statusGroup}
          role="status"
        >
          {cloudState.shouldRender ? (
            <StatusBadge tone={cloudState.tone}>{cloudState.label}</StatusBadge>
          ) : null}
          <div className={styles.statusCopy}>
            <strong>{workspaceStatus.label}</strong>
            <span>{cloudState.detail ?? workspaceStatus.detail}</span>
          </div>
        </div>
      </div>

      <nav
        className={styles.workspaceActions}
        aria-label="Primary plan actions"
      >
        <button
          className={styles.primaryButton}
          onClick={onAddPlants}
          type="button"
        >
          Add plants
        </button>
        <button
          className={styles.secondaryButton}
          onClick={onReviewProblems}
          type="button"
        >
          Review problems
        </button>
        {dirty ? (
          <button
            className={styles.secondaryButton}
            disabled={saveStatus === 'saving'}
            onClick={onSave}
            type="button"
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save'}
          </button>
        ) : null}
        <button
          className={`${styles.secondaryButton} ${styles.publishButton}`}
          disabled={!canPublish || saveStatus === 'saving'}
          onClick={onPublish}
          type="button"
        >
          Publish
        </button>
      </nav>
    </header>
  );
}

function getWorkspaceStatus(workspaceState: 'draft' | 'published' | 'stale') {
  if (workspaceState === 'stale') {
    return {
      detail: 'The published garden changed after this draft started.',
      label: 'Publish conflict',
    };
  }

  if (workspaceState === 'draft') {
    return {
      detail: 'This private draft differs from the published garden.',
      label: 'Private draft',
    };
  }

  return {
    detail: 'This plan matches the published garden.',
    label: 'Published',
  };
}
