import { useEffect, useRef, useState } from 'react';

import { planModes, type PlanMode } from '../planModes';
import styles from './PlanActionRail.module.css';

export function PlanActionRail({
  activeMode,
  hasSelection,
  isPanelOpen,
  onOpenChoosePlants,
  onOpenInspector,
  onOptimize,
  setActiveMode,
}: {
  activeMode: PlanMode;
  hasSelection: boolean;
  isPanelOpen: boolean;
  onOpenChoosePlants(): void;
  onOpenInspector(): void;
  onOptimize(): void;
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

  function handleToolMode(mode: PlanMode) {
    if (mode === 'optimize') {
      onOptimize();
    } else {
      setActiveMode(mode);
    }

    setIsLauncherOpen(false);
  }

  function handleChoosePlants() {
    onOpenChoosePlants();
    setIsLauncherOpen(false);
  }

  function handleInspect() {
    onOpenInspector();
    setIsLauncherOpen(false);
  }

  return (
    <aside
      className={styles.rail}
      aria-label="Plan tools"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setIsLauncherOpen(false);
        }
      }}
      ref={launcherRef}
    >
      <div className={styles.launcherBar}>
        <button
          aria-controls="plan-tool-launcher"
          aria-expanded={isLauncherOpen}
          aria-label="Open Plan tools"
          className={styles.launcherButton}
          onClick={() => setIsLauncherOpen((value) => !value)}
          type="button"
        >
          <span aria-hidden="true">+</span>
          <strong>{getActiveLabel(activeMode)}</strong>
        </button>
        {hasSelection ? (
          <button
            aria-label="Open selected item panel"
            aria-pressed={activeMode === 'select' && isPanelOpen}
            className={styles.inspectButton}
            onClick={handleInspect}
            title="Open selected item panel"
            type="button"
          >
            Inspect
          </button>
        ) : null}
      </div>

      {isLauncherOpen ? (
        <div
          className={styles.launcherPanel}
          id="plan-tool-launcher"
          aria-label="Plan tool launcher"
        >
          <div className={styles.panelHeader}>
            <span>Plan tools</span>
            <button
              aria-label="Close Plan tools"
              onClick={() => setIsLauncherOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>
          <div className={styles.toolGrid}>
            <button
              aria-label="Choose plants"
              className={styles.toolButton}
              onClick={handleChoosePlants}
              type="button"
            >
              <span>Crops</span>
              <small>Choose list</small>
            </button>
            {planModes.map((entry) => (
              <button
                aria-label={entry.label}
                aria-pressed={activeMode === entry.mode}
                className={`${styles.toolButton} ${
                  activeMode === entry.mode ? styles.activeMode : ''
                }`}
                key={entry.mode}
                onClick={() => handleToolMode(entry.mode)}
                title={`${entry.label} (${entry.keyboard})`}
                type="button"
              >
                <span>{getToolLabel(entry.mode)}</span>
                <small>{entry.keyboard}</small>
              </button>
            ))}
          </div>
          {hasSelection ? (
            <button
              aria-label="Open selected item panel"
              aria-pressed={activeMode === 'select' && isPanelOpen}
              className={styles.wideToolButton}
              onClick={handleInspect}
              type="button"
            >
              Reopen selected item panel
            </button>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

function getActiveLabel(mode: PlanMode) {
  switch (mode) {
    case 'measure':
      return 'Measure';
    case 'optimize':
      return 'Review';
    case 'plant':
      return 'Plant';
    case 'select':
      return 'Tools';
    case 'structure':
      return 'Build';
    case 'sun':
      return 'Sun';
  }
}

function getToolLabel(mode: PlanMode) {
  switch (mode) {
    case 'measure':
      return 'Measure';
    case 'optimize':
      return 'Review';
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
