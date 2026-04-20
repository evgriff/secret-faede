import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { useServices } from '../../app/providers';
import { useAuth } from '../auth/auth-context';
import {
  createDefaultGarden,
  type Garden,
  type Task,
} from '../../domain/gardens/GardenRepository';
import {
  isBrowserOffline,
  useNetworkStatus,
} from '../../shared/network/networkStatus';
import { LoadingState } from '../../shared/ui/LoadingState';
import {
  addManualTask,
  addSuccessionTask,
  buildSuccessionRecommendations,
  completeTask,
  deferTask,
  snoozeTask,
  sortTasks,
  synchronizeGardenTasks,
  tasksAreEqual,
  type SuccessionRecommendation,
} from './taskEngine';
import styles from './TasksPage.module.css';

const dayMs = 24 * 60 * 60 * 1000;

type LoadStatus = 'error' | 'loading' | 'ready';
type SaveStatus = 'error' | 'idle' | 'queued' | 'saved' | 'saving';

export function TasksPage() {
  const { gardenRepository } = useServices();
  const { state } = useAuth();
  const networkStatus = useNetworkStatus();
  const [garden, setGarden] = useState<Garden | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('loading');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [quickTaskDate, setQuickTaskDate] = useState(() =>
    toLocalDate(new Date()),
  );
  const [quickTaskNotes, setQuickTaskNotes] = useState('');
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskType, setQuickTaskType] = useState<Task['type']>('other');
  const [today] = useState(() => new Date());
  const todayDate = toLocalDate(today);
  const isOffline = networkStatus === 'offline';

  useEffect(() => {
    const userId = state.user?.uid;

    if (!userId) {
      return;
    }

    let active = true;
    setLoadStatus('loading');
    setError(null);

    void gardenRepository
      .getGarden(userId)
      .then(async (savedGarden) => {
        const baseGarden = savedGarden ?? createDefaultGarden(userId);
        const syncedGarden = synchronizeGardenTasks(baseGarden, { now: today });
        let initialSaveStatus: SaveStatus = 'idle';

        if (!tasksAreEqual(baseGarden.tasks, syncedGarden.tasks)) {
          const wasOffline = isBrowserOffline();
          await gardenRepository.saveGarden(syncedGarden);
          initialSaveStatus =
            wasOffline || isBrowserOffline() ? 'queued' : 'saved';
        }

        if (!active) {
          return;
        }

        setGarden(syncedGarden);
        setLoadStatus('ready');
        setSaveStatus(initialSaveStatus);
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }

        setError(toErrorMessage(loadError, 'Unable to load tasks.'));
        setLoadStatus('error');
      });

    return () => {
      active = false;
    };
  }, [gardenRepository, state.user?.uid, today]);

  const openTasks = useMemo(
    () =>
      sortTasks(garden?.tasks.filter((task) => task.status === 'open') ?? []),
    [garden?.tasks],
  );
  const completedTasks = useMemo(
    () =>
      sortTasks(garden?.tasks.filter((task) => task.status === 'done') ?? []),
    [garden?.tasks],
  );
  const groupedTasks = useMemo(
    () => groupTasks(openTasks, todayDate),
    [openTasks, todayDate],
  );
  const bedCounts = useMemo(() => countTasksByBed(openTasks), [openTasks]);
  const calendarDays = useMemo(
    () => buildCalendarDays(openTasks, todayDate),
    [openTasks, todayDate],
  );
  const successionRecommendations = useMemo(
    () => (garden ? buildSuccessionRecommendations(garden, today) : []),
    [garden, today],
  );

  async function applyGardenUpdate(updateGarden: (current: Garden) => Garden) {
    if (!garden) {
      return;
    }

    const updatedGarden = updateGarden(garden);
    setGarden(updatedGarden);
    setSaveStatus('saving');
    setError(null);

    try {
      const wasOffline = isBrowserOffline();
      await gardenRepository.saveGarden(updatedGarden);
      setSaveStatus(wasOffline || isBrowserOffline() ? 'queued' : 'saved');
    } catch (saveError) {
      setError(toErrorMessage(saveError, 'Unable to save task changes.'));
      setSaveStatus('error');
    }
  }

  async function handleQuickTaskSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!quickTaskTitle.trim()) {
      return;
    }

    await applyGardenUpdate((current) =>
      addManualTask(current, {
        dueDate: quickTaskDate || todayDate,
        notes: quickTaskNotes.trim(),
        title: quickTaskTitle.trim(),
        type: quickTaskType,
      }),
    );
    setQuickTaskNotes('');
    setQuickTaskTitle('');
    setQuickTaskType('other');
    setQuickTaskDate(todayDate);
  }

  if (loadStatus === 'loading') {
    return (
      <LoadingState message="Building the garden schedule." title="Tasks" />
    );
  }

  if (loadStatus === 'error' || !garden) {
    return (
      <section className={styles.page}>
        <h1>Tasks</h1>
        <p role="alert">{error ?? 'Unable to load tasks.'}</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Garden operations</p>
          <h1>Tasks</h1>
          <p className={styles.summary}>
            {openTasks.length} open, {completedTasks.length} completed
          </p>
        </div>
        <div className={styles.actions}>
          <button
            className={styles.secondaryButton}
            onClick={() =>
              void applyGardenUpdate((current) =>
                synchronizeGardenTasks(current, {
                  now: new Date(),
                  refreshOpenGenerated: true,
                }),
              )
            }
            type="button"
          >
            Sync schedule
          </button>
          {saveStatus === 'saving' ? <span>Saving...</span> : null}
          {saveStatus === 'saved' ? <span>Saved</span> : null}
          {saveStatus === 'queued' ? <span>Saved locally</span> : null}
          {isOffline && saveStatus !== 'queued' ? (
            <span>Offline changes will queue</span>
          ) : null}
          {saveStatus === 'error' && error ? (
            <span role="alert">{error}</span>
          ) : null}
        </div>
      </header>

      <section className={styles.quickAdd} aria-label="Quick add task">
        <form onSubmit={(event) => void handleQuickTaskSubmit(event)}>
          <label>
            <span>Task</span>
            <input
              onChange={(event) => setQuickTaskTitle(event.currentTarget.value)}
              placeholder="Add a field task"
              value={quickTaskTitle}
            />
          </label>
          <label>
            <span>Type</span>
            <select
              onChange={(event) =>
                setQuickTaskType(event.currentTarget.value as Task['type'])
              }
              value={quickTaskType}
            >
              <option value="other">General</option>
              <option value="water">Water</option>
              <option value="weed">Weed</option>
              <option value="inspect">Inspect</option>
              <option value="harvest">Harvest</option>
              <option value="fertilize">Feed</option>
              <option value="prune">Prune</option>
              <option value="mulch">Mulch</option>
            </select>
          </label>
          <label>
            <span>Due</span>
            <input
              onChange={(event) => setQuickTaskDate(event.currentTarget.value)}
              type="date"
              value={quickTaskDate}
            />
          </label>
          <label>
            <span>Notes</span>
            <input
              onChange={(event) => setQuickTaskNotes(event.currentTarget.value)}
              placeholder="Optional"
              value={quickTaskNotes}
            />
          </label>
          <button type="submit">Add task</button>
        </form>
      </section>

      <section className={styles.climateBand}>
        <span>Zone {garden.climateProfile.hardinessZone}</span>
        <span>Last frost {garden.climateProfile.averageLastFrost}</span>
        <span>First frost {garden.climateProfile.averageFirstFrost}</span>
        <span>Editable climate defaults</span>
      </section>

      <section aria-label="Two week calendar" className={styles.calendar}>
        {calendarDays.map((day) => (
          <div
            className={`${styles.calendarDay} ${
              day.date === todayDate ? styles.today : ''
            }`}
            key={day.date}
          >
            <span>{formatWeekday(day.date)}</span>
            <strong>{formatMonthDay(day.date)}</strong>
            <small>{day.count} tasks</small>
          </div>
        ))}
      </section>

      <div className={styles.layout}>
        <main className={styles.timeline}>
          <h2 className={styles.sectionTitle}>Upcoming work</h2>
          <TaskGroup
            onComplete={(taskId) =>
              void applyGardenUpdate((current) => completeTask(current, taskId))
            }
            onDefer={(taskId) =>
              void applyGardenUpdate((current) => deferTask(current, taskId, 7))
            }
            onSnooze={(taskId) =>
              void applyGardenUpdate((current) =>
                snoozeTask(current, taskId, 1),
              )
            }
            tasks={groupedTasks.today}
            title="Today"
          />
          <TaskGroup
            onComplete={(taskId) =>
              void applyGardenUpdate((current) => completeTask(current, taskId))
            }
            onDefer={(taskId) =>
              void applyGardenUpdate((current) => deferTask(current, taskId, 7))
            }
            onSnooze={(taskId) =>
              void applyGardenUpdate((current) =>
                snoozeTask(current, taskId, 1),
              )
            }
            tasks={groupedTasks.week}
            title="This week"
          />
          <TaskGroup
            onComplete={(taskId) =>
              void applyGardenUpdate((current) => completeTask(current, taskId))
            }
            onDefer={(taskId) =>
              void applyGardenUpdate((current) => deferTask(current, taskId, 7))
            }
            onSnooze={(taskId) =>
              void applyGardenUpdate((current) =>
                snoozeTask(current, taskId, 1),
              )
            }
            tasks={groupedTasks.later}
            title="Later"
          />
        </main>

        <aside className={styles.sidebar}>
          <section className={styles.panel}>
            <h2>By bed</h2>
            {bedCounts.length > 0 ? (
              <ul className={styles.bedList}>
                {bedCounts.map((bed) => (
                  <li key={bed.label}>
                    <span>{bed.label}</span>
                    <strong>{bed.count}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No open bed work.</p>
            )}
          </section>

          <section className={styles.panel}>
            <h2>Succession</h2>
            {successionRecommendations.length > 0 ? (
              <div className={styles.successionList}>
                {successionRecommendations.map((recommendation) => (
                  <SuccessionCard
                    key={recommendation.id}
                    onAdd={() =>
                      void applyGardenUpdate((current) =>
                        addSuccessionTask(current, recommendation),
                      )
                    }
                    recommendation={recommendation}
                  />
                ))}
              </div>
            ) : (
              <p>No follow-on planting windows yet.</p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

function TaskGroup({
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
  return (
    <section className={styles.group}>
      <div className={styles.groupHeader}>
        <h2>{title}</h2>
        <span>{tasks.length}</span>
      </div>
      {tasks.length > 0 ? (
        <div className={styles.taskList}>
          {tasks.map((task) => (
            <article className={styles.taskCard} key={task.id}>
              <div className={styles.taskMain}>
                <span className={styles.type}>{formatTaskType(task.type)}</span>
                <h3>{task.title}</h3>
                <p>{task.notes}</p>
                <div className={styles.meta}>
                  <span>
                    {task.dueDate ? formatLongDate(task.dueDate) : 'No date'}
                  </span>
                  <span>{task.bedLabel ?? 'Open plot'}</span>
                  <span>{formatPriority(task.priority)}</span>
                  {task.snoozedUntilDate ? (
                    <span>
                      Snoozed to {formatMonthDay(task.snoozedUntilDate)}
                    </span>
                  ) : null}
                  {task.deferredUntilDate ? (
                    <span>
                      Deferred to {formatMonthDay(task.deferredUntilDate)}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className={styles.taskActions}>
                <button onClick={() => onComplete(task.id)} type="button">
                  Complete
                </button>
                <button onClick={() => onSnooze(task.id)} type="button">
                  Snooze
                </button>
                <button onClick={() => onDefer(task.id)} type="button">
                  Defer
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>No open tasks in this window.</p>
      )}
    </section>
  );
}

function SuccessionCard({
  onAdd,
  recommendation,
}: {
  onAdd(): void;
  recommendation: SuccessionRecommendation;
}) {
  return (
    <article className={styles.successionCard}>
      <h3>{recommendation.cropName}</h3>
      <p>{recommendation.reason}</p>
      <div className={styles.meta}>
        <span>{formatLongDate(recommendation.earliestDate)}</span>
        <span>{recommendation.targetLabel}</span>
      </div>
      <button onClick={onAdd} type="button">
        Add task
      </button>
    </article>
  );
}

function groupTasks(tasks: Task[], today: string) {
  const weekEnd = addDays(today, 7);

  return {
    later: tasks.filter((task) => !task.dueDate || task.dueDate > weekEnd),
    today: tasks.filter((task) => task.dueDate && task.dueDate <= today),
    week: tasks.filter(
      (task) => task.dueDate && task.dueDate > today && task.dueDate <= weekEnd,
    ),
  };
}

function countTasksByBed(tasks: Task[]) {
  const counts = new Map<string, number>();

  tasks.forEach((task) => {
    const label = task.bedLabel ?? 'Open plot';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return [...counts.entries()]
    .map(([label, count]) => ({ count, label }))
    .sort((left, right) => right.count - left.count);
}

function buildCalendarDays(tasks: Task[], today: string) {
  return Array.from({ length: 14 }, (_, index) => {
    const date = addDays(today, index);

    return {
      count: tasks.filter((task) => task.dueDate === date).length,
      date,
    };
  });
}

function formatTaskType(type: Task['type']) {
  const labels: Record<Task['type'], string> = {
    amend: 'Amend',
    fertilize: 'Feed',
    harvest: 'Harvest',
    inspect: 'Inspect',
    mulch: 'Mulch',
    other: 'Task',
    plant: 'Plant',
    prune: 'Prune',
    sow: 'Sow',
    thin: 'Thin',
    transplant: 'Transplant',
    trellis: 'Support',
    water: 'Water',
    weed: 'Weed',
  };

  return labels[type];
}

function formatPriority(priority: Task['priority']) {
  return `${priority[0]?.toUpperCase() ?? ''}${priority.slice(1)} priority`;
}

function formatWeekday(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(parseLocalDate(date));
}

function formatMonthDay(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(parseLocalDate(date));
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'short',
  }).format(parseLocalDate(date));
}

function addDays(date: string, days: number) {
  return toLocalDate(new Date(parseLocalDate(date).getTime() + days * dayMs));
}

function parseLocalDate(date: string) {
  const [year = '1970', month = '1', day = '1'] = date.split('-');

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function toLocalDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
