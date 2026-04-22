import type { buildJournalAnalytics } from '../../journal/journalAnalytics';
import type {
  Garden,
  HarvestEvent,
  IssueStatus,
  JournalEntry,
} from '../../../domain/gardens/GardenRepository';
import type { LogView } from '../logSelectors';
import { HarvestSummary } from './HarvestSummary';
import { IssueTracker } from './IssueTracker';
import { MediaGallery } from './MediaGallery';
import { RecentEntries, RecentHarvests } from './LogHistorySections';
import { SeasonSummaryView } from './SeasonSummaryView';

export function LogWorkspaceSections({
  activeView,
  analytics,
  filteredEntries,
  filteredHarvests,
  filteredIssues,
  filteredPhotoEntries,
  garden,
  onUpdateIssue,
}: {
  activeView: LogView;
  analytics: ReturnType<typeof buildJournalAnalytics>;
  filteredEntries: JournalEntry[];
  filteredHarvests: HarvestEvent[];
  filteredIssues: JournalEntry[];
  filteredPhotoEntries: JournalEntry[];
  garden: Garden;
  onUpdateIssue(entryId: string, status: IssueStatus): void;
}) {
  if (activeView === 'journal') {
    return (
      <RecentEntries
        entries={filteredEntries}
        garden={garden}
        onUpdateIssue={onUpdateIssue}
      />
    );
  }

  if (activeView === 'issues') {
    return (
      <IssueTracker
        garden={garden}
        issues={filteredIssues}
        onUpdateIssue={onUpdateIssue}
      />
    );
  }

  if (activeView === 'harvests') {
    return (
      <>
        <HarvestSummary analytics={analytics} />
        <RecentHarvests garden={garden} harvests={filteredHarvests} />
      </>
    );
  }

  if (activeView === 'media') {
    return <MediaGallery entries={filteredPhotoEntries} />;
  }

  return <SeasonSummaryView analytics={analytics} />;
}
