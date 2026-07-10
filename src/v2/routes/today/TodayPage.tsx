import { useEffect, useMemo, useState } from 'react';

import type { WateringRecommendation } from '../../domain/watering';
import { EmptyState, ErrorState, LoadingState, StatusBanner } from '../../ui';
import { TaskList } from './TaskList';
import { gardenToday } from './todayModel';
import styles from './TodayPage.module.css';
import type {
  TodayActionResult,
  TodayPageProps,
  WateringLogOutcome,
} from './types';
import { WateringCard } from './WateringCard';
import { WateringLogDialog } from './WateringLogDialog';
import { WeatherPanel } from './WeatherPanel';

export function TodayPage({
  errorMessage,
  focus = null,
  focusId = null,
  isOnline,
  LinkComponent,
  loadState = 'ready',
  nowIso,
  onLogWatering,
  onRefreshWeather,
  onRetry,
  onTaskAction,
  recommendations,
  tasks,
  timezone,
  weather,
}: TodayPageProps) {
  const today = gardenToday(nowIso, timezone);
  const [activeRecommendation, setActiveRecommendation] =
    useState<WateringRecommendation | null>(null);
  const [notice, setNotice] = useState<{
    message: string;
    tone: 'success' | 'warning';
  } | null>(null);
  const orderedRecommendations = useMemo(
    () => [...recommendations].sort(compareRecommendations),
    [recommendations],
  );

  useEffect(() => {
    if (!focus) return;
    const timer = window.setTimeout(() => {
      const target = document.querySelector<HTMLElement>(
        '[data-today-focus="true"]',
      );
      target?.focus({ preventScroll: true });
      target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [focus, focusId, loadState]);

  function saved(result: TodayActionResult, message: string) {
    setNotice({
      message:
        result === 'queued'
          ? `${message} Saved on this device and queued to sync.`
          : message,
      tone: result === 'queued' ? 'warning' : 'success',
    });
  }

  if (loadState === 'loading') {
    return (
      <main className={styles.page} data-sf-v2="today">
        <LoadingState
          detail="Calculating each crop group from its saved water balance and gathering garden work."
          title="Loading Today"
        />
      </main>
    );
  }

  if (loadState === 'error') {
    return (
      <main className={styles.page} data-sf-v2="today">
        <ErrorState
          detail={
            errorMessage ??
            'Watering recommendations and garden tasks could not be loaded.'
          }
          {...(onRetry ? { onRetry } : {})}
          title="Today is unavailable"
        />
      </main>
    );
  }

  const isEmpty =
    orderedRecommendations.length === 0 &&
    tasks.length === 0 &&
    (weather === null || weather.alerts.length === 0);

  return (
    <main className={styles.page} data-sf-v2="today">
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Field plan · {formatHeading(today)}</p>
          <h1>Today</h1>
          <p>
            Crop-specific watering decisions, current conditions, and the work
            due in your saved garden.
          </p>
        </div>
        <div className={styles.headerFacts} aria-label="Today summary">
          <span>
            <strong>{orderedRecommendations.length}</strong> crop groups
          </span>
          <span>
            <strong>
              {tasks.filter((task) => task.status !== 'done').length}
            </strong>{' '}
            open tasks
          </span>
        </div>
      </header>

      {!isOnline ? (
        <StatusBanner tone="warning">
          You are offline. Field decisions may save on this device, but weather
          cannot refresh and changes will wait to sync.
        </StatusBanner>
      ) : null}
      {notice ? (
        <StatusBanner live tone={notice.tone}>
          {notice.message}
        </StatusBanner>
      ) : null}

      {isEmpty ? (
        <EmptyState
          detail="Add active crop groups in Plan. Watering recommendations and generated work will then appear here."
          title="No field work is ready yet"
        />
      ) : null}

      <div
        data-focused={focus === 'weather' || undefined}
        data-today-focus={focus === 'weather' && !focusId ? 'true' : undefined}
        {...(focus === 'weather' && !focusId ? { tabIndex: -1 } : {})}
      >
        <WeatherPanel
          focusAlertId={focus === 'weather' ? focusId : null}
          LinkComponent={LinkComponent}
          {...(onRefreshWeather ? { onRefresh: onRefreshWeather } : {})}
          timezone={timezone}
          weather={weather}
        />
      </div>

      <section
        aria-labelledby="watering-title"
        className={styles.section}
        data-focused={focus === 'watering' || undefined}
        data-today-focus={focus === 'watering' && !focusId ? 'true' : undefined}
        id="watering"
        {...(focus === 'watering' && !focusId ? { tabIndex: -1 } : {})}
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Crop water balance</p>
            <h2 id="watering-title">Watering</h2>
            <p>
              Every card is calculated separately for one crop group. An exact
              amount appears only when the data supports it.
            </p>
          </div>
          <span className={styles.resultCount} aria-live="polite">
            {orderedRecommendations.length}{' '}
            {orderedRecommendations.length === 1
              ? 'recommendation'
              : 'recommendations'}
          </span>
        </div>

        {orderedRecommendations.length === 0 ? (
          <div className={styles.inlineEmpty} role="status">
            <h3>No active crops need a watering calculation</h3>
            <p>
              Planned, harvested, and removed crop groups are intentionally
              excluded.
            </p>
          </div>
        ) : (
          <div className={styles.wateringGrid}>
            {orderedRecommendations.map((recommendation) => (
              <WateringCard
                isFocused={
                  focus === 'watering' &&
                  (focusId === recommendation.id ||
                    focusId === recommendation.target.cropGroupId)
                }
                key={recommendation.id}
                LinkComponent={LinkComponent}
                onLog={setActiveRecommendation}
                recommendation={recommendation}
                timezone={timezone}
              />
            ))}
          </div>
        )}
      </section>

      <div
        data-focused={focus === 'task' || undefined}
        data-today-focus={focus === 'task' && !focusId ? 'true' : undefined}
        {...(focus === 'task' && !focusId ? { tabIndex: -1 } : {})}
      >
        <TaskList
          focusTaskId={focus === 'task' ? focusId : null}
          LinkComponent={LinkComponent}
          onAction={onTaskAction}
          onSaved={saved}
          tasks={tasks}
          today={today}
        />
      </div>

      <WateringLogDialog
        onClose={() => setActiveRecommendation(null)}
        onLog={onLogWatering}
        onSaved={(result, outcome) =>
          saved(result, wateringOutcomeMessage(outcome))
        }
        recommendation={activeRecommendation}
        today={today}
      />
    </main>
  );
}

function compareRecommendations(
  left: WateringRecommendation,
  right: WateringRecommendation,
) {
  const order = { due: 0, checkSoil: 1, suppressed: 2, scheduled: 3 } as const;
  return (
    order[left.status] - order[right.status] ||
    (left.target.cropGroupLabel ?? left.target.cropName).localeCompare(
      right.target.cropGroupLabel ?? right.target.cropName,
    )
  );
}

function wateringOutcomeMessage(outcome: WateringLogOutcome) {
  if (outcome === 'skipped') {
    return 'Skipped watering recorded with zero water credit.';
  }
  return outcome === 'partial'
    ? 'Partial watering amount recorded.'
    : 'Watering amount recorded.';
}

function formatHeading(value: string) {
  const parts = value.split('-').map(Number);
  const [year = 0, month = 1, day = 1] = parts;
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    weekday: 'long',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}
