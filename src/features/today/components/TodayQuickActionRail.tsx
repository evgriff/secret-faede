import styles from './TodayQuickActionRail.module.css';

export type TodayQuickActionKind = 'harvest' | 'issue' | 'note' | 'photo';

export interface TodayQuickActionState {
  kind: TodayQuickActionKind;
  plantingId?: string | null;
  targetId?: string | null;
}

export function TodayQuickActionRail({
  onOpenAction,
}: {
  onOpenAction(action: TodayQuickActionState): void;
}) {
  return (
    <details className={styles.quickRail}>
      <summary>Field entry</summary>
      <div className={styles.actionMenu}>
        <button onClick={() => onOpenAction({ kind: 'note' })} type="button">
          Add note
        </button>
        <button onClick={() => onOpenAction({ kind: 'photo' })} type="button">
          Add photo
        </button>
        <button onClick={() => onOpenAction({ kind: 'issue' })} type="button">
          Report issue
        </button>
        <button onClick={() => onOpenAction({ kind: 'harvest' })} type="button">
          Log harvest
        </button>
      </div>
    </details>
  );
}
