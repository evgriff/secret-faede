import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { LoadingState } from '../../shared/ui/LoadingState';
import {
  LogComposerModal,
  type LogComposerMode,
} from './components/LogComposerModal';
import { LogFeed } from './components/LogFeed';
import { LogFilters } from './components/LogFilters';
import { LogPulseBar } from './components/LogPulseBar';
import { LogSaveState } from './components/LogSaveState';
import styles from './LogPage.module.css';
import { useLogController } from './useLogController';

export function LogPage() {
  const log = useLogController();
  const [searchParams] = useSearchParams();
  const [composerMode, setComposerMode] = useState<LogComposerMode | null>(
    null,
  );
  const focusedFeedItemId = searchParams.get('entry');
  const hasFilteredFeed = log.filteredFeedItems.length < log.feedItems.length;

  function openComposer(mode: LogComposerMode) {
    const hasEntryDraft = Boolean(
      log.entryBody.trim() || log.entryTitle.trim() || log.photoFiles.length,
    );

    if (mode === 'post') {
      log.setEntryType('note');
    }

    if (mode === 'issue') {
      log.setEntryType('issue');
    }

    if (mode === 'photo') {
      log.setEntryType('note');

      if (!hasEntryDraft) {
        log.setEntryTitle('Photo update');
      }
    }

    setComposerMode(mode);
  }

  if (log.loadStatus === 'loading') {
    return <LoadingState message="Loading garden memory." title="Feed" />;
  }

  if (log.loadStatus === 'error' || !log.garden || !log.analytics) {
    return (
      <section className={styles.page}>
        <h1>Feed</h1>
        <p role="alert">{log.error ?? 'Unable to load feed.'}</p>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Garden memory</p>
          <h1>Feed</h1>
          <p className={styles.summary}>
            {log.filteredFeedItems.length} of {log.feedItems.length} memories
            shown
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.composeButton}
            onClick={() => openComposer('post')}
            type="button"
          >
            New entry
          </button>
          <LogSaveState
            error={log.error}
            isOffline={log.isOffline}
            saveStatus={log.saveStatus}
          />
        </div>
      </header>

      <LogPulseBar
        analytics={log.analytics}
        feedItemCount={log.feedItems.length}
        harvestCount={log.garden.harvestEvents.length}
      />

      <div className={styles.layout}>
        <main className={styles.main}>
          <LogFilters
            filterOptions={log.feedFilterOptions}
            filters={log.filters}
            onFiltersChange={log.setFilters}
          />

          <LogFeed
            hasActiveFilters={hasFilteredFeed}
            focusedItemId={focusedFeedItemId}
            items={log.filteredFeedItems}
            onUpdateIssue={(entryId, status) =>
              void log.handleIssueStatusChange(entryId, status)
            }
            totalItemCount={log.feedItems.length}
          />
        </main>
      </div>

      {composerMode ? (
        <LogComposerModal
          log={log}
          mode={composerMode}
          onModeChange={openComposer}
          onClose={() => setComposerMode(null)}
        />
      ) : null}
    </section>
  );
}
