import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  Garden,
  HarvestEvent,
  IssueStatus,
  JournalEntry,
  Task,
} from '../../domain/gardens/GardenRepository';
import { formatHarvestAmount } from './logHelpers';

export type LogView = 'harvests' | 'issues' | 'journal' | 'media' | 'season';
export type IssueStatusFilter = 'all' | IssueStatus;
export type LogFeedTypeFilter =
  | 'all'
  | 'harvest'
  | 'issue'
  | 'note'
  | 'photo'
  | 'publish'
  | 'task'
  | 'watering';

export interface LogFilterState {
  bedId?: string;
  cropId?: string;
  issueStatus: IssueStatusFilter;
  query: string;
  season?: string;
  targetId: string;
  type?: LogFeedTypeFilter;
}

export function filterJournalEntries(
  entries: JournalEntry[],
  filters: LogFilterState,
) {
  const query = normalize(filters.query);

  return entries.filter((entry) => {
    if (
      filters.targetId !== 'all' &&
      getEntryTargetId(entry) !== filters.targetId
    ) {
      return false;
    }

    if (
      filters.issueStatus !== 'all' &&
      entry.type === 'issue' &&
      entry.issueStatus !== filters.issueStatus
    ) {
      return false;
    }

    if (filters.issueStatus !== 'all' && entry.type !== 'issue') {
      return false;
    }

    return (
      !query ||
      normalize(
        [
          entry.body,
          entry.issueCategory,
          entry.issueSeverity,
          entry.issueStatus,
          entry.targetLabel,
          entry.title,
          entry.type,
        ].join(' '),
      ).includes(query)
    );
  });
}

export function filterHarvests(
  garden: Garden,
  harvests: HarvestEvent[],
  filters: LogFilterState,
) {
  const query = normalize(filters.query);

  return harvests.filter((harvest) => {
    if (
      filters.targetId !== 'all' &&
      filters.targetId !== getHarvestTargetId(harvest)
    ) {
      return false;
    }

    const planting = garden.plantings.find(
      (candidate) => candidate.id === harvest.plantingId,
    );
    const cropName = getCropById(harvest.cropId)?.commonName ?? '';

    return (
      !query ||
      normalize(
        [
          cropName,
          formatHarvestAmount(harvest),
          harvest.amountText,
          harvest.notes,
          planting?.label,
          harvest.unit,
        ].join(' '),
      ).includes(query)
    );
  });
}

export function getPhotoEntries(entries: JournalEntry[]) {
  return entries.filter((entry) => entry.photos.length > 0);
}

export function getIssueLinkedTasks(garden: Garden, issue: JournalEntry) {
  return garden.tasks
    .filter((task) => task.sourceId === issue.id)
    .sort((left, right) =>
      String(left.dueDate ?? '').localeCompare(String(right.dueDate ?? '')),
    );
}

export function buildIssueTimeline(issue: JournalEntry, linkedTasks: Task[]) {
  return [
    {
      date: issue.createdAtIso || issue.occurredOn,
      label: `Opened on ${issue.occurredOn}`,
    },
    ...linkedTasks.map((task) => ({
      date: task.completedAtIso ?? task.dueDate ?? task.createdAtIso,
      label:
        task.status === 'done'
          ? `Follow-up completed: ${task.title}`
          : `Follow-up ${task.status}: ${task.title}`,
    })),
    ...(issue.issueStatus === 'resolved'
      ? [
          {
            date: issue.occurredOn,
            label: 'Marked resolved',
          },
        ]
      : []),
  ].sort((left, right) => String(left.date).localeCompare(String(right.date)));
}

export function getEntryTargetId(entry: JournalEntry) {
  if (entry.targetType === 'planting' && entry.plantingId) {
    return `planting:${entry.plantingId}`;
  }

  if (entry.targetType === 'structure' && entry.structureId) {
    return `structure:${entry.structureId}`;
  }

  return 'garden';
}

function getHarvestTargetId(harvest: HarvestEvent) {
  return harvest.plantingId ? `planting:${harvest.plantingId}` : 'garden';
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}
