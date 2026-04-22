import type {
  Garden,
  HarvestEvent,
  IssueSeverity,
  IssueStatus,
  JournalEntry,
  JournalIssueCategory,
  JournalTargetType,
  PhotoAttachment,
  Task,
} from '../../domain/gardens/GardenRepository';
import { sortTasks, synchronizeGardenTasks } from '../tasks/taskEngine';
import { toLocalDate } from './todayFormatters';

export interface TodayTarget {
  id: string;
  label: string;
  plantingId: string | null;
  structureId: string | null;
  type: JournalTargetType;
}

export interface TodayJournalInput {
  body: string;
  id?: string;
  occurredOn: string;
  photos?: PhotoAttachment[];
  target: TodayTarget;
  title: string;
}

export interface TodayIssueInput extends TodayJournalInput {
  category: JournalIssueCategory;
  severity: IssueSeverity;
  status: IssueStatus;
}

export interface TodayHarvestInput {
  amountText: string;
  cropFinished: boolean;
  harvestedOn: string;
  id?: string;
  notes: string;
  plantingId: string | null;
  quantity: number | null;
  unit: HarvestEvent['unit'];
}

export function markWaterDone(
  garden: Garden,
  recommendationId: string,
  now = new Date(),
): Garden {
  const recommendation = garden.waterRecommendations.find(
    (candidate) => candidate.id === recommendationId,
  );

  if (!recommendation || recommendation.status === 'completed') {
    return garden;
  }

  const nowIso = now.toISOString();
  const occurredOn = toLocalDate(now);
  const journalEntry = createWaterJournalEntry(
    garden,
    recommendation,
    nowIso,
    occurredOn,
  );
  const updatedTasks = garden.tasks.map((task) =>
    task.type === 'water' && task.sourceId === recommendation.id
      ? {
          ...task,
          completedAtIso: nowIso,
          status: 'done' as const,
        }
      : task,
  );
  const updatedGarden = {
    ...garden,
    journalEntries: [journalEntry, ...garden.journalEntries],
    tasks: updatedTasks,
    updatedAtIso: nowIso,
    waterRecommendations: garden.waterRecommendations.map((candidate) =>
      candidate.id === recommendation.id
        ? { ...candidate, status: 'completed' as const }
        : candidate,
    ),
  };

  return synchronizeGardenTasks(updatedGarden, {
    now,
    refreshOpenGenerated: true,
  });
}

export function addFieldNote(
  garden: Garden,
  input: TodayJournalInput,
  now = new Date(),
): Garden {
  const entry = createJournalEntry(garden, input, 'note', now);

  return {
    ...garden,
    journalEntries: [entry, ...garden.journalEntries],
    updatedAtIso: now.toISOString(),
  };
}

export function reportFieldIssue(
  garden: Garden,
  input: TodayIssueInput,
  now = new Date(),
): Garden {
  const entry = createJournalEntry(garden, input, 'issue', now);
  const followUpTask = createIssueFollowUpTask(
    garden,
    entry,
    input.severity,
    now,
  );

  return {
    ...garden,
    journalEntries: [entry, ...garden.journalEntries],
    tasks: sortTasks([...garden.tasks, followUpTask]),
    updatedAtIso: now.toISOString(),
  };
}

export function updateIssueStatus(
  garden: Garden,
  entryId: string,
  status: IssueStatus,
  now = new Date(),
): Garden {
  const nowIso = now.toISOString();

  return {
    ...garden,
    journalEntries: garden.journalEntries.map((entry) =>
      entry.id === entryId && entry.type === 'issue'
        ? { ...entry, issueStatus: status }
        : entry,
    ),
    tasks: garden.tasks.map((task) =>
      status === 'resolved' &&
      task.sourceId === entryId &&
      task.status === 'open'
        ? {
            ...task,
            completedAtIso: nowIso,
            status: 'done' as const,
          }
        : task,
    ),
    updatedAtIso: nowIso,
  };
}

export function logFieldHarvest(
  garden: Garden,
  input: TodayHarvestInput,
  now = new Date(),
): Garden {
  const planting =
    garden.plantings.find((candidate) => candidate.id === input.plantingId) ??
    null;
  const harvest: HarvestEvent = {
    amountText: input.amountText,
    cropId: planting?.cropId ?? null,
    gardenId: garden.id,
    harvestedOn: input.harvestedOn,
    id: input.id ?? createTodayId('harvest'),
    notes: input.notes,
    plantingId: planting?.id ?? null,
    quantity: input.quantity,
    unit: input.unit,
  };
  const nowIso = now.toISOString();
  const tasks = garden.tasks.map((task) =>
    input.cropFinished &&
    task.type === 'harvest' &&
    task.status === 'open' &&
    task.plantingId === planting?.id
      ? {
          ...task,
          completedAtIso: nowIso,
          status: 'done' as const,
        }
      : task,
  );

  return synchronizeGardenTasks(
    {
      ...garden,
      harvestEvents: [harvest, ...garden.harvestEvents],
      plantings: garden.plantings.map((candidate) => {
        if (candidate.id !== planting?.id) {
          return candidate;
        }

        return {
          ...candidate,
          status: input.cropFinished ? 'harvested' : 'harvest-ready',
        };
      }),
      tasks,
      updatedAtIso: nowIso,
    },
    { now, refreshOpenGenerated: true },
  );
}

export function createTodayId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}`;
}

function createJournalEntry(
  garden: Garden,
  input: TodayJournalInput | TodayIssueInput,
  type: JournalEntry['type'],
  now: Date,
): JournalEntry {
  const issueInput = type === 'issue' ? (input as TodayIssueInput) : null;

  return {
    body: input.body,
    createdAtIso: now.toISOString(),
    gardenId: garden.id,
    id: input.id ?? createTodayId(type === 'issue' ? 'issue' : 'journal'),
    issueCategory: issueInput?.category ?? null,
    issueSeverity: issueInput?.severity ?? null,
    issueStatus: issueInput?.status ?? null,
    occurredOn: input.occurredOn,
    photos: input.photos ?? [],
    plantingId: input.target.plantingId,
    structureId: input.target.structureId,
    targetLabel: input.target.label,
    targetType: input.target.type,
    title: input.title,
    type,
    weatherSnapshotId: null,
  };
}

function createIssueFollowUpTask(
  garden: Garden,
  entry: JournalEntry,
  severity: IssueSeverity,
  now: Date,
): Task {
  const targetLabel =
    entry.targetType === 'garden' ? 'Whole garden' : entry.targetLabel;

  return {
    bedLabel: targetLabel,
    completedAtIso: null,
    createdAtIso: now.toISOString(),
    deferredUntilDate: null,
    dueDate: entry.occurredOn,
    gardenId: garden.id,
    id: createTodayId('issue-task'),
    notes: `Follow up on ${entry.title}: ${entry.body}`,
    plantingId: entry.plantingId,
    priority:
      severity === 'high' ? 'high' : severity === 'low' ? 'low' : 'medium',
    snoozedUntilDate: null,
    source: 'manual',
    sourceId: entry.id,
    status: 'open',
    structureId: entry.structureId,
    title: `Inspect ${targetLabel}: ${entry.title}`,
    type: 'inspect',
  };
}

function createWaterJournalEntry(
  garden: Garden,
  recommendation: Garden['waterRecommendations'][number],
  nowIso: string,
  occurredOn: string,
): JournalEntry {
  const plantingId =
    recommendation.targetType === 'planting'
      ? (recommendation.plantingId ?? recommendation.targetId)
      : null;
  const structureId =
    recommendation.targetType === 'bed' ? recommendation.targetId : null;
  const targetType =
    recommendation.targetType === 'planting' ? 'planting' : 'structure';

  return {
    body: `Watered ${recommendation.targetLabel} with ${recommendation.recommendedWaterInches} inches. ${recommendation.reason}`,
    createdAtIso: nowIso,
    gardenId: garden.id,
    id: createTodayId('water-log'),
    issueCategory: null,
    issueSeverity: null,
    issueStatus: null,
    occurredOn,
    photos: [],
    plantingId,
    structureId,
    targetLabel: recommendation.targetLabel,
    targetType,
    title: `Watered ${recommendation.targetLabel}`,
    type: 'note',
    weatherSnapshotId: recommendation.weatherSnapshotId,
  };
}
