import { useRef, useState } from 'react';

import type {
  GardenIssue,
  PhotoAttachment,
  WaterApplication,
} from '../../domain';
import { Button, StatusBanner } from '../../ui';
import styles from './FeedPage.module.css';
import type {
  FeedActivityItem,
  FeedCreateResult,
  FeedIssueStatus,
  FeedLinkComponent,
} from './types';

export function FeedActivityStream({
  currentUserId,
  getPhotoUrl,
  hasActiveFilters,
  items,
  LinkComponent,
  onUpdateIssue,
  onCorrectWatering,
  totalCount,
}: {
  currentUserId: string;
  getPhotoUrl?(photo: PhotoAttachment): string | null;
  hasActiveFilters: boolean;
  items: readonly FeedActivityItem[];
  LinkComponent: FeedLinkComponent;
  onUpdateIssue?(issue: GardenIssue): Promise<FeedCreateResult>;
  onCorrectWatering?(application: WaterApplication): void;
  totalCount: number;
}) {
  const unresolved = items.filter(
    (item) => item.issue && item.issue.status !== 'resolved',
  );

  return (
    <section aria-labelledby="private-activity-title" className={styles.stream}>
      <div className={styles.sectionHeading}>
        <div>
          <h2 id="private-activity-title">Private garden activity</h2>
          <p>Only the provisioned garden accounts can read this history.</p>
        </div>
        <span className={styles.resultCount} aria-live="polite">
          {items.length} {items.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {unresolved.length > 0 ? (
        <aside aria-label="Open issues" className={styles.pinnedIssues}>
          <strong>Open issues</strong>
          <ul>
            {unresolved.slice(0, 3).map((item) => (
              <li key={`pin:${item.id}`}>
                {item.title} · {item.targetLabel}
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      {items.length === 0 ? (
        <div className={styles.empty} role="status">
          <h3>
            {hasActiveFilters ? 'No matching memories' : 'No memories yet'}
          </h3>
          <p>
            {hasActiveFilters && totalCount > 0
              ? 'Clear or loosen the filters to return to the full garden stream.'
              : 'Add a note, issue, photo, or harvest when something changes.'}
          </p>
        </div>
      ) : (
        <div className={styles.activityList}>
          {items.map((item) => (
            <ActivityCard
              currentUserId={currentUserId}
              item={item}
              key={item.id}
              LinkComponent={LinkComponent}
              {...(getPhotoUrl ? { getPhotoUrl } : {})}
              {...(onUpdateIssue ? { onUpdateIssue } : {})}
              {...(onCorrectWatering ? { onCorrectWatering } : {})}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityCard({
  currentUserId,
  getPhotoUrl,
  item,
  LinkComponent,
  onUpdateIssue,
  onCorrectWatering,
}: {
  currentUserId: string;
  getPhotoUrl?(photo: PhotoAttachment): string | null;
  item: FeedActivityItem;
  LinkComponent: FeedLinkComponent;
  onUpdateIssue?(issue: GardenIssue): Promise<FeedCreateResult>;
  onCorrectWatering?(application: WaterApplication): void;
}) {
  const photoLed = item.type === 'photo' && item.photos.length > 0;
  const correctableApplication =
    item.watering?.kind === 'application' ? item.watering.application : null;
  return (
    <article
      className={`${styles.activityCard} ${photoLed ? styles.photoCard : ''}`}
      data-activity-type={item.type}
    >
      <header className={styles.cardHeader}>
        <span>{activityLabel(item)}</span>
        <time dateTime={item.occurredAt}>{formatDate(item.occurredAt)}</time>
      </header>
      <h3>{item.title}</h3>
      {photoLed ? (
        <PhotoGallery
          photos={item.photos}
          {...(getPhotoUrl ? { getPhotoUrl } : {})}
        />
      ) : null}
      {item.body ? <p className={styles.cardBody}>{item.body}</p> : null}
      {item.type !== 'photo' && item.photos.length > 0 ? (
        <PhotoGallery
          compact
          photos={item.photos}
          {...(getPhotoUrl ? { getPhotoUrl } : {})}
        />
      ) : null}
      <div className={styles.cardMeta}>
        <span>
          {item.targetDeepLink ? (
            <LinkComponent to={item.targetDeepLink}>
              {item.targetLabel}
            </LinkComponent>
          ) : (
            item.targetLabel
          )}
        </span>
        {item.createdByUserId ? (
          <span>
            {item.createdByUserId === currentUserId ? 'You' : 'Garden member'}
          </span>
        ) : (
          <span>Water model</span>
        )}
        {item.meta.map((value) => (
          <span key={value}>{humanize(value)}</span>
        ))}
      </div>
      {item.issue && onUpdateIssue ? (
        <IssueActions issue={item.issue} onUpdateIssue={onUpdateIssue} />
      ) : null}
      {correctableApplication && onCorrectWatering ? (
        <div className={styles.recordActions}>
          <Button
            onClick={() => onCorrectWatering(correctableApplication)}
            variant="quiet"
          >
            Correct watering record
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function PhotoGallery({
  compact = false,
  getPhotoUrl,
  photos,
}: {
  compact?: boolean;
  getPhotoUrl?(photo: PhotoAttachment): string | null;
  photos: readonly PhotoAttachment[];
}) {
  return (
    <div className={compact ? styles.compactPhotos : styles.heroPhotos}>
      {photos.map((photo) => {
        const url = getPhotoUrl?.(photo) ?? photo.storagePath;
        return url ? (
          <img alt={photo.fileName} key={photo.id} src={url} />
        ) : (
          <div
            className={styles.photoUnavailable}
            key={photo.id}
            role="img"
            aria-label={photo.fileName}
          >
            Photo unavailable on this device
          </div>
        );
      })}
    </div>
  );
}

function IssueActions({
  issue,
  onUpdateIssue,
}: {
  issue: GardenIssue;
  onUpdateIssue(issue: GardenIssue): Promise<FeedCreateResult>;
}) {
  const [pending, setPending] = useState<FeedIssueStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  async function update(status: FeedIssueStatus) {
    if (inFlight.current || status === issue.status) return;
    inFlight.current = true;
    setPending(status);
    setError(null);
    try {
      await onUpdateIssue({
        ...issue,
        resolvedAtIso:
          status === 'resolved'
            ? (issue.resolvedAtIso ?? new Date().toISOString())
            : null,
        status,
      });
    } catch (caught) {
      setError(toMessage(caught, 'The issue status was not saved.'));
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return (
    <div className={styles.issueActions}>
      <span className={styles.actionLabel}>Issue status</span>
      {(['open', 'inProgress', 'resolved'] as const).map((status) => (
        <Button
          aria-pressed={issue.status === status}
          disabled={pending !== null}
          isBusy={pending === status}
          key={status}
          onClick={() => void update(status)}
          variant={issue.status === status ? 'secondary' : 'quiet'}
        >
          {status === 'inProgress' ? 'In progress' : humanize(status)}
        </Button>
      ))}
      {error ? <StatusBanner tone="error">{error}</StatusBanner> : null}
    </div>
  );
}

function activityLabel(item: FeedActivityItem) {
  const labels = {
    harvest: 'Harvest',
    issue: 'Issue',
    note: 'Note',
    photo: 'Photo update',
    watering: 'Watering',
  } as const;
  return labels[item.type];
}

function formatDate(value: string) {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
