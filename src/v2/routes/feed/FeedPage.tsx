import { useMemo, useState } from 'react';

import { Button, ErrorState, LoadingState, StatusBanner } from '../../ui';
import { FeedActivityStream } from './FeedActivityStream';
import { FeedComposer } from './FeedComposer';
import { FeedFilters } from './FeedFilters';
import { WateringCorrectionDialog } from './WateringCorrectionDialog';
import {
  buildFeedActivity,
  emptyFeedFilters,
  filterFeedActivity,
  hasActiveFeedFilters,
  summarizeFeed,
} from './feedModel';
import styles from './FeedPage.module.css';
import type { FeedCreateResult, FeedPageProps } from './types';

export function FeedPage({
  LinkComponent,
  currentUserId,
  errorMessage,
  getPhotoUrl,
  harvests,
  isOnline,
  journalEntries,
  loadState = 'ready',
  onCreateEntry,
  onCorrectWatering,
  onRetry,
  onUpdateIssue,
  targets,
  timezone,
  today,
  wateringActivity = [],
}: FeedPageProps) {
  const [filters, setFilters] = useState(emptyFeedFilters);
  const [composerOpen, setComposerOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState<{
    kind: 'entry' | 'wateringCorrection';
    result: FeedCreateResult;
  } | null>(null);
  const [correctingWatering, setCorrectingWatering] = useState<
    | Extract<
        (typeof wateringActivity)[number],
        { kind: 'application' }
      >['application']
    | null
  >(null);
  const items = useMemo(
    () =>
      buildFeedActivity({
        harvests,
        journalEntries,
        targets,
        wateringActivity,
      }),
    [harvests, journalEntries, targets, wateringActivity],
  );
  const summary = useMemo(() => summarizeFeed(items), [items]);
  const filteredItems = useMemo(
    () => filterFeedActivity(items, filters),
    [filters, items],
  );

  if (loadState === 'loading') {
    return (
      <main className={styles.page} data-sf-v2="feed">
        <LoadingState
          detail="Gathering private notes, harvests, photos, issues, and watering history."
          title="Loading Feed"
        />
      </main>
    );
  }

  if (loadState === 'error') {
    const retryProps = onRetry ? { onRetry } : {};
    return (
      <main className={styles.page} data-sf-v2="feed">
        <ErrorState
          detail={
            errorMessage ?? 'The private activity stream could not be loaded.'
          }
          title="Feed is unavailable"
          {...retryProps}
        />
      </main>
    );
  }

  return (
    <main className={styles.page} data-sf-v2="feed">
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Garden memory</p>
          <h1>Feed</h1>
          <p>
            A private record of what happened, including crop-specific watering
            decisions and actual applications.
          </p>
        </div>
        <Button onClick={() => setComposerOpen(true)}>New entry</Button>
      </header>

      {!isOnline ? (
        <StatusBanner tone="warning">
          You are offline. A text-only entry may be accepted by this device
          before it reaches the shared history. Selected photo files cannot
          upload or queue until this device reconnects.
        </StatusBanner>
      ) : null}
      {saveNotice ? (
        <StatusBanner
          live
          tone={saveNotice.result === 'saved' ? 'success' : 'warning'}
        >
          {saveNotice.kind === 'wateringCorrection'
            ? saveNotice.result === 'saved'
              ? 'Watering correction saved. Its revision increased and the crop balance will regenerate.'
              : 'Watering correction saved locally and queued to sync.'
            : saveNotice.result === 'saved'
              ? 'Entry saved to the private garden history.'
              : 'Entry saved locally and queued to sync.'}
        </StatusBanner>
      ) : null}

      <SummaryStrip summary={summary} />
      <FeedFilters filters={filters} onChange={setFilters} targets={targets} />
      <FeedActivityStream
        LinkComponent={LinkComponent}
        currentUserId={currentUserId}
        hasActiveFilters={hasActiveFeedFilters(filters)}
        items={filteredItems}
        {...(onCorrectWatering
          ? { onCorrectWatering: setCorrectingWatering }
          : {})}
        totalCount={items.length}
        {...(getPhotoUrl ? { getPhotoUrl } : {})}
        {...(onUpdateIssue ? { onUpdateIssue } : {})}
      />
      <FeedComposer
        isOnline={isOnline}
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        onCreateEntry={onCreateEntry}
        onSaved={(result) => setSaveNotice({ kind: 'entry', result })}
        targets={targets}
        today={today}
      />
      {onCorrectWatering ? (
        <WateringCorrectionDialog
          application={correctingWatering}
          onClose={() => setCorrectingWatering(null)}
          onCorrect={onCorrectWatering}
          onSaved={(result) =>
            setSaveNotice({ kind: 'wateringCorrection', result })
          }
          timezone={timezone}
          today={today}
        />
      ) : null}
    </main>
  );
}

function SummaryStrip({
  summary,
}: {
  summary: ReturnType<typeof summarizeFeed>;
}) {
  const values = [
    ['Memories', summary.memories],
    ['Open issues', summary.openIssues],
    ['Harvests', summary.harvests],
    ['Photos', summary.photos],
    ['Watering', summary.watering],
  ] as const;
  return (
    <section aria-label="Feed summary" className={styles.summaryStrip}>
      {values.map(([label, value]) => (
        <div key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </div>
      ))}
    </section>
  );
}
