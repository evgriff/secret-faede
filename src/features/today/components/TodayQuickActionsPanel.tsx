import { Link } from 'react-router-dom';

import { routePaths } from '../../../shared/lib/routes';
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
        <h2>Field follow-up</h2>
        <span>Today only</span>
      </div>
      <p className={styles.helperText}>
        Report issues and log harvests here while the work is in front of you.
        Use Feed for notes and photo memories.
      </p>
      <TodayQuickActionRail onOpenAction={onOpenAction} />
      <div className={styles.handoffRow}>
        <Link className={styles.feedLink} to={routePaths.feed}>
          Open Feed for notes and photos
        </Link>
      </div>
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
