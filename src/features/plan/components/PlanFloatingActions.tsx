import { planModes, type PlanMode } from '../planModes';
import styles from './PlanFloatingActions.module.css';

export function PlanFloatingActions({
  activeMode,
  isOptimizeActive,
  onOpenChoosePlants,
  onOptimize,
  setActiveMode,
}: {
  activeMode: PlanMode;
  isOptimizeActive: boolean;
  onOpenChoosePlants(): void;
  onOptimize(): void;
  setActiveMode(mode: PlanMode): void;
}) {
  return (
    <div className={styles.floatingActions} aria-label="Primary plan actions">
      <button
        aria-label="Choose plants"
        onClick={onOpenChoosePlants}
        type="button"
      >
        Crops
      </button>
      <button
        aria-label="Optimize"
        aria-pressed={isOptimizeActive}
        onClick={onOptimize}
        type="button"
      >
        Review
      </button>
      {planModes.filter(isFloatingMode).map((entry) => (
        <button
          aria-label={entry.label}
          aria-pressed={activeMode === entry.mode}
          key={entry.mode}
          onClick={() => setActiveMode(entry.mode)}
          type="button"
        >
          {getFloatingLabel(entry.mode)}
        </button>
      ))}
    </div>
  );
}

function isFloatingMode(entry: (typeof planModes)[number]) {
  return entry.mode !== 'optimize';
}

function getFloatingLabel(mode: PlanMode) {
  switch (mode) {
    case 'measure':
      return 'Ruler';
    case 'plant':
      return 'Plant';
    case 'select':
      return 'Select';
    case 'structure':
      return 'Build';
    case 'sun':
      return 'Sun';
    case 'optimize':
      return 'Review';
  }
}
