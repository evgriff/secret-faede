import { planModes, type PlanMode } from '../planModes';
import styles from './PlanActionRail.module.css';

export function PlanActionRail({
  activeMode,
  setActiveMode,
}: {
  activeMode: PlanMode;
  setActiveMode(mode: PlanMode): void;
}) {
  return (
    <aside className={styles.rail} aria-label="Plan tools">
      <div className={styles.modeStack}>
        {planModes.filter(isRailMode).map((entry) => (
          <button
            aria-label={entry.label}
            aria-pressed={activeMode === entry.mode}
            className={`${styles.modeButton} ${
              activeMode === entry.mode ? styles.activeMode : ''
            }`}
            key={entry.mode}
            onClick={() => setActiveMode(entry.mode)}
            title={`${entry.label} (${entry.keyboard})`}
            type="button"
          >
            <span>{getRailLabel(entry.mode)}</span>
            <small>{entry.keyboard}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}

function isRailMode(entry: (typeof planModes)[number]) {
  return entry.mode !== 'optimize';
}

function getRailLabel(mode: PlanMode) {
  switch (mode) {
    case 'measure':
      return 'Ruler';
    case 'optimize':
      return 'Opt';
    case 'plant':
      return 'Plant';
    case 'select':
      return 'Select';
    case 'structure':
      return 'Build';
    case 'sun':
      return 'Sun';
  }
}
