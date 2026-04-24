import {
  TodayManualTaskForm,
  type TodayManualTaskInput,
} from './TodayManualTaskForm';
import {
  TodayQuickActionRail,
  type TodayQuickActionState,
} from './TodayQuickActionRail';
import styles from './TodayQuickActionsPanel.module.css';

export function TodayQuickActionsPanel({
  onAddManualTask,
  onOpenAction,
  selectedDate,
}: {
  onAddManualTask(input: TodayManualTaskInput): Promise<boolean>;
  onOpenAction(action: TodayQuickActionState): void;
  selectedDate: string;
}) {
  return (
    <section className={styles.quickActionsPanel}>
      <div className={styles.groupHeader}>
        <h2>Log what happened</h2>
        <span>Field log</span>
      </div>
      <TodayQuickActionRail onOpenAction={onOpenAction} />
      <details className={styles.addTaskDisclosure}>
        <summary>Add a reminder</summary>
        <TodayManualTaskForm
          onAddTask={onAddManualTask}
          todayDate={selectedDate}
        />
      </details>
    </section>
  );
}
