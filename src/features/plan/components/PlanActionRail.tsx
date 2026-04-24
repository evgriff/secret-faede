import { useEffect, useRef, useState } from 'react';

import type { PlanMode } from '../planModes';
import styles from './PlanActionRail.module.css';

const buildModes: Array<{
  description: string;
  label: string;
  mode: Extract<PlanMode, 'plant' | 'structure'>;
}> = [
  {
    description: 'Place a crop group directly on the plan.',
    label: 'Plant',
    mode: 'plant',
  },
  {
    description: 'Place beds, paths, containers, or trellises.',
    label: 'Structure',
    mode: 'structure',
  },
];

export function PlanActionRail({
  activeMode,
  avoidFocusCard,
  hasSelection,
  isDetailedViewOpen,
  onOpenDetails,
  onOpenHistory,
  onOpenOptimize,
  onOpenSun,
  setActiveMode,
}: {
  activeMode: PlanMode;
  avoidFocusCard: boolean;
  hasSelection: boolean;
  isDetailedViewOpen: boolean;
  onOpenDetails(): void;
  onOpenHistory(): void;
  onOpenOptimize(): void;
  onOpenSun(): void;
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

  function handleAction(action: () => void) {
    action();
    setIsLauncherOpen(false);
  }

  const toolEntries = [
    ...buildModes.map((entry) => ({
      description: entry.description,
      disabled: false,
      isActive: activeMode === entry.mode,
      label: entry.label,
      onClick: () => handleBuildMode(entry.mode),
    })),
    {
      description: 'Check one whole-plot layout suggestion for saved crops.',
      disabled: false,
      isActive: activeMode === 'optimize',
      label: 'Generate layout',
      onClick: () => handleAction(onOpenOptimize),
    },
    {
      description: 'Check sun and shade when it matters.',
      disabled: false,
      isActive: activeMode === 'sun',
      label: 'Sun',
      onClick: () => handleAction(onOpenSun),
    },
    {
      description: hasSelection
        ? 'Open the selected plant or structure.'
        : 'Select something on the plot first.',
      disabled: !hasSelection,
      isActive: isDetailedViewOpen,
      label: 'Details',
      onClick: () => handleAction(onOpenDetails),
    },
    {
      description: 'Review earlier saved versions of the garden.',
      disabled: false,
      isActive: false,
      label: 'History',
      onClick: () => handleAction(onOpenHistory),
    },
  ];

  return (
    <aside
      className={`${styles.rail} ${avoidFocusCard ? styles.railAvoidFocus : ''}`}
      aria-label="More plan tools"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setIsLauncherOpen(false);
        }
      }}
      ref={launcherRef}
    >
      <div className={styles.launcherBar}>
        <button
          aria-controls="plan-more-tools"
          aria-expanded={isLauncherOpen}
          aria-label="Open more tools"
          className={styles.launcherButton}
          onClick={() => setIsLauncherOpen((value) => !value)}
          type="button"
        >
          <span aria-hidden="true">...</span>
          <strong>More tools</strong>
        </button>
      </div>

      {isLauncherOpen ? (
        <div
          className={styles.launcherPanel}
          id="plan-more-tools"
          aria-label="More tools menu"
        >
          <div className={styles.panelHeader}>
            <span>More tools</span>
            <button
              aria-label="Close more tools"
              onClick={() => setIsLauncherOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>
          <div className={styles.toolGrid}>
            {toolEntries.map((entry) => (
              <button
                aria-label={entry.label}
                aria-pressed={entry.isActive}
                className={`${styles.toolButton} ${
                  entry.isActive ? styles.activeMode : ''
                }`}
                disabled={entry.disabled}
                key={entry.label}
                onClick={entry.onClick}
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
