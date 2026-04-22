import type { Garden } from '../../../domain/gardens/GardenRepository';
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
  const cloudState = getCloudState({ dirty, isOffline, saveStatus });
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
        <div className={styles.statusGroup} aria-label="Plan sync state">
          <StatusBadge tone={isOffline ? 'warning' : 'success'}>
            {isOffline ? 'Offline' : 'Online'}
          </StatusBadge>
          <StatusBadge tone={cloudState.tone}>{cloudState.label}</StatusBadge>
          <StatusBadge tone={workspaceStatus.tone}>
            {workspaceStatus.label}
          </StatusBadge>
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

function getCloudState({
  dirty,
  isOffline,
  saveStatus,
}: {
  dirty: boolean;
  isOffline: boolean;
  saveStatus: 'error' | 'idle' | 'queued' | 'saved' | 'saving';
}) {
  if (saveStatus === 'error') {
    return { label: 'Save error', tone: 'danger' as const };
  }

  if (saveStatus === 'saving') {
    return { label: 'Saving', tone: 'neutral' as const };
  }

  if (saveStatus === 'queued') {
    return { label: 'Queued', tone: 'warning' as const };
  }

  if (dirty) {
    return {
      label: isOffline ? 'Local edits' : 'Unsaved',
      tone: 'warning' as const,
    };
  }

  if (saveStatus === 'saved') {
    return { label: 'Saved', tone: 'success' as const };
  }

  return { label: 'Cloud ready', tone: 'success' as const };
}
