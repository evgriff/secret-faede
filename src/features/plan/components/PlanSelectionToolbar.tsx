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
  if (count < 2) {
    return null;
  }

  return (
    <div className={styles.toolbar} aria-label="Group selection tools">
      <strong>{count} selected</strong>
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
      <button onClick={onDuplicate} type="button">
        Duplicate group
      </button>
      <button className={styles.dangerButton} onClick={onDelete} type="button">
        Delete group
      </button>
    </div>
  );
}
