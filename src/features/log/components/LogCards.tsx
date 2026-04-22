import type {
  Garden,
  HarvestEvent,
  IssueStatus,
  JournalEntry,
  Task,
} from '../../../domain/gardens/GardenRepository';
import {
  formatDate,
  formatHarvestAmount,
  formatIssue,
  formatIssueSeverity,
  formatIssueStatus,
} from '../logHelpers';
import styles from './LogCards.module.css';

export function JournalEntryCard({
  entry,
  linkedTasks = [],
  onUpdateIssue,
}: {
  entry: JournalEntry;
  linkedTasks?: Task[];
  onUpdateIssue?(entryId: string, status: IssueStatus): void;
}) {
  return (
    <article className={styles.entryCard}>
      <div className={styles.cardHeader}>
        <span>{entry.type === 'issue' ? 'Issue' : 'Note'}</span>
        <time>{formatDate(entry.occurredOn)}</time>
      </div>
      <h3>{entry.title}</h3>
      <p>{entry.body}</p>
      <div className={styles.meta}>
        <span>{entry.targetLabel}</span>
        {entry.issueCategory ? (
          <span>{formatIssue(entry.issueCategory)}</span>
        ) : null}
        {entry.issueSeverity ? (
          <span>{formatIssueSeverity(entry.issueSeverity)}</span>
        ) : null}
        {entry.issueStatus ? (
          <span>{formatIssueStatus(entry.issueStatus)}</span>
        ) : null}
        {linkedTasks.length > 0 ? (
          <span>
            {linkedTasks.length} linked task
            {linkedTasks.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      {entry.type === 'issue' && onUpdateIssue ? (
        <div className={styles.statusActions}>
          {(['open', 'inProgress', 'resolved'] as const).map((status) => (
            <button
              aria-pressed={entry.issueStatus === status}
              key={status}
              onClick={() => onUpdateIssue(entry.id, status)}
              type="button"
            >
              {formatIssueStatus(status)}
            </button>
          ))}
        </div>
      ) : null}
      {linkedTasks.length > 0 ? (
        <ul className={styles.linkedTaskList}>
          {linkedTasks.slice(0, 3).map((task) => (
            <li key={task.id}>
              <span>{task.title}</span>
              <strong>{task.status}</strong>
            </li>
          ))}
        </ul>
      ) : null}
      {entry.photos.length > 0 ? (
        <div className={styles.photoGrid}>
          {entry.photos.map((photo) => (
            <img alt={photo.fileName} key={photo.id} src={photo.downloadUrl} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function HarvestCard({
  garden,
  harvest,
}: {
  garden: Garden;
  harvest: HarvestEvent;
}) {
  const planting = garden.plantings.find(
    (candidate) => candidate.id === harvest.plantingId,
  );

  return (
    <article className={styles.entryCard}>
      <div className={styles.cardHeader}>
        <span>Harvest</span>
        <time>{formatDate(harvest.harvestedOn)}</time>
      </div>
      <h3>{planting?.label ?? 'Whole garden'}</h3>
      <p>{formatHarvestAmount(harvest)}</p>
      {harvest.notes ? <p>{harvest.notes}</p> : null}
    </article>
  );
}
