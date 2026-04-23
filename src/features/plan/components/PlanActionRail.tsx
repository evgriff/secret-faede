import { useEffect, useRef, useState } from 'react';

import type { PlanMode } from '../planModes';
import styles from './PlanActionRail.module.css';

const buildModes: Array<{
  description: string;
  label: string;
  mode: Extract<PlanMode, 'plant' | 'structure'>;
}> = [
  {
    description: 'Manual crop placement',
    label: 'Plant',
    mode: 'plant',
  },
  {
    description: 'Beds, paths, trellises',
    label: 'Structure',
    mode: 'structure',
  },
];

export function PlanActionRail({
  activeMode,
  avoidFocusCard,
  setActiveMode,
}: {
  activeMode: PlanMode;
  avoidFocusCard: boolean;
  setActiveMode(mode: PlanMode): void;
}) {
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const launcherRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isLauncherOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !launcherRef.current?.contains(event.target)
      ) {
        setIsLauncherOpen(false);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);

    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isLauncherOpen]);

  function handleBuildMode(mode: PlanMode) {
    setActiveMode(mode);
    setIsLauncherOpen(false);
  }

  return (
    <aside
      className={`${styles.rail} ${avoidFocusCard ? styles.railAvoidFocus : ''}`}
      aria-label="Build tools"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setIsLauncherOpen(false);
        }
      }}
      ref={launcherRef}
    >
      <div className={styles.launcherBar}>
        <button
          aria-controls="plan-build-launcher"
          aria-expanded={isLauncherOpen}
          aria-label="Open build tools"
          className={styles.launcherButton}
          onClick={() => setIsLauncherOpen((value) => !value)}
          type="button"
        >
          <span aria-hidden="true">+</span>
          <strong>Build</strong>
        </button>
      </div>

      {isLauncherOpen ? (
        <div
          className={styles.launcherPanel}
          id="plan-build-launcher"
          aria-label="Build tool launcher"
        >
          <div className={styles.panelHeader}>
            <span>Build the plot</span>
            <button
              aria-label="Close build tools"
              onClick={() => setIsLauncherOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>
          <div className={styles.toolGrid}>
            {buildModes.map((entry) => (
              <button
                aria-label={entry.label}
                aria-pressed={activeMode === entry.mode}
                className={`${styles.toolButton} ${
                  activeMode === entry.mode ? styles.activeMode : ''
                }`}
                key={entry.mode}
                onClick={() => handleBuildMode(entry.mode)}
                title={entry.description}
                type="button"
              >
                <span>{entry.label}</span>
                <small>{entry.description}</small>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
