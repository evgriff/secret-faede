import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import type {
  NotificationLog,
  NotificationType,
} from '../../../domain/gardens/GardenRepository';
import { routePaths } from '../../../shared/lib/routes';
import {
  formatChannel,
  formatDateTime,
  formatNotificationType,
} from '../settingsHelpers';
import styles from '../SettingsPage.module.css';

const filterTypes: Array<'all' | NotificationType> = [
  'all',
  'watering',
  'frost',
  'heatStress',
  'severeWeather',
  'taskDue',
];

export function NotificationCenter({
  logs,
  onAcknowledge,
  onDismiss,
  onSnooze,
}: {
  logs: NotificationLog[];
  onAcknowledge(logId: string): void;
  onDismiss(logId: string): void;
  onSnooze(logId: string): void;
}) {
  const [filter, setFilter] = useState<'all' | NotificationType>('all');
  const nowMs = useNowMs();
  const sortedLogs = useMemo(
    () =>
      [...logs].sort((left, right) =>
        right.createdAtIso.localeCompare(left.createdAtIso),
      ),
    [logs],
  );
  const filteredLogs =
    filter === 'all'
      ? sortedLogs
      : sortedLogs.filter((log) => log.type === filter);
  const activeLogs = filteredLogs.filter((log) => isActiveAlert(log, nowMs));
  const activeIds = new Set(activeLogs.map((log) => log.id));
  const recentLogs = filteredLogs.filter((log) => !activeIds.has(log.id));

  return (
    <section className={styles.notificationCenter}>
      <div className={styles.sectionHeader}>
        <div>
          <h2>Alert history</h2>
          <p>
            Active alerts and recent sends from the garden without repeating the
            same reminder.
          </p>
        </div>
      </div>

      <div className={styles.filterBar} aria-label="Filter notifications">
        {filterTypes.map((type) => (
          <button
            aria-pressed={filter === type}
            key={type}
            onClick={() => setFilter(type)}
            type="button"
          >
            {type === 'all' ? 'All' : formatNotificationType(type)}
          </button>
        ))}
      </div>

      <div className={styles.notificationSummary}>
        <span>
          <strong>{activeLogs.length}</strong>
          Active
        </span>
        <span>
          <strong>{recentLogs.length}</strong>
          Recent
        </span>
        <span>
          <strong>
            {filteredLogs.filter((log) => log.status === 'failed').length}
          </strong>
          Failed
        </span>
      </div>

      {activeLogs.length > 0 ? (
        <div className={styles.notificationList} aria-label="Active alerts">
          <h3 className={styles.notificationListTitle}>Active alerts</h3>
          {activeLogs.slice(0, 5).map((log) => (
            <NotificationRow
              key={log.id}
              log={log}
              nowMs={nowMs}
              onAcknowledge={onAcknowledge}
              onDismiss={onDismiss}
              onSnooze={onSnooze}
            />
          ))}
        </div>
      ) : (
        <p className={styles.emptyState}>No active alerts for this filter.</p>
      )}

      <div className={styles.notificationList} aria-label="Recent alerts">
        <h3 className={styles.notificationListTitle}>Recent alerts</h3>
        {recentLogs.slice(0, 12).map((log) => (
          <NotificationRow
            key={log.id}
            log={log}
            nowMs={nowMs}
            onAcknowledge={onAcknowledge}
            onDismiss={onDismiss}
            onSnooze={onSnooze}
          />
        ))}
      </div>
    </section>
  );
}

function useNowMs() {
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  return nowMs;
}

function NotificationRow({
  log,
  nowMs,
  onAcknowledge,
  onDismiss,
  onSnooze,
}: {
  log: NotificationLog;
  nowMs: number;
  onAcknowledge(logId: string): void;
  onDismiss(logId: string): void;
  onSnooze(logId: string): void;
}) {
  const isSnoozed = isSnoozedUntilFuture(log, nowMs);
  const link = getNotificationLink(log);
  const canResolve = !log.dismissedAtIso && !log.acknowledgedAtIso;
  const canSnooze =
    canResolve && isAlertType(log.type) && log.status === 'sent';

  return (
    <article className={styles.notificationRow}>
      <div>
        <div className={styles.notificationMeta}>
          <span>{formatNotificationType(log.type)}</span>
          <span>{formatChannel(log.channel)}</span>
          <span data-status={log.status}>{log.status}</span>
          <span>{getNotificationStateLabel(log, nowMs)}</span>
        </div>
        <h3>{log.messageSummary || log.body}</h3>
        <p>{formatDateTime(log.createdAtIso)}</p>
        {isSnoozed && log.snoozedUntilIso ? (
          <p>Snoozed until {formatDateTime(log.snoozedUntilIso)}</p>
        ) : null}
        <p>
          {log.decisionReason ?? log.errorMessage ?? 'Delivery allowed'}
          {log.providerStatus ? `; provider ${log.providerStatus}` : ''}
          {log.attemptCount ? `; attempts ${log.attemptCount}` : ''}
        </p>
      </div>
      <div className={styles.notificationActions}>
        <Link className={styles.notificationLink} to={link.to}>
          {link.label}
        </Link>
        {canSnooze && !isSnoozed ? (
          <button onClick={() => onSnooze(log.id)} type="button">
            Snooze 1 day
          </button>
        ) : null}
        {!log.acknowledgedAtIso && !log.dismissedAtIso ? (
          <button onClick={() => onAcknowledge(log.id)} type="button">
            Acknowledge
          </button>
        ) : null}
        {!log.dismissedAtIso ? (
          <button onClick={() => onDismiss(log.id)} type="button">
            Dismiss
          </button>
        ) : null}
      </div>
    </article>
  );
}

function isActiveAlert(log: NotificationLog, nowMs: number) {
  return (
    isAlertType(log.type) &&
    log.status !== 'skipped' &&
    !log.dismissedAtIso &&
    !log.acknowledgedAtIso &&
    !isSnoozedUntilFuture(log, nowMs)
  );
}

function isSnoozedUntilFuture(log: NotificationLog, nowMs: number) {
  const snoozedUntilMs = Date.parse(log.snoozedUntilIso ?? '');

  return Number.isFinite(snoozedUntilMs) && snoozedUntilMs > nowMs;
}

function getNotificationStateLabel(log: NotificationLog, nowMs: number) {
  if (log.dismissedAtIso) {
    return 'Dismissed';
  }

  if (log.acknowledgedAtIso) {
    return 'Acknowledged';
  }

  if (isSnoozedUntilFuture(log, nowMs)) {
    return 'Snoozed';
  }

  if (log.status === 'failed') {
    return 'Failed';
  }

  if (log.status === 'skipped') {
    return 'Skipped';
  }

  return isAlertType(log.type) ? 'Needs attention' : 'Recorded';
}

function getNotificationLink(log: NotificationLog) {
  const to = sanitizeDeepLink(log.deepLink) ?? fallbackLinkForType(log.type);

  if (to.startsWith(routePaths.plan)) {
    return { label: 'Open Plan', to };
  }

  if (to.startsWith(routePaths.feed)) {
    return { label: 'Open Feed', to };
  }

  if (to.startsWith(routePaths.settings)) {
    return { label: 'Open Settings', to };
  }

  return { label: 'Open Today', to };
}

function sanitizeDeepLink(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return value === routePaths.app || value.startsWith(`${routePaths.app}/`)
    ? value
    : null;
}

function fallbackLinkForType(type: NotificationType) {
  if (type === 'task' || type === 'taskDue' || type === 'watering') {
    return routePaths.today;
  }

  if (type === 'weather' || isAlertType(type)) {
    return routePaths.today;
  }

  return routePaths.settings;
}

function isAlertType(type: NotificationType) {
  return [
    'frost',
    'heatStress',
    'severeWeather',
    'taskDue',
    'watering',
  ].includes(type);
}
