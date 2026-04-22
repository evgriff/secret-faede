import type {
  Garden,
  IssueStatus,
  JournalEntry,
} from '../../../domain/gardens/GardenRepository';
import {
  formatDate,
  formatIssue,
  formatIssueSeverity,
  formatIssueStatus,
} from '../logHelpers';
import {
  ActionButton,
  InfoChip,
  StatusBadge,
} from '../../shared/design/DesignPrimitives';
import { buildIssueTimeline, getIssueLinkedTasks } from '../logSelectors';
import cardStyles from './LogCards.module.css';
import pageStyles from '../LogPage.module.css';

const lifecycleStatuses: IssueStatus[] = ['open', 'inProgress', 'resolved'];

export function IssueTracker({
  garden,
  issues,
  onUpdateIssue,
}: {
  garden: Garden;
  issues: JournalEntry[];
  onUpdateIssue(entryId: string, status: IssueStatus): void;
}) {
  return (
    <section className={pageStyles.panel}>
      <div className={pageStyles.sectionHeader}>
        <div>
          <h2>Issue tracking</h2>
          <p className={pageStyles.summary}>
            Open, in-progress, and resolved garden problems.
          </p>
        </div>
      </div>
      {issues.length > 0 ? (
        <div className={cardStyles.issueBoard}>
          {lifecycleStatuses.map((status) => (
            <section className={cardStyles.issueColumn} key={status}>
              <h3>{formatIssueStatus(status)}</h3>
              {issues
                .filter((issue) => issue.issueStatus === status)
                .map((issue) => (
                  <IssueTrackerCard
                    garden={garden}
                    issue={issue}
                    key={issue.id}
                    onUpdateIssue={onUpdateIssue}
                  />
                ))}
            </section>
          ))}
        </div>
      ) : (
        <p className={cardStyles.empty}>No issues match the current filters.</p>
      )}
    </section>
  );
}

function IssueTrackerCard({
  garden,
  issue,
  onUpdateIssue,
}: {
  garden: Garden;
  issue: JournalEntry;
  onUpdateIssue(entryId: string, status: IssueStatus): void;
}) {
  const linkedTasks = getIssueLinkedTasks(garden, issue);
  const timeline = buildIssueTimeline(issue, linkedTasks);
  const issueStatus = issue.issueStatus ?? 'open';

  return (
    <article className={cardStyles.issueCard}>
      <div className={cardStyles.cardHeader}>
        <StatusBadge tone={getIssueTone(issueStatus)}>
          {formatIssueStatus(issueStatus)}
        </StatusBadge>
        <time>{formatDate(issue.occurredOn)}</time>
      </div>
      <h4>{issue.title}</h4>
      <p>{issue.body}</p>
      <div className={cardStyles.meta}>
        <InfoChip>{issue.targetLabel}</InfoChip>
        {issue.issueCategory ? (
          <InfoChip>{formatIssue(issue.issueCategory)}</InfoChip>
        ) : null}
        <InfoChip tone={issue.issueSeverity === 'high' ? 'warning' : 'neutral'}>
          {formatIssueSeverity(issue.issueSeverity)}
        </InfoChip>
        <InfoChip>
          {linkedTasks.length} linked task{linkedTasks.length === 1 ? '' : 's'}
        </InfoChip>
        <InfoChip>
          {issue.photos.length} photo{issue.photos.length === 1 ? '' : 's'}
        </InfoChip>
      </div>
      <div className={cardStyles.statusActions}>
        {lifecycleStatuses.map((status) => (
          <ActionButton
            aria-pressed={issueStatus === status}
            intent={getIssueActionIntent(status)}
            key={status}
            onClick={() => onUpdateIssue(issue.id, status)}
            priority={issueStatus === status ? 'primary' : 'secondary'}
            type="button"
          >
            {formatIssueStatus(status)}
          </ActionButton>
        ))}
      </div>
      <ol className={cardStyles.timeline}>
        {timeline.slice(0, 4).map((event) => (
          <li key={`${event.date}-${event.label}`}>
            <span>{event.label}</span>
          </li>
        ))}
      </ol>
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
