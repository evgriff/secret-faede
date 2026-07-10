import { useMemo, useRef, useState } from 'react';

import type { GardenTask } from '../../domain';
import { Button, StatusBanner } from '../../ui';
import {
  filterTasksByDateRange,
  formatLocalDate,
  groupTasks,
  humanize,
  taskAction,
  taskDeepLink,
  todayDateRanges,
} from './todayModel';
import pageStyles from './TodayPage.module.css';
import styles from './Tasks.module.css';
import type {
  TodayActionResult,
  TodayDateRange,
  TodayLinkComponent,
  TodayTaskActionInput,
} from './types';

export function TaskList({
  focusTaskId,
  LinkComponent,
  onAction,
  onSaved,
  tasks,
  today,
}: {
  focusTaskId: string | null;
  LinkComponent: TodayLinkComponent;
  onAction(input: TodayTaskActionInput): Promise<TodayActionResult>;
  onSaved(result: TodayActionResult, message: string): void;
  tasks: readonly GardenTask[];
  today: string;
}) {
  const [range, setRange] = useState<TodayDateRange>('today');
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const filtered = useMemo(
    () => filterTasksByDateRange(tasks, today, range),
    [range, tasks, today],
  );
  const groups = useMemo(() => groupTasks(filtered, today), [filtered, today]);

  async function run(task: GardenTask, action: TodayTaskActionInput['action']) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(`${task.id}:${action}`);
    setError(null);
    try {
      const result = await onAction(taskAction(task.id, action, today));
      onSaved(result, taskActionMessage(action));
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : 'The task was not updated. Try again.',
      );
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return (
    <section
      aria-labelledby="tasks-title"
      className={pageStyles.section}
      id="tasks"
    >
      <div className={pageStyles.sectionHeading}>
        <div>
          <p className={pageStyles.eyebrow}>Garden work</p>
          <h2 id="tasks-title">Tasks</h2>
          <p>Work generated from the saved plan and your field decisions.</p>
        </div>
        <label className={styles.compactField}>
          <span>Date range</span>
          <select
            onChange={(event) =>
              setRange(event.currentTarget.value as TodayDateRange)
            }
            value={range}
          >
            {todayDateRanges.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p aria-live="polite" className={pageStyles.resultCount} role="status">
        {filtered.length} {filtered.length === 1 ? 'task' : 'tasks'} in this
        range
      </p>
      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}

      {filtered.length === 0 ? (
        <div className={pageStyles.inlineEmpty} role="status">
          <h3>
            {tasks.length === 0
              ? 'No garden tasks yet'
              : 'No tasks in this range'}
          </h3>
          <p>
            {tasks.length === 0
              ? 'Saved planting dates and garden work will appear here.'
              : 'Choose a wider date range to see later work.'}
          </p>
        </div>
      ) : (
        <div className={styles.taskGroups}>
          {groups.map((group) => (
            <section aria-label={`${group.label} tasks`} key={group.label}>
              <h3>{group.label}</h3>
              <div className={styles.taskList}>
                {group.tasks.map((task) => (
                  <article
                    className={styles.taskCard}
                    data-today-focus={
                      focusTaskId === task.id ? 'true' : undefined
                    }
                    key={task.id}
                    {...(focusTaskId === task.id ? { tabIndex: -1 } : {})}
                  >
                    <header>
                      <div>
                        <span className={styles.taskMeta}>
                          {humanize(task.kind)} · {humanize(task.priority)}{' '}
                          priority
                        </span>
                        <h4>{task.title}</h4>
                      </div>
                      <span
                        className={styles.taskStatus}
                        data-status={task.status}
                      >
                        {task.status === 'done'
                          ? 'Done'
                          : humanize(task.status)}
                      </span>
                    </header>
                    <p>{task.reason}</p>
                    {task.notes ? (
                      <p className={styles.taskNotes}>{task.notes}</p>
                    ) : null}
                    <div className={styles.taskFoot}>
                      <span>
                        Due{' '}
                        <time dateTime={task.dueOn}>
                          {formatLocalDate(task.dueOn)}
                        </time>
                      </span>
                      <LinkComponent
                        className={styles.inlineLink ?? ''}
                        to={taskDeepLink(task)}
                      >
                        {task.target.label}
                      </LinkComponent>
                    </div>
                    <div className={styles.taskActions}>
                      {task.status === 'done' ? (
                        <Button
                          disabled={pending !== null}
                          isBusy={pending === `${task.id}:reopen`}
                          onClick={() => void run(task, 'reopen')}
                          variant="secondary"
                        >
                          Reopen
                        </Button>
                      ) : (
                        <>
                          <Button
                            disabled={pending !== null}
                            isBusy={pending === `${task.id}:complete`}
                            onClick={() => void run(task, 'complete')}
                          >
                            Complete
                          </Button>
                          <Button
                            disabled={pending !== null}
                            isBusy={pending === `${task.id}:snooze`}
                            onClick={() => void run(task, 'snooze')}
                            variant="secondary"
                          >
                            Snooze 1 day
                          </Button>
                          <Button
                            disabled={pending !== null}
                            isBusy={pending === `${task.id}:defer`}
                            onClick={() => void run(task, 'defer')}
                            variant="quiet"
                          >
                            Defer 1 week
                          </Button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function taskActionMessage(action: TodayTaskActionInput['action']) {
  return {
    complete: 'Task completed.',
    defer: 'Task deferred one week.',
    reopen: 'Task reopened for today.',
    snooze: 'Task snoozed until tomorrow.',
  }[action];
}
