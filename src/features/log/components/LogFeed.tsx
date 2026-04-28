import { useEffect } from 'react';

import type { IssueStatus } from '../../../domain/gardens/GardenRepository';
import {
  formatDate,
  formatIssue,
  formatIssueSeverity,
  formatIssueStatus,
} from '../logHelpers';
import type { LogFeedItem } from '../logFeedItems';
import styles from './LogCards.module.css';

export function LogFeed({
  hasActiveFilters,
  focusedItemId,
  items,
  onUpdateIssue,
  totalItemCount,
}: {
  hasActiveFilters: boolean;
  focusedItemId: string | null;
  items: LogFeedItem[];
  onUpdateIssue(entryId: string, status: IssueStatus): void;
  totalItemCount: number;
}) {
  const pinnedIssues = items
    .filter((item) => item.issue && item.issue.issueStatus !== 'resolved')
    .slice(0, 3);

  useEffect(() => {
    if (!focusedItemId) {
      return;
    }

    const item = document.getElementById(`feed-${focusedItemId}`);

    item?.focus({ preventScroll: true });
    item?.scrollIntoView({ block: 'center' });
  }, [focusedItemId, items]);

  return (
    <section className={styles.feedSection} id="feed-list">
      {pinnedIssues.length > 0 ? (
        <div
          className={styles.pinnedIssues}
          aria-label="Pinned unresolved issues"
        >
          <p className={styles.pinLabel}>Open issues</p>
          {pinnedIssues.map((item) => (
            <IssuePin item={item} key={`pin-${item.id}`} />
          ))}
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className={styles.feedList}>
          {items.map((item) => (
            <FeedItemCard
              focused={item.id === focusedItemId}
              item={item}
              key={item.id}
              onUpdateIssue={onUpdateIssue}
            />
          ))}
        </div>
      ) : (
        <div className={styles.empty} role="status">
          <h3>
            {hasActiveFilters ? 'No matching memories' : 'No memories yet'}
          </h3>
          <p>
            {hasActiveFilters && totalItemCount > 0
              ? 'Clear or loosen filters to return to the full garden stream.'
              : 'Add a note, issue, photo, or harvest when something changes in the garden.'}
          </p>
        </div>
      )}
    </section>
  );
}

function FeedItemCard({
  focused,
  item,
  onUpdateIssue,
}: {
  focused: boolean;
  item: LogFeedItem;
  onUpdateIssue(entryId: string, status: IssueStatus): void;
}) {
  return (
    <article
      className={[
        styles.feedCard,
        focused ? styles.focusedCard : '',
        item.issue && item.issue.issueStatus !== 'resolved'
          ? styles.unresolvedCard
          : '',
      ].join(' ')}
      id={`feed-${item.id}`}
      tabIndex={focused ? -1 : undefined}
    >
      <div className={styles.feedContent}>
        <div className={styles.feedHeader}>
          <span>
            {getTypeLabel(item)} ·{' '}
            {item.plantingId ? (
              <a href={`/app/plan?p=${item.plantingId}`}>{item.targetLabel}</a>
            ) : (
              item.targetLabel
            )}
            {item.authorLabel ? ` · ${item.authorLabel}` : ''}
          </span>
          <time dateTime={item.date}>{formatDate(item.date)}</time>
        </div>
        <h3>{item.title}</h3>
        {item.photos.length > 0 ? <PhotoPreview item={item} /> : null}
        {item.body ? <p>{item.body}</p> : null}
        <div className={styles.meta}>
          {formatItemMeta(item).map((value) => (
            <span key={value}>{value}</span>
          ))}
        </div>
        {item.issue ? (
          <IssueActions item={item} onUpdateIssue={onUpdateIssue} />
        ) : null}
      </div>
    </article>
  );
}

function IssuePin({ item }: { item: LogFeedItem }) {
  return (
    <article className={styles.issuePin}>
      <strong>{item.title}</strong>
      <span>
        {item.targetLabel} -{' '}
        {formatIssueSeverity(item.issue?.issueSeverity ?? null)}
        {item.authorLabel ? ` - ${item.authorLabel}` : ''}
      </span>
    </article>
  );
}

function PhotoPreview({ item }: { item: LogFeedItem }) {
  return (
    <div className={styles.compactPhotoRow}>
      {item.photos.slice(0, 4).map((photo) => (
        <img alt={photo.fileName} key={photo.id} src={photo.downloadUrl} />
      ))}
      {item.photos.length > 4 ? <span>+{item.photos.length - 4}</span> : null}
    </div>
  );
}

function IssueActions({
  item,
  onUpdateIssue,
}: {
  item: LogFeedItem;
  onUpdateIssue(entryId: string, status: IssueStatus): void;
}) {
  if (!item.issue) {
    return null;
  }

  return (
    <div className={styles.issueFooter}>
      <div className={styles.statusActions}>
        {(['open', 'inProgress', 'resolved'] as const).map((status) => (
          <button
            aria-pressed={item.issue?.issueStatus === status}
            key={status}
            onClick={() => item.issue && onUpdateIssue(item.issue.id, status)}
            type="button"
          >
            {formatIssueStatus(status)}
          </button>
        ))}
      </div>
      {item.linkedTasks.length > 0 ? (
        <small>
          {item.linkedTasks.length} follow-up task
          {item.linkedTasks.length === 1 ? '' : 's'}
        </small>
      ) : null}
    </div>
  );
}

function getTypeLabel(item: LogFeedItem) {
  if (item.type === 'issue' && item.issue?.issueCategory) {
    return formatIssue(item.issue.issueCategory);
  }

  const labels: Record<LogFeedItem['type'], string> = {
    harvest: 'Harvest',
    issue: 'Issue',
    note: 'Note',
    photo: 'Photo update',
    publish: 'Publish',
    task: 'Task done',
    watering: 'Watering',
  };

  return labels[item.type];
}

function formatItemMeta(item: LogFeedItem) {
  if (item.issue) {
    return [
      formatIssueSeverity(item.issue.issueSeverity),
      formatIssueStatus(item.issue.issueStatus),
    ];
  }

  return item.meta.filter((value) => value !== item.targetLabel).slice(0, 3);
}
