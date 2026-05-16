import type {
  GardenChangesetSummary,
  GardenPublishConflict,
  GardenSuggestionDecision,
  PublishedGardenRevision,
} from '../../../domain/gardens/gardenWorkspace';
import {
  Button,
  Modal,
  StatusBadge,
} from '../../shared/design/DesignPrimitives';
import styles from './PlanPublishModal.module.css';

export function PlanPublishModal({
  conflict,
  error,
  isPublishing,
  onClose,
  onPublish,
  onPublishAnyway,
  suggestionDecisions,
  summary,
}: {
  conflict: GardenPublishConflict | null;
  error: string | null;
  isPublishing: boolean;
  onClose(): void;
  onPublish(): void;
  onPublishAnyway(): void;
  suggestionDecisions: GardenSuggestionDecision[];
  summary: GardenChangesetSummary;
}) {
  const acceptedDecisions = suggestionDecisions.filter(
    (decision) => decision.status === 'accepted',
  );
  const physicalCount = acceptedDecisions.filter(
    (decision) => decision.impact === 'move',
  ).length;
  const lowRiskCount = acceptedDecisions.filter(
    (decision) => decision.impact === 'support',
  ).length;
  const deferredDecisions = suggestionDecisions.filter(
    (decision) => decision.status !== 'accepted',
  );
  const publishLabel = conflict ? 'Publish anyway' : 'Publish';

  function handlePublish() {
    if (isPublishing) {
      return;
    }

    if (physicalCount > 0 && !window.confirm('Publish physical moves?')) {
      return;
    }

    if (conflict) {
      onPublishAnyway();
    } else {
      onPublish();
    }
  }

  return (
    <Modal
      footer={
        <>
          <Button disabled={isPublishing} onClick={onClose} tone="secondary">
            Cancel
          </Button>
          <Button
            disabled={isPublishing}
            onClick={handlePublish}
            tone="primary"
            type="button"
          >
            {isPublishing ? 'Publishing...' : publishLabel}
          </Button>
        </>
      }
      onClose={onClose}
      title="Publish draft"
    >
      {conflict ? (
        <div className={styles.conflict} role="alert">
          <StatusBadge tone="warning">Stale base</StatusBadge>
          <p>{conflict.message}</p>
          <p>
            Draft base: {conflict.draftBaseRevisionId}. Current published:{' '}
            {conflict.currentRevisionId}.
          </p>
        </div>
      ) : null}

      <section className={styles.section}>
        <h3>Publish summary</h3>
        <p className={styles.muted}>
          {summary.summaryItems.length} changes / {lowRiskCount} support /{' '}
          {physicalCount} physical / {deferredDecisions.length} deferred.
        </p>
      </section>

      <section className={styles.section}>
        <h3>Changed in this draft</h3>
        <ul className={styles.changeList}>
          {summary.summaryItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h3>Accepted into this draft</h3>
        {acceptedDecisions.length > 0 ? (
          <ul className={styles.decisionList}>
            {acceptedDecisions.map((decision) => (
              <li key={decision.id}>
                <StatusBadge tone="success">accepted</StatusBadge>
                <span>{decision.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>No applied problem resolutions.</p>
        )}
      </section>

      <section className={styles.section}>
        <h3>Ignored or rejected</h3>
        {deferredDecisions.length > 0 ? (
          <ul className={styles.decisionList}>
            {deferredDecisions.map((decision) => (
              <li key={decision.id}>
                <StatusBadge>{formatDecisionStatus(decision)}</StatusBadge>
                <span>{decision.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>No ignored or rejected problems.</p>
        )}
      </section>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

export function RevisionHistoryModal({
  currentRevisionId,
  error,
  isReverting,
  onClose,
  onRevert,
  revisions,
  timezone,
}: {
  currentRevisionId: string;
  error: string | null;
  isReverting: boolean;
  onClose(): void;
  onRevert(revisionId: string): void;
  revisions: PublishedGardenRevision[];
  timezone: string | null | undefined;
}) {
  return (
    <Modal
      footer={
        <Button onClick={onClose} tone="secondary">
          Close
        </Button>
      }
      onClose={onClose}
      title="Revision history"
    >
      <ul className={styles.revisionList}>
        {revisions.map((revision) => (
          <li className={styles.revisionItem} key={revision.id}>
            <div>
              <div className={styles.revisionTitle}>
                <strong>{formatRevisionTitle(revision)}</strong>
                {revision.id === currentRevisionId ? (
                  <StatusBadge tone="success">Current</StatusBadge>
                ) : null}
              </div>
              <p>
                {formatDateTime(revision.publishedAtIso, timezone)} by{' '}
                {revision.publishedByEmail}
              </p>
              <p>{revision.changesetSummary.summaryItems.join(', ')}</p>
            </div>
            <Button
              disabled={isReverting || revision.id === currentRevisionId}
              onClick={() => {
                if (window.confirm('Revert draft?')) {
                  onRevert(revision.id);
                }
              }}
              tone="secondary"
              type="button"
            >
              {revision.id === currentRevisionId
                ? 'Current'
                : isReverting
                  ? 'Reverting...'
                  : 'Review revert'}
            </Button>
          </li>
        ))}
      </ul>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

function formatRevisionTitle(revision: PublishedGardenRevision) {
  if (revision.action === 'revert') {
    return `Revert to ${revision.revertedFromRevisionId ?? 'prior revision'}`;
  }

  if (revision.action === 'initial') {
    return 'Initial publish';
  }

  return 'Published draft';
}

function formatDecisionStatus(decision: GardenSuggestionDecision) {
  return decision.status === 'snoozed' ? 'ignored' : decision.status;
}

function formatDateTime(value: string, timezone: string | null | undefined) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone || 'UTC',
  }).format(date);
}
