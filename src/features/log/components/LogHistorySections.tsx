import type {
  Garden,
  HarvestEvent,
  IssueStatus,
  JournalEntry,
} from '../../../domain/gardens/GardenRepository';
import { HarvestCard, JournalEntryCard } from './LogCards';
import { getIssueLinkedTasks } from '../logSelectors';
import cardStyles from './LogCards.module.css';
import pageStyles from '../LogPage.module.css';

export function RecentEntries({
  entries,
  garden,
  onUpdateIssue,
  title = 'Journal feed',
}: {
  entries: JournalEntry[];
  garden: Garden;
  onUpdateIssue(entryId: string, status: IssueStatus): void;
  title?: string;
}) {
  return (
    <section className={pageStyles.panel}>
      <h2>{title}</h2>
      {entries.length > 0 ? (
        <div className={cardStyles.entryList}>
          {entries.map((entry) => (
            <JournalEntryCard
              entry={entry}
              key={entry.id}
              linkedTasks={
                entry.type === 'issue' ? getIssueLinkedTasks(garden, entry) : []
              }
              onUpdateIssue={onUpdateIssue}
            />
          ))}
        </div>
      ) : (
        <p className={cardStyles.empty}>
          No journal entries match the filters.
        </p>
      )}
    </section>
  );
}

export function RecentHarvests({
  garden,
  harvests,
}: {
  garden: Garden;
  harvests: HarvestEvent[];
}) {
  return (
    <section className={pageStyles.panel}>
      <h2>Recent harvests</h2>
      {harvests.length > 0 ? (
        <div className={cardStyles.entryList}>
          {harvests.map((harvest) => (
            <HarvestCard garden={garden} harvest={harvest} key={harvest.id} />
          ))}
        </div>
      ) : (
        <p className={cardStyles.empty}>No harvests logged yet.</p>
      )}
    </section>
  );
}
