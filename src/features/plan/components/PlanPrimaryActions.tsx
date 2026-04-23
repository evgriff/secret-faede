import type { PlanMode } from '../planModes';
import styles from './PlanPrimaryActions.module.css';

export function PlanPrimaryActions({
  activeMode,
  hasSelection,
  isDetailedViewOpen,
  onAddPlants,
  onOpenDetails,
  onOptimize,
  onReviewProblems,
  onSun,
  problemCount,
}: {
  activeMode: PlanMode;
  hasSelection: boolean;
  isDetailedViewOpen: boolean;
  onAddPlants(): void;
  onOpenDetails(): void;
  onOptimize(): void;
  onReviewProblems(): void;
  onSun(): void;
  problemCount: number;
}) {
  return (
    <nav className={styles.actions} aria-label="Primary plan actions">
      <button
        aria-label="Add Plants"
        className={`${styles.actionButton} ${styles.primaryAction}`}
        onClick={onAddPlants}
        type="button"
      >
        Add Plants
      </button>
      <button
        aria-label="Review Problems"
        aria-pressed={activeMode === 'optimize'}
        className={`${styles.actionButton} ${
          activeMode === 'optimize' ? styles.activeAction : ''
        }`}
        onClick={onReviewProblems}
        type="button"
      >
        <span>Review Problems</span>
        {problemCount > 0 ? (
          <span className={styles.countBadge} aria-hidden="true">
            {problemCount}
          </span>
        ) : null}
      </button>
      <button
        aria-label="Optimize"
        className={styles.actionButton}
        onClick={onOptimize}
        type="button"
      >
        Optimize
      </button>
      <button
        aria-label="Sun"
        aria-pressed={activeMode === 'sun'}
        className={`${styles.actionButton} ${
          activeMode === 'sun' ? styles.activeAction : ''
        }`}
        onClick={onSun}
        type="button"
      >
        Sun
      </button>
      <button
        aria-label={`Detailed View ${isDetailedViewOpen ? 'on' : 'off'}`}
        aria-pressed={isDetailedViewOpen}
        className={`${styles.actionButton} ${
          isDetailedViewOpen ? styles.activeAction : ''
        }`}
        disabled={!hasSelection}
        onClick={onOpenDetails}
        title="Toggle Detailed View"
        type="button"
      >
        Detailed View
      </button>
    </nav>
  );
}
