import { createDefaultGarden, type Garden } from './models';
import {
  isRecord,
  parseGarden,
  readNullableString,
  readString,
  readStringUnion,
} from './validation';

export type GardenRevisionAction = 'initial' | 'publish' | 'revert';
export type GardenSuggestionDecisionImpact = 'move' | 'planned' | 'support';
export type SuggestionDecisionStatus = 'accepted' | 'rejected' | 'snoozed';

export interface GardenSuggestionDecision {
  decidedAtIso: string;
  id: string;
  impact: GardenSuggestionDecisionImpact;
  label: string;
  note: string | null;
  status: SuggestionDecisionStatus;
}

export interface GardenChangesetSummary {
  acceptedSuggestionCount: number;
  harvestEventsAdded: number;
  journalEntriesAdded: number;
  plantingsAdded: number;
  plantingsChanged: number;
  plantingsRemoved: number;
  plotChanged: boolean;
  rejectedSuggestionCount: number;
  snoozedSuggestionCount: number;
  structuresAdded: number;
  structuresChanged: number;
  structuresRemoved: number;
  summaryItems: string[];
  tasksChanged: number;
  wantedCropsAdded: number;
  wantedCropsChanged: number;
  wantedCropsRemoved: number;
}

export interface PublishedGardenRevision {
  action: GardenRevisionAction;
  baseRevisionId: string | null;
  changesetSummary: GardenChangesetSummary;
  garden: Garden;
  id: string;
  publishedAtIso: string;
  publishedByEmail: string;
  publishedByUserId: string;
  revertedFromRevisionId: string | null;
  suggestionDecisions: GardenSuggestionDecision[];
}

export interface GardenDraft {
  baseRevisionId: string;
  garden: Garden;
  suggestionDecisions: GardenSuggestionDecision[];
  updatedAtIso: string;
  userId: string;
}

export interface GardenPublishConflict {
  currentRevisionId: string;
  draftBaseRevisionId: string;
  message: string;
}

export interface GardenPublishRequest {
  force?: boolean;
  userEmail: string;
  userId: string;
}

export interface GardenRevertRequest {
  revisionId: string;
  userEmail: string;
  userId: string;
}

export interface GardenPublishResult {
  conflict: GardenPublishConflict | null;
  revision: PublishedGardenRevision | null;
  status: 'conflict' | 'published';
  workspace: GardenWorkspace;
}

export interface GardenWorkspace {
  draft: GardenDraft;
  draftChanged: boolean;
  draftIsStale: boolean;
  hasDraft: boolean;
  published: PublishedGardenRevision;
  revisions: PublishedGardenRevision[];
}

const emptyChangesetSummary: GardenChangesetSummary = {
  acceptedSuggestionCount: 0,
  harvestEventsAdded: 0,
  journalEntriesAdded: 0,
  plantingsAdded: 0,
  plantingsChanged: 0,
  plantingsRemoved: 0,
  plotChanged: false,
  rejectedSuggestionCount: 0,
  snoozedSuggestionCount: 0,
  structuresAdded: 0,
  structuresChanged: 0,
  structuresRemoved: 0,
  summaryItems: ['Initial published garden'],
  tasksChanged: 0,
  wantedCropsAdded: 0,
  wantedCropsChanged: 0,
  wantedCropsRemoved: 0,
};

export function createInitialGardenRevision(
  userId: string,
  nowIso = new Date().toISOString(),
): PublishedGardenRevision {
  return {
    action: 'initial',
    baseRevisionId: null,
    changesetSummary: emptyChangesetSummary,
    garden: createDefaultGarden(userId),
    id: 'revision-initial',
    publishedAtIso: nowIso,
    publishedByEmail: 'system',
    publishedByUserId: 'system',
    revertedFromRevisionId: null,
    suggestionDecisions: [],
  };
}

export function createDraftFromPublished(
  published: PublishedGardenRevision,
  userId: string,
  nowIso = new Date().toISOString(),
): GardenDraft {
  return {
    baseRevisionId: published.id,
    garden: prepareGardenForUser(published.garden, userId),
    suggestionDecisions: [],
    updatedAtIso: nowIso,
    userId,
  };
}

export function prepareGardenForUser(garden: Garden, userId: string): Garden {
  return {
    ...garden,
    harvestEvents: garden.harvestEvents.map((harvest) => ({
      ...harvest,
      gardenId: userId,
    })),
    id: userId,
    journalEntries: garden.journalEntries.map((entry) => ({
      ...entry,
      gardenId: userId,
    })),
    notificationLogs: garden.notificationLogs.map((log) => ({
      ...log,
      gardenId: log.gardenId ? userId : null,
      userId,
    })),
    sunShadeLayers: garden.sunShadeLayers.map((layer) => ({
      ...layer,
      gardenId: userId,
    })),
    tasks: garden.tasks.map((task) => ({
      ...task,
      gardenId: userId,
    })),
    updatedAtIso: garden.updatedAtIso,
    userId,
    wateringSchedule: garden.wateringSchedule.map((entry) => ({
      ...entry,
      gardenId: userId,
    })),
    weatherSnapshots: garden.weatherSnapshots.map((snapshot) => ({
      ...snapshot,
      gardenId: userId,
    })),
  };
}

export function createGardenChangesetSummary(
  baseGarden: Garden,
  nextGarden: Garden,
  suggestionDecisions: GardenSuggestionDecision[] = [],
): GardenChangesetSummary {
  const plantings = diffById(baseGarden.plantings, nextGarden.plantings);
  const structures = diffById(baseGarden.structures, nextGarden.structures);
  const taskChanges = diffById(baseGarden.tasks, nextGarden.tasks);
  const wantedCrops = diffById(
    baseGarden.seasonPlan.wantedCrops,
    nextGarden.seasonPlan.wantedCrops,
  );
  const acceptedSuggestionCount = suggestionDecisions.filter(
    (decision) => decision.status === 'accepted',
  ).length;
  const rejectedSuggestionCount = suggestionDecisions.filter(
    (decision) => decision.status === 'rejected',
  ).length;
  const snoozedSuggestionCount = suggestionDecisions.filter(
    (decision) => decision.status === 'snoozed',
  ).length;
  const plotChanged = !sameData(baseGarden.plot, nextGarden.plot);
  const journalEntriesAdded = countAdded(
    baseGarden.journalEntries,
    nextGarden.journalEntries,
  );
  const harvestEventsAdded = countAdded(
    baseGarden.harvestEvents,
    nextGarden.harvestEvents,
  );
  const summaryItems = [
    ...(plotChanged ? ['Plot settings changed'] : []),
    ...formatCount(plantings.added, 'planting added', 'plantings added'),
    ...formatCount(plantings.removed, 'planting removed', 'plantings removed'),
    ...formatCount(plantings.changed, 'planting edited', 'plantings edited'),
    ...formatCount(structures.added, 'structure added', 'structures added'),
    ...formatCount(
      structures.removed,
      'structure removed',
      'structures removed',
    ),
    ...formatCount(structures.changed, 'structure edited', 'structures edited'),
    ...formatCount(taskChanges.total, 'task changed', 'tasks changed'),
    ...formatCount(
      wantedCrops.added,
      'wanted crop added',
      'wanted crops added',
    ),
    ...formatCount(
      wantedCrops.removed,
      'wanted crop removed',
      'wanted crops removed',
    ),
    ...formatCount(
      wantedCrops.changed,
      'wanted crop edited',
      'wanted crops edited',
    ),
    ...formatCount(
      journalEntriesAdded,
      'journal entry added',
      'journal entries added',
    ),
    ...formatCount(
      harvestEventsAdded,
      'harvest record added',
      'harvest records added',
    ),
    ...formatCount(
      acceptedSuggestionCount,
      'resolution applied',
      'resolutions applied',
    ),
    ...formatCount(
      rejectedSuggestionCount,
      'legacy decision rejected',
      'legacy decisions rejected',
    ),
    ...formatCount(
      snoozedSuggestionCount,
      'problem ignored',
      'problems ignored',
    ),
  ];

  return {
    acceptedSuggestionCount,
    harvestEventsAdded,
    journalEntriesAdded,
    plantingsAdded: plantings.added,
    plantingsChanged: plantings.changed,
    plantingsRemoved: plantings.removed,
    plotChanged,
    rejectedSuggestionCount,
    snoozedSuggestionCount,
    structuresAdded: structures.added,
    structuresChanged: structures.changed,
    structuresRemoved: structures.removed,
    summaryItems:
      summaryItems.length > 0 ? summaryItems : ['No publishable changes'],
    tasksChanged: taskChanges.total,
    wantedCropsAdded: wantedCrops.added,
    wantedCropsChanged: wantedCrops.changed,
    wantedCropsRemoved: wantedCrops.removed,
  };
}

export function hasGardenChanges(summary: GardenChangesetSummary): boolean {
  return (
    summary.plotChanged ||
    summary.plantingsAdded > 0 ||
    summary.plantingsChanged > 0 ||
    summary.plantingsRemoved > 0 ||
    summary.structuresAdded > 0 ||
    summary.structuresChanged > 0 ||
    summary.structuresRemoved > 0 ||
    summary.tasksChanged > 0 ||
    summary.journalEntriesAdded > 0 ||
    summary.harvestEventsAdded > 0 ||
    summary.acceptedSuggestionCount > 0 ||
    summary.rejectedSuggestionCount > 0 ||
    summary.snoozedSuggestionCount > 0 ||
    summary.wantedCropsAdded > 0 ||
    summary.wantedCropsChanged > 0 ||
    summary.wantedCropsRemoved > 0
  );
}

export function parseGardenSuggestionDecisions(
  value: unknown,
): GardenSuggestionDecision[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): GardenSuggestionDecision[] => {
    if (!isRecord(entry) || typeof entry.id !== 'string') {
      return [];
    }

    return [
      {
        decidedAtIso: readString(entry.decidedAtIso),
        id: entry.id,
        impact: readStringUnion(
          entry.impact,
          ['move', 'planned', 'support'] as const,
          'planned',
        ),
        label: readString(entry.label, 'Review suggestion'),
        note: readNullableString(entry.note),
        status: readStringUnion(
          entry.status,
          ['accepted', 'rejected', 'snoozed'] as const,
          'accepted',
        ),
      },
    ];
  });
}

export function parsePublishedGardenRevision(
  userId: string,
  value: unknown,
): PublishedGardenRevision | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  return {
    action: readStringUnion(
      value.action,
      ['initial', 'publish', 'revert'] as const,
      'publish',
    ),
    baseRevisionId: readNullableString(value.baseRevisionId),
    changesetSummary: parseChangesetSummary(value.changesetSummary),
    garden: parseGarden(userId, value.garden),
    id: value.id,
    publishedAtIso: readString(value.publishedAtIso),
    publishedByEmail: readString(value.publishedByEmail, 'unknown'),
    publishedByUserId: readString(value.publishedByUserId, 'unknown'),
    revertedFromRevisionId: readNullableString(value.revertedFromRevisionId),
    suggestionDecisions: parseGardenSuggestionDecisions(
      value.suggestionDecisions,
    ),
  };
}

export function parseGardenDraft(
  userId: string,
  value: unknown,
  published: PublishedGardenRevision,
): GardenDraft | null {
  if (!isRecord(value)) {
    return null;
  }

  const baseRevisionId = readString(value.baseRevisionId, published.id);
  const garden = parseGarden(userId, value.garden);

  return {
    baseRevisionId,
    garden: prepareGardenForUser(garden, userId),
    suggestionDecisions: parseGardenSuggestionDecisions(
      value.suggestionDecisions,
    ),
    updatedAtIso: readString(value.updatedAtIso, new Date().toISOString()),
    userId,
  };
}

function parseChangesetSummary(value: unknown): GardenChangesetSummary {
  if (!isRecord(value)) {
    return {
      ...emptyChangesetSummary,
      summaryItems: ['Published revision'],
    };
  }

  const summaryItems = Array.isArray(value.summaryItems)
    ? value.summaryItems.flatMap((item): string[] =>
        typeof item === 'string' && item.trim() ? [item] : [],
      )
    : [];

  return {
    acceptedSuggestionCount: readNumberFromRecord(
      value,
      'acceptedSuggestionCount',
    ),
    harvestEventsAdded: readNumberFromRecord(value, 'harvestEventsAdded'),
    journalEntriesAdded: readNumberFromRecord(value, 'journalEntriesAdded'),
    plantingsAdded: readNumberFromRecord(value, 'plantingsAdded'),
    plantingsChanged: readNumberFromRecord(value, 'plantingsChanged'),
    plantingsRemoved: readNumberFromRecord(value, 'plantingsRemoved'),
    plotChanged: value.plotChanged === true,
    rejectedSuggestionCount: readNumberFromRecord(
      value,
      'rejectedSuggestionCount',
    ),
    snoozedSuggestionCount: readNumberFromRecord(
      value,
      'snoozedSuggestionCount',
    ),
    structuresAdded: readNumberFromRecord(value, 'structuresAdded'),
    structuresChanged: readNumberFromRecord(value, 'structuresChanged'),
    structuresRemoved: readNumberFromRecord(value, 'structuresRemoved'),
    summaryItems: summaryItems.length > 0 ? summaryItems : ['Published change'],
    tasksChanged: readNumberFromRecord(value, 'tasksChanged'),
    wantedCropsAdded: readNumberFromRecord(value, 'wantedCropsAdded'),
    wantedCropsChanged: readNumberFromRecord(value, 'wantedCropsChanged'),
    wantedCropsRemoved: readNumberFromRecord(value, 'wantedCropsRemoved'),
  };
}

function readNumberFromRecord(record: Record<string, unknown>, key: string) {
  return typeof record[key] === 'number' && Number.isFinite(record[key])
    ? record[key]
    : 0;
}

function diffById<T extends { id: string }>(base: T[], next: T[]) {
  const baseById = new Map(base.map((item) => [item.id, item]));
  const nextById = new Map(next.map((item) => [item.id, item]));
  let changed = 0;

  for (const [id, nextItem] of nextById) {
    const baseItem = baseById.get(id);

    if (baseItem && !sameData(baseItem, nextItem)) {
      changed += 1;
    }
  }

  const added = [...nextById.keys()].filter((id) => !baseById.has(id)).length;
  const removed = [...baseById.keys()].filter((id) => !nextById.has(id)).length;

  return {
    added,
    changed,
    removed,
    total: added + changed + removed,
  };
}

function countAdded<T extends { id: string }>(base: T[], next: T[]) {
  const baseIds = new Set(base.map((item) => item.id));

  return next.filter((item) => !baseIds.has(item.id)).length;
}

function formatCount(count: number, singular: string, plural: string) {
  if (count === 0) {
    return [];
  }

  return [`${count} ${count === 1 ? singular : plural}`];
}

function sameData(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}
