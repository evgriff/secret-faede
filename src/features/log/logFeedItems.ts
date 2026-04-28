import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  Garden,
  HarvestEvent,
  JournalEntry,
  PhotoAttachment,
  Task,
} from '../../domain/gardens/GardenRepository';
import type { PublishedGardenRevision } from '../../domain/gardens/gardenWorkspace';
import { formatHarvestAmount } from './logHelpers';
import type { LogFeedTypeFilter, LogFilterState } from './logSelectors';

export type LogFeedItemType =
  | 'harvest'
  | 'issue'
  | 'note'
  | 'photo'
  | 'publish'
  | 'task'
  | 'watering';

export interface LogFeedItem {
  authorLabel: string | null;
  bedId: string | null;
  body: string;
  cropId: string | null;
  date: string;
  id: string;
  issue: JournalEntry | null;
  linkedTasks: Task[];
  meta: string[];
  photos: PhotoAttachment[];
  plantingId: string | null;
  sortKey: string;
  targetLabel: string;
  title: string;
  type: LogFeedItemType;
}

export interface LogFeedFilterOptions {
  beds: Array<{ id: string; label: string }>;
  crops: Array<{ id: string; label: string }>;
  seasons: string[];
}

export function buildLogFeedItems({
  garden,
  revisions,
}: {
  garden: Garden;
  revisions: PublishedGardenRevision[];
}): LogFeedItem[] {
  return [
    ...garden.journalEntries.map((entry) =>
      createJournalFeedItem(garden, entry),
    ),
    ...garden.harvestEvents.map((harvest) =>
      createHarvestFeedItem(garden, harvest),
    ),
    ...garden.tasks
      .filter(isFeedWorthyTask)
      .map((task) => createTaskFeedItem(garden, task)),
    ...revisions.map((revision) => createPublishFeedItem(revision)),
  ].sort((left, right) => right.sortKey.localeCompare(left.sortKey));
}

export function filterLogFeedItems(
  items: LogFeedItem[],
  filters: LogFilterState,
) {
  const query = normalize(filters.query);
  const type = filters.type ?? 'all';
  const cropId = filters.cropId ?? 'all';
  const bedId = filters.bedId ?? 'all';
  const season = filters.season ?? 'all';

  return items.filter((item) => {
    if (!matchesType(item, type)) {
      return false;
    }

    if (cropId !== 'all' && item.cropId !== cropId) {
      return false;
    }

    if (bedId !== 'all' && item.bedId !== bedId) {
      return false;
    }

    if (season !== 'all' && item.date.slice(0, 4) !== season) {
      return false;
    }

    if (
      filters.issueStatus !== 'all' &&
      item.issue?.issueStatus !== filters.issueStatus
    ) {
      return false;
    }

    return (
      !query ||
      normalize(
        [
          item.body,
          item.meta.join(' '),
          item.targetLabel,
          item.authorLabel ?? '',
          item.title,
          item.type,
        ].join(' '),
      ).includes(query)
    );
  });
}

export function buildLogFeedFilterOptions(
  garden: Garden,
  items: LogFeedItem[],
): LogFeedFilterOptions {
  const cropIds = new Set(
    items.map((item) => item.cropId).filter((id): id is string => Boolean(id)),
  );
  const bedIds = new Set(
    items.map((item) => item.bedId).filter((id): id is string => Boolean(id)),
  );

  return {
    beds: garden.structures
      .filter((structure) => bedIds.has(structure.id))
      .map((structure) => ({ id: structure.id, label: structure.label })),
    crops: [...cropIds]
      .map((id) => ({ id, label: getCropById(id)?.commonName ?? id }))
      .sort((left, right) => left.label.localeCompare(right.label)),
    seasons: [...new Set(items.map((item) => item.date.slice(0, 4)))]
      .filter(Boolean)
      .sort((left, right) => right.localeCompare(left)),
  };
}

function isFeedWorthyTask(task: Task) {
  return (
    task.status === 'done' &&
    Boolean(task.completedAtIso) &&
    task.source !== 'wateringSchedule' &&
    (task.source === 'manual' ||
      task.source === 'succession' ||
      task.priority === 'high' ||
      ['harvest', 'inspect', 'trellis'].includes(task.type))
  );
}

function createJournalFeedItem(
  garden: Garden,
  entry: JournalEntry,
): LogFeedItem {
  const planting = entry.plantingId
    ? (garden.plantings.find(
        (candidate) => candidate.id === entry.plantingId,
      ) ?? null)
    : null;
  const type = getJournalFeedType(entry);
  const linkedTasks =
    entry.type === 'issue' ? getIssueTasks(garden, entry) : [];

  return {
    bedId: planting ? getPlantingBedId(garden, planting.id) : entry.structureId,
    authorLabel: getAuthorLabel(entry),
    body: entry.body,
    cropId: planting?.cropId ?? null,
    date: entry.occurredOn,
    id: `journal-${entry.id}`,
    issue: entry.type === 'issue' ? entry : null,
    linkedTasks,
    meta: [
      entry.targetLabel,
      entry.issueCategory ?? '',
      entry.issueSeverity ? `${entry.issueSeverity} severity` : '',
      entry.issueStatus ?? '',
    ].filter(Boolean),
    photos: entry.photos,
    plantingId: entry.plantingId,
    sortKey: entry.createdAtIso || `${entry.occurredOn}T12:00:00.000Z`,
    targetLabel: entry.targetLabel,
    title: entry.title,
    type,
  };
}

function createHarvestFeedItem(
  garden: Garden,
  harvest: HarvestEvent,
): LogFeedItem {
  const planting = harvest.plantingId
    ? (garden.plantings.find(
        (candidate) => candidate.id === harvest.plantingId,
      ) ?? null)
    : null;

  return {
    bedId: planting ? getPlantingBedId(garden, planting.id) : null,
    authorLabel: getAuthorLabel(harvest),
    body: harvest.notes,
    cropId: harvest.cropId,
    date: harvest.harvestedOn,
    id: `harvest-${harvest.id}`,
    issue: null,
    linkedTasks: [],
    meta: [formatHarvestAmount(harvest), planting?.label ?? 'Whole garden'],
    photos: [],
    plantingId: harvest.plantingId,
    sortKey: `${harvest.harvestedOn}T23:59:59.000Z`,
    targetLabel: planting?.label ?? 'Whole garden',
    title: `Harvested ${planting?.label ?? getCropById(harvest.cropId)?.commonName ?? 'garden produce'}`,
    type: 'harvest',
  };
}

function createTaskFeedItem(garden: Garden, task: Task): LogFeedItem {
  const planting = task.plantingId
    ? (garden.plantings.find((candidate) => candidate.id === task.plantingId) ??
      null)
    : null;

  return {
    bedId:
      task.structureId ??
      (planting ? getPlantingBedId(garden, planting.id) : null),
    authorLabel: getTaskAuthorLabel(task),
    body: task.notes,
    cropId: planting?.cropId ?? null,
    date:
      task.completedAtIso?.slice(0, 10) ??
      task.dueDate ??
      task.createdAtIso.slice(0, 10),
    id: `task-${task.id}`,
    issue: null,
    linkedTasks: [],
    meta: [
      task.bedLabel ?? 'Open plot',
      task.type,
      `${task.priority} priority`,
    ],
    photos: [],
    plantingId: task.plantingId,
    sortKey: task.completedAtIso ?? task.createdAtIso,
    targetLabel: task.bedLabel ?? planting?.label ?? 'Open plot',
    title: `Completed: ${task.title}`,
    type: 'task',
  };
}

function createPublishFeedItem(revision: PublishedGardenRevision): LogFeedItem {
  return {
    bedId: null,
    authorLabel: getEmailLabel(revision.publishedByEmail),
    body: revision.changesetSummary.summaryItems.join(', '),
    cropId: null,
    date: revision.publishedAtIso.slice(0, 10),
    id: `publish-${revision.id}`,
    issue: null,
    linkedTasks: [],
    meta: [revision.publishedByEmail, revision.action],
    photos: [],
    plantingId: null,
    sortKey: revision.publishedAtIso,
    targetLabel: 'Published garden',
    title: revision.action === 'revert' ? 'Published revert' : 'Published plan',
    type: 'publish',
  };
}

function getAuthorLabel(value: {
  createdByDisplayName?: string | null;
  createdByEmail?: string | null;
}) {
  return value.createdByDisplayName || getEmailLabel(value.createdByEmail);
}

function getTaskAuthorLabel(task: Task) {
  return (
    task.completedByDisplayName ||
    getEmailLabel(task.completedByEmail) ||
    task.createdByDisplayName ||
    getEmailLabel(task.createdByEmail)
  );
}

function getEmailLabel(email: string | null | undefined) {
  if (!email) {
    return null;
  }

  return email.split('@')[0] || email;
}

function getJournalFeedType(entry: JournalEntry): LogFeedItemType {
  if (entry.type === 'issue') {
    return 'issue';
  }

  if (isWateringEntry(entry)) {
    return 'watering';
  }

  if (entry.photos.length > 0) {
    return 'photo';
  }

  return 'note';
}

function isWateringEntry(entry: JournalEntry) {
  return (
    Boolean(entry.weatherSnapshotId) ||
    entry.title.toLowerCase().startsWith('watered ') ||
    entry.body.toLowerCase().startsWith('watered ')
  );
}

function getIssueTasks(garden: Garden, issue: JournalEntry) {
  return garden.tasks.filter((task) => task.sourceId === issue.id);
}

function getPlantingBedId(garden: Garden, plantingId: string) {
  const planting = garden.plantings.find(
    (candidate) => candidate.id === plantingId,
  );

  if (!planting) {
    return null;
  }

  return (
    garden.structures.find(
      (structure) =>
        isBedLike(structure.type) &&
        planting.xFt >= structure.xFt &&
        planting.xFt <= structure.xFt + structure.widthFt &&
        planting.yFt >= structure.yFt &&
        planting.yFt <= structure.yFt + structure.depthFt,
    )?.id ?? null
  );
}

function isBedLike(type: string) {
  return (
    type === 'bed' ||
    type === 'container' ||
    type === 'inGroundBed' ||
    type === 'raisedBed'
  );
}

function matchesType(item: LogFeedItem, type: LogFeedTypeFilter) {
  return (
    type === 'all' ||
    item.type === type ||
    (type === 'photo' && item.photos.length > 0)
  );
}

function normalize(value: string) {
  return value.toLowerCase().trim();
}
