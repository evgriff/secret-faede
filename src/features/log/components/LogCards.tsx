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
import {
  ActionButton,
  InfoChip,
  StatusBadge,
} from '../../shared/design/DesignPrimitives';
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
        <StatusBadge tone={entry.type === 'issue' ? 'warning' : 'neutral'}>
          {entry.type === 'issue' ? 'Issue' : 'Note'}
        </StatusBadge>
        <time>{formatDate(entry.occurredOn)}</time>
      </div>
      <h3>{entry.title}</h3>
      <p>{entry.body}</p>
      <div className={styles.meta}>
        <InfoChip>{entry.targetLabel}</InfoChip>
        {entry.issueCategory ? (
          <InfoChip>{formatIssue(entry.issueCategory)}</InfoChip>
        ) : null}
        {entry.issueSeverity ? (
          <InfoChip
            tone={entry.issueSeverity === 'high' ? 'warning' : 'neutral'}
          >
            {formatIssueSeverity(entry.issueSeverity)}
          </InfoChip>
        ) : null}
        {entry.issueStatus ? (
          <StatusBadge tone={getIssueTone(entry.issueStatus)}>
            {formatIssueStatus(entry.issueStatus)}
          </StatusBadge>
        ) : null}
        {linkedTasks.length > 0 ? (
          <InfoChip>
            {linkedTasks.length} linked task
            {linkedTasks.length === 1 ? '' : 's'}
          </InfoChip>
        ) : null}
      </div>
      {entry.type === 'issue' && onUpdateIssue ? (
        <div className={styles.statusActions}>
          {(['open', 'inProgress', 'resolved'] as const).map((status) => (
            <ActionButton
              aria-pressed={entry.issueStatus === status}
              intent={getIssueActionIntent(status)}
              key={status}
              onClick={() => onUpdateIssue(entry.id, status)}
              priority={entry.issueStatus === status ? 'primary' : 'secondary'}
              type="button"
            >
              {formatIssueStatus(status)}
            </ActionButton>
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

function getIssueTone(status: IssueStatus) {
  if (status === 'resolved') {
    return 'success';
  }

  return status === 'inProgress' ? 'warning' : 'neutral';
}

function getIssueActionIntent(status: IssueStatus) {
  if (status === 'resolved') {
    return 'success';
  }

  return status === 'inProgress' ? 'warning' : 'neutral';
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
        <StatusBadge tone="success">Harvest</StatusBadge>
        <time>{formatDate(harvest.harvestedOn)}</time>
      </div>
      <h3>{planting?.label ?? 'Whole garden'}</h3>
      <p>{formatHarvestAmount(harvest)}</p>
      {harvest.notes ? <p>{harvest.notes}</p> : null}
    </article>
  );
}
