import { useEffect, useRef, useState } from 'react';

import type { Garden } from '../../../domain/gardens/GardenRepository';
import { getSaveFeedback } from '../../../shared/sync/syncFeedback';
import { StatusBadge } from '../../shared/design/DesignPrimitives';
import styles from './PlanTopBar.module.css';

export function PlanTopBar({
  canDiscardDraft,
  canPublish,
  dirty,
  garden,
  isOffline,
  onAddPlants,
  onDiscardDraft,
  onOpenPlot,
  onPublish,
  onReviewProblems,
  onSave,
  saveStatus,
  workspaceState,
}: {
  canDiscardDraft: boolean;
  canPublish: boolean;
  dirty: boolean;
  garden: Garden;
  isOffline: boolean;
  onAddPlants(): void;
  onDiscardDraft(): void;
  onOpenPlot(): void;
  onPublish(): void;
  onReviewProblems(): void;
  onSave(): void;
  saveStatus: 'error' | 'idle' | 'queued' | 'saved' | 'saving';
  workspaceState: 'draft' | 'published' | 'stale';
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const cloudState = getSaveFeedback({
    hasUnsavedChanges: dirty,
    isOffline,
    status: saveStatus,
    surface: 'plan',
  });
  const workspaceStatus = getWorkspaceStatus(workspaceState);
  const workspaceTone: 'danger' | 'neutral' | 'warning' =
    workspaceState === 'stale'
      ? 'danger'
      : workspaceState === 'draft'
        ? 'warning'
        : 'neutral';
  const statusLabel = cloudState.shouldRender
    ? cloudState.label
    : workspaceStatus.label;
  const shouldShowWorkspaceChip = cloudState.shouldRender;
  const statusDetail = cloudState.detail ?? workspaceStatus.detail;
  const statusTitle = [
    statusDetail,
    shouldShowWorkspaceChip ? workspaceStatus.detail : null,
  ]
    .filter((detail): detail is string => Boolean(detail))
    .join(' ');
  const statusTone = cloudState.shouldRender ? cloudState.tone : workspaceTone;

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isMenuOpen]);

  return (
    <header className={styles.topBar} aria-label="Plan actions">
      <div className={styles.context}>
        <div className={styles.titleBlock}>
          <h1>Plan</h1>
          <button
            aria-label="Plot settings"
            className={styles.plotButton}
            onClick={onOpenPlot}
            title="Plot settings"
            type="button"
          >
            {garden.plot.widthFt} ft by {garden.plot.depthFt} ft
          </button>
        </div>
        <div
          aria-label="Plan status"
          aria-live="polite"
          className={styles.statusGroup}
          title={statusTitle}
          role="status"
        >
          <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
          {shouldShowWorkspaceChip ? (
            <StatusBadge tone={workspaceTone}>
              {workspaceStatus.label}
            </StatusBadge>
          ) : null}
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
          aria-label="Review problems"
          onClick={onReviewProblems}
          type="button"
        >
          Review
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
        {canDiscardDraft ? (
          <div className={styles.moreActions} ref={menuRef}>
            <button
              aria-controls="plan-secondary-actions"
              aria-expanded={isMenuOpen}
              aria-label="More plan actions"
              className={styles.iconButton}
              onClick={() => setIsMenuOpen((value) => !value)}
              type="button"
            >
              ...
            </button>
            {isMenuOpen ? (
              <div
                className={styles.secondaryMenu}
                id="plan-secondary-actions"
                role="menu"
              >
                <button
                  className={styles.warningButton}
                  onClick={() => {
                    setIsMenuOpen(false);
                    onDiscardDraft();
                  }}
                  role="menuitem"
                  type="button"
                >
                  Abandon draft
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
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
