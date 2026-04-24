import { useEffect, useRef, useState } from 'react';

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
}) {
  const [isArrangeOpen, setIsArrangeOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isArrangeOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !toolbarRef.current?.contains(event.target)
      ) {
        setIsArrangeOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsArrangeOpen(false);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isArrangeOpen]);

  if (count < 2) {
    return null;
  }

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
      <button onClick={onDuplicate} type="button">
        Duplicate
      </button>
      <button className={styles.dangerButton} onClick={onDelete} type="button">
        Delete
      </button>
    </div>
  );
}
