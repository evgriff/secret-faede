import type {
  GardenChangesetSummary,
  GardenPublishConflict,
  GardenSuggestionDecision,
  PublishedGardenRevision,
} from '../../../domain/gardens/gardenWorkspace';
import { Modal, StatusBadge } from '../../shared/design/DesignPrimitives';
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
  return (
    <Modal
      description="Review draft changes before they become the shared published garden."
      footer={
        <>
          <button
            className={styles.secondaryButton}
            disabled={isPublishing}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          {conflict ? (
            <button
              className={styles.primaryButton}
              disabled={isPublishing}
              onClick={onPublishAnyway}
              type="button"
            >
              {isPublishing ? 'Publishing...' : 'Publish anyway'}
            </button>
          ) : (
            <button
              className={styles.primaryButton}
              disabled={isPublishing}
              onClick={onPublish}
              type="button"
            >
              {isPublishing ? 'Publishing...' : 'Publish'}
            </button>
          )}
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
        <h3>Changed in this draft</h3>
        <ul className={styles.changeList}>
          {summary.summaryItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h3>Accepted into this draft</h3>
        {suggestionDecisions.some(
          (decision) => decision.status === 'accepted',
        ) ? (
          <ul className={styles.decisionList}>
            {suggestionDecisions
              .filter((decision) => decision.status === 'accepted')
              .map((decision) => (
                <li key={decision.id}>
                  <StatusBadge tone="success">accepted</StatusBadge>
                  <span>{decision.label}</span>
                </li>
              ))}
          </ul>
        ) : (
          <p className={styles.muted}>No accepted review proposals.</p>
        )}
      </section>

      <section className={styles.section}>
        <h3>Rejected or snoozed</h3>
        {suggestionDecisions.some(
          (decision) => decision.status !== 'accepted',
        ) ? (
          <ul className={styles.decisionList}>
            {suggestionDecisions
              .filter((decision) => decision.status !== 'accepted')
              .map((decision) => (
                <li key={decision.id}>
                  <StatusBadge>{decision.status}</StatusBadge>
                  <span>{decision.label}</span>
                </li>
              ))}
          </ul>
        ) : (
          <p className={styles.muted}>No rejected or snoozed proposals.</p>
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
}: {
  currentRevisionId: string;
  error: string | null;
  isReverting: boolean;
  onClose(): void;
  onRevert(revisionId: string): void;
  revisions: PublishedGardenRevision[];
}) {
  return (
    <Modal
      description="Published versions can be restored as a new published revision."
      footer={
        <button
          className={styles.secondaryButton}
          onClick={onClose}
          type="button"
        >
          Close
        </button>
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
                {formatDateTime(revision.publishedAtIso)} by{' '}
                {revision.publishedByEmail}
              </p>
              <p>{revision.changesetSummary.summaryItems.join(', ')}</p>
            </div>
            <button
              className={styles.secondaryButton}
              disabled={isReverting || revision.id === currentRevisionId}
              onClick={() => onRevert(revision.id)}
              type="button"
            >
              Revert
            </button>
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

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
