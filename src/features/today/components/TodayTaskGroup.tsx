import { Link } from 'react-router-dom';

import type { Task } from '../../../domain/gardens/GardenRepository';
import {
  formatLongDate,
  formatMonthDay,
  formatPriority,
  formatTaskType,
} from '../todayFormatters';
import { ActionButton } from '../../shared/design/DesignPrimitives';
import { getTaskTargetLink } from '../todayTaskLinks';
import styles from '../TodayPage.module.css';

export function TodayTaskGroup({
  onComplete,
  onDefer,
  onSnooze,
  tasks,
  title,
}: {
  onComplete(taskId: string): void;
  onDefer(taskId: string): void;
  onSnooze(taskId: string): void;
  tasks: Task[];
  title: string;
}) {
  const groups = groupTasksByTypeAndBed(tasks);

  if (tasks.length === 0) {
    return null;
  }

  return (
    <section className={styles.group}>
      <div className={styles.groupHeader}>
        <h2>{title}</h2>
        <span>{tasks.length}</span>
      </div>
      <div className={styles.taskList}>
        {groups.map((group) => (
          <section className={styles.taskCluster} key={group.id}>
            <h3>{group.label}</h3>
            {group.tasks.map((task) => (
              <TaskCard
                key={task.id}
                onComplete={onComplete}
                onDefer={onDefer}
                onSnooze={onSnooze}
                task={task}
              />
            ))}
          </section>
        ))}
      </div>
    </section>
  );
}

function TaskCard({
  onComplete,
  onDefer,
  onSnooze,
  task,
}: {
  onComplete(taskId: string): void;
  onDefer(taskId: string): void;
  onSnooze(taskId: string): void;
  task: Task;
}) {
  const targetLink = getTaskTargetLink(task);

  return (
    <article className={styles.taskCard}>
      <div className={styles.taskMain}>
        <span className={styles.taskTypeLabel}>
          {formatTaskType(task.type)}
        </span>
        <strong className={styles.taskTitle}>{task.title}</strong>
        {task.notes ? <p>{task.notes}</p> : null}
        <div className={styles.meta}>
          <span>{task.dueDate ? formatLongDate(task.dueDate) : 'No date'}</span>
          <span>{task.bedLabel ?? 'Open plot'}</span>
          <span>{formatPriority(task.priority)}</span>
          {task.snoozedUntilDate ? (
            <span>Snoozed to {formatMonthDay(task.snoozedUntilDate)}</span>
          ) : null}
          {task.deferredUntilDate ? (
            <span>Deferred to {formatMonthDay(task.deferredUntilDate)}</span>
          ) : null}
        </div>
      </div>
      <div className={styles.taskActions}>
        <ActionButton
          intent="success"
          onClick={() => onComplete(task.id)}
          priority="primary"
        >
          Task done
        </ActionButton>
        <ActionButton onClick={() => onSnooze(task.id)} priority="secondary">
          Snooze
        </ActionButton>
        <ActionButton onClick={() => onDefer(task.id)} priority="secondary">
          Defer
        </ActionButton>
        {targetLink ? (
          <Link className={styles.taskActionLink} to={targetLink.to}>
            {targetLink.label}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function groupTasksByTypeAndBed(tasks: Task[]) {
  const groups = new Map<
    string,
    { id: string; label: string; tasks: Task[] }
  >();

  for (const task of tasks) {
    const bedLabel = task.bedLabel ?? 'Open plot';
    const id = `${task.type}:${bedLabel}`;
    const group = groups.get(id) ?? {
      id,
      label: `${formatTaskType(task.type)} - ${bedLabel}`,
      tasks: [],
    };

    group.tasks.push(task);
    groups.set(id, group);
  }

  return [...groups.values()];
}
