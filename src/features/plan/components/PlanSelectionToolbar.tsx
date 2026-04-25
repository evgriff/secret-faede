import { useEffect, useRef, useState } from 'react';

import { formatDateForTimeZone } from '../planDates';
import styles from './PlanSelectionToolbar.module.css';

export function PlanSelectionToolbar({
  count,
  onAlignBottom,
  onAlignCenter,
  onAlignLeft,
  onAlignRight,
  onAlignTop,
  onDelete,
  onDistributeHorizontal,
  onDuplicate,
  onMarkSelectedPlanted,
  selectedPlantCount,
  selectedStructureCount,
  timezone,
}: {
  count: number;
  onAlignBottom(): void;
  onAlignCenter(): void;
  onAlignLeft(): void;
  onAlignRight(): void;
  onAlignTop(): void;
  onDelete(): void;
  onDistributeHorizontal(): void;
  onDuplicate(): void;
  onMarkSelectedPlanted(plantedOn: string): void;
  selectedPlantCount: number;
  selectedStructureCount: number;
  timezone: string;
}) {
  const [isArrangeOpen, setIsArrangeOpen] = useState(false);
  const [isLifecycleOpen, setIsLifecycleOpen] = useState(false);
  const [plantedOn, setPlantedOn] = useState(() =>
    formatDateForTimeZone(new Date(), timezone),
  );
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const canMarkSelectedPlanted = selectedPlantCount > 0;

  useEffect(() => {
    if (!isArrangeOpen && !isLifecycleOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !toolbarRef.current?.contains(event.target)
      ) {
        setIsArrangeOpen(false);
        setIsLifecycleOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsArrangeOpen(false);
        setIsLifecycleOpen(false);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isArrangeOpen, isLifecycleOpen]);

  useEffect(() => {
    setPlantedOn(formatDateForTimeZone(new Date(), timezone));
  }, [timezone, count, selectedPlantCount, selectedStructureCount]);

  if (count < 2) {
    return null;
  }

  const lifecycleSummary =
    selectedStructureCount > 0
      ? `Applies one planted date to ${selectedPlantCount} selected plant ${
          selectedPlantCount === 1 ? 'group' : 'groups'
        }. ${selectedStructureCount} selected ${
          selectedStructureCount === 1 ? 'structure stays' : 'structures stay'
        } unchanged.`
      : `Applies one planted date to all ${selectedPlantCount} selected plant ${
          selectedPlantCount === 1 ? 'group' : 'groups'
        }.`;

  return (
    <div
      className={styles.toolbar}
      aria-label="Group selection tools"
      ref={toolbarRef}
    >
      <strong>{count} selected</strong>
      <div className={styles.menuGroup}>
        <button
          aria-controls="group-selection-arrange"
          aria-expanded={isArrangeOpen}
          onClick={() => setIsArrangeOpen((value) => !value)}
          type="button"
        >
          Arrange
        </button>
        {isArrangeOpen ? (
          <div
            className={styles.menuPanel}
            id="group-selection-arrange"
            role="group"
            aria-label="Arrange selection"
          >
            <button onClick={onAlignLeft} type="button">
              Align left
            </button>
            <button onClick={onAlignCenter} type="button">
              Align center
            </button>
            <button onClick={onAlignRight} type="button">
              Align right
            </button>
            <button onClick={onAlignTop} type="button">
              Align top
            </button>
            <button onClick={onAlignBottom} type="button">
              Align bottom
            </button>
            <button onClick={onDistributeHorizontal} type="button">
              Distribute spacing
            </button>
          </div>
        ) : null}
      </div>
      {canMarkSelectedPlanted ? (
        <div className={styles.menuGroup}>
          <button
            aria-controls="group-selection-lifecycle"
            aria-expanded={isLifecycleOpen}
            onClick={() => setIsLifecycleOpen((value) => !value)}
            type="button"
          >
            Mark selected as planted
          </button>
          {isLifecycleOpen ? (
            <form
              className={styles.menuPanel}
              id="group-selection-lifecycle"
              onSubmit={(event) => {
                event.preventDefault();
                onMarkSelectedPlanted(plantedOn);
                setIsLifecycleOpen(false);
              }}
            >
              <p className={styles.menuMessage}>{lifecycleSummary}</p>
              <label className={styles.field}>
                <span>Planted on</span>
                <input
                  onChange={(event) => setPlantedOn(event.currentTarget.value)}
                  required
                  type="date"
                  value={plantedOn}
                />
              </label>
              <button type="submit">Apply planted date</button>
            </form>
          ) : null}
        </div>
      ) : null}
      <button onClick={onDuplicate} type="button">
        Duplicate
      </button>
      <button className={styles.dangerButton} onClick={onDelete} type="button">
        Delete
      </button>
    </div>
  );
}
