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

  return (
    <article className={cardStyles.issueCard}>
      <div className={cardStyles.cardHeader}>
        <span>{formatIssueStatus(issue.issueStatus)}</span>
        <time>{formatDate(issue.occurredOn)}</time>
      </div>
      <h4>{issue.title}</h4>
      <p>{issue.body}</p>
      <div className={cardStyles.meta}>
        <span>{issue.targetLabel}</span>
        {issue.issueCategory ? (
          <span>{formatIssue(issue.issueCategory)}</span>
        ) : null}
        <span>{formatIssueSeverity(issue.issueSeverity)}</span>
        <span>
          {linkedTasks.length} linked task{linkedTasks.length === 1 ? '' : 's'}
        </span>
        <span>
          {issue.photos.length} photo{issue.photos.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className={cardStyles.statusActions}>
        {lifecycleStatuses.map((status) => (
          <button
            aria-pressed={issue.issueStatus === status}
            key={status}
            onClick={() => onUpdateIssue(issue.id, status)}
            type="button"
          >
            {formatIssueStatus(status)}
          </button>
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
