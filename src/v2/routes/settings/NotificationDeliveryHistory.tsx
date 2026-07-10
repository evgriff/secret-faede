import { useMemo, useState } from 'react';

import type { AlertKind } from '../../domain';
import styles from './SettingsPage.module.css';
import type { NotificationDeliveryHistoryItem } from './types';

const kinds: Array<'all' | AlertKind> = [
  'all',
  'watering',
  'frost',
  'heat',
  'severeWeather',
  'taskDue',
];

export function NotificationDeliveryHistory({
  error,
  items,
}: {
  error?: string | null;
  items: readonly NotificationDeliveryHistoryItem[];
}) {
  const [filter, setFilter] = useState<'all' | AlertKind>('all');
  const filtered = useMemo(
    () =>
      [...items]
        .filter((item) => filter === 'all' || item.kind === filter)
        .sort((left, right) =>
          right.createdAtIso.localeCompare(left.createdAtIso),
        ),
    [filter, items],
  );

  return (
    <section aria-labelledby="delivery-history-title" className={styles.panel}>
      <div className={styles.sectionHeading}>
        <h2 id="delivery-history-title">Private delivery history</h2>
        <p>
          Recent in-app, push, and local delivery decisions for this account.
          “Sent to push service” means the provider accepted the message; it
          does not confirm that a device displayed it. Failed and suppressed
          alerts include their recorded reason.
        </p>
      </div>
      {error ? (
        <p className={styles.historyError} role="alert">
          Delivery history is unavailable: {error}
        </p>
      ) : null}
      <div
        aria-label="Filter delivery history"
        className={styles.filterButtons}
      >
        {kinds.map((kind) => (
          <button
            aria-pressed={filter === kind}
            key={kind}
            onClick={() => setFilter(kind)}
            type="button"
          >
            {kind === 'all' ? 'All' : humanize(kind)}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className={styles.empty} role="status">
          No delivery records match this filter.
        </p>
      ) : (
        <ol className={styles.historyList}>
          {filtered.slice(0, 20).map((item) => (
            <li key={item.id}>
              <article>
                <header>
                  <span>{humanize(item.kind)}</span>
                  <time dateTime={item.createdAtIso}>
                    {formatDateTime(item.createdAtIso)}
                  </time>
                </header>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
                <div className={styles.historyMeta}>
                  <span>{channelLabel(item.channel)}</span>
                  <span data-history-status={item.status}>
                    {statusLabel(item)}
                  </span>
                  {item.reason ? <span>{item.reason}</span> : null}
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function statusLabel(item: NotificationDeliveryHistoryItem) {
  if (item.status === 'sent' && item.channel === 'push') {
    return 'Sent to push service';
  }
  return humanize(item.status);
}

function channelLabel(channel: NotificationDeliveryHistoryItem['channel']) {
  return { inApp: 'In app', local: 'Local reminder', push: 'Push' }[channel];
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
}
