import type { Garden } from '../../../domain/gardens/GardenRepository';
import { getSaveFeedback } from '../../../shared/sync/syncFeedback';
import { StatusBadge } from '../../shared/design/DesignPrimitives';
import type { PlanMode } from '../planModes';
import { PlanPrimaryActions } from './PlanPrimaryActions';
import styles from './PlanTopBar.module.css';

export function PlanTopBar({
  activeMode,
  canPublish,
  dirty,
  garden,
  hasSelection,
  isDetailedViewOpen,
  isOffline,
  onAddPlants,
  onOpenDetails,
  onOpenHistory,
  onOpenPlot,
  onOptimize,
  onReviewProblems,
  onSun,
  onPublish,
  onSave,
  problemCount,
  saveStatus,
  workspaceState,
}: {
  activeMode: PlanMode;
  canPublish: boolean;
  dirty: boolean;
  garden: Garden;
  hasSelection: boolean;
  isDetailedViewOpen: boolean;
  isOffline: boolean;
  onAddPlants(): void;
  onOpenDetails(): void;
  onOpenHistory(): void;
  onOpenPlot(): void;
  onOptimize(): void;
  onReviewProblems(): void;
  onSun(): void;
  onPublish(): void;
  onSave(): void;
  problemCount: number;
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

      <PlanPrimaryActions
        activeMode={activeMode}
        hasSelection={hasSelection}
        isDetailedViewOpen={isDetailedViewOpen}
        onAddPlants={onAddPlants}
        onOpenDetails={onOpenDetails}
        onOptimize={onOptimize}
        onReviewProblems={onReviewProblems}
        onSun={onSun}
        problemCount={problemCount}
      />

      <div className={styles.workspaceActions}>
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
