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
  WateringScheduleEntry,
} from '../../domain/gardens/GardenRepository';
import { sortTasks, synchronizeGardenTasks } from '../tasks/taskEngine';
import { addDays, toLocalDate } from './todayFormatters';

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

export interface TodayWateringInput {
  amountInches: number;
  occurredOn?: string;
}

export type TodayWateringSnoozeOption = 'tonight' | 'tomorrow';

export function markWaterDone(
  garden: Garden,
  recommendationId: string,
  now = new Date(),
): Garden {
  const recommendation = getWateringRecommendation(garden, recommendationId);

  if (!recommendation || recommendation.status === 'completed') {
    return garden;
  }

  return applyWateringAmount(
    garden,
    recommendation,
    {
      amountInches: recommendation.targetAmountInches,
      occurredOn: toLocalDate(now),
    },
    now,
  );
}

export function logPartialWatering(
  garden: Garden,
  recommendationId: string,
  input: TodayWateringInput,
  now = new Date(),
): Garden {
  const recommendation = getWateringRecommendation(garden, recommendationId);

  if (!recommendation || recommendation.status === 'completed') {
    return garden;
  }

  return applyWateringAmount(garden, recommendation, input, now);
}

export function adjustWateringAmount(
  garden: Garden,
  recommendationId: string,
  amountInches: number,
  now = new Date(),
): Garden {
  const recommendation = getWateringRecommendation(garden, recommendationId);
  const nextAmountInches = roundTo(Math.max(amountInches, 0), 2);

  if (
    !recommendation ||
    recommendation.status === 'completed' ||
    recommendation.status === 'skipped' ||
    nextAmountInches <= 0
  ) {
    return garden;
  }

  const nowIso = now.toISOString();
  const summary = `Remaining watering was adjusted to ${nextAmountInches} inches.`;
  const nextStatus: WateringScheduleEntry['status'] =
    recommendation.status === 'partial'
      ? 'partial'
      : recommendation.status === 'snoozed'
        ? 'snoozed'
        : recommendation.status === 'scheduled'
          ? 'scheduled'
          : 'due';
  const updatedGarden = {
    ...garden,
    updatedAtIso: nowIso,
    wateringSchedule: garden.wateringSchedule.map((candidate) =>
      candidate.id === recommendation.id
        ? {
            ...candidate,
            deficitInches: nextAmountInches,
            reasonDetails: buildUpdatedReasonDetails(
              candidate,
              summary,
              `Previous remaining amount was ${candidate.targetAmountInches} inches.`,
            ),
            reasonSummary: summary,
            status: nextStatus,
            targetAmountInches: nextAmountInches,
            updatedAtIso: nowIso,
          }
        : candidate,
    ),
  };

  return synchronizeGardenTasks(updatedGarden, {
    now,
    refreshOpenGenerated: true,
  });
}

export function skipWateringBecauseRainArrived(
  garden: Garden,
  recommendationId: string,
  now = new Date(),
): Garden {
  const recommendation = getWateringRecommendation(garden, recommendationId);

  if (!recommendation || recommendation.status === 'completed') {
    return garden;
  }

  const nowIso = now.toISOString();
  const occurredOn = toLocalDate(now);
  const summary = 'Watering was skipped because rain arrived before watering.';
  const journalEntry = createWaterSkipJournalEntry(
    garden,
    recommendation,
    nowIso,
    occurredOn,
    summary,
  );
  const updatedGarden = {
    ...garden,
    journalEntries: [journalEntry, ...garden.journalEntries],
    updatedAtIso: nowIso,
    wateringSchedule: garden.wateringSchedule.map((candidate) =>
      candidate.id === recommendation.id
        ? {
            ...candidate,
            deficitInches: 0,
            reasonDetails: buildUpdatedReasonDetails(candidate, summary),
            reasonSummary: summary,
            status: 'skipped' as const,
            targetAmountInches: 0,
            updatedAtIso: nowIso,
          }
        : candidate,
    ),
  };

  return synchronizeGardenTasks(updatedGarden, {
    now,
    refreshOpenGenerated: true,
  });
}

export function snoozeWatering(
  garden: Garden,
  recommendationId: string,
  option: TodayWateringSnoozeOption,
  now = new Date(),
): Garden {
  const recommendation = getWateringRecommendation(garden, recommendationId);

  if (
    !recommendation ||
    recommendation.status === 'completed' ||
    recommendation.status === 'skipped'
  ) {
    return garden;
  }

  const nextDueDate =
    option === 'tomorrow' ? addDays(toLocalDate(now), 1) : toLocalDate(now);
  const dueWindowStartIso =
    option === 'tomorrow' ? getTomorrowMorningIso(now) : getTonightIso(now);
  const summary =
    option === 'tomorrow'
      ? 'Watering was moved to tomorrow.'
      : 'Watering was moved to tonight.';
  const updatedGarden = {
    ...garden,
    updatedAtIso: now.toISOString(),
    wateringSchedule: garden.wateringSchedule.map((candidate) =>
      candidate.id === recommendation.id
        ? {
            ...candidate,
            dueDate: nextDueDate,
            dueWindowStartIso,
            reasonDetails: buildUpdatedReasonDetails(candidate, summary),
            reasonSummary: summary,
            status: 'snoozed' as const,
            updatedAtIso: now.toISOString(),
          }
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

function getWateringRecommendation(garden: Garden, recommendationId: string) {
  return garden.wateringSchedule.find(
    (candidate) => candidate.id === recommendationId,
  );
}

function applyWateringAmount(
  garden: Garden,
  recommendation: WateringScheduleEntry,
  input: TodayWateringInput,
  now: Date,
) {
  const amountInches = roundTo(Math.max(input.amountInches, 0), 2);

  if (amountInches <= 0) {
    return garden;
  }

  const nowIso = now.toISOString();
  const occurredOn = input.occurredOn ?? toLocalDate(now);
  const appliedAmountInches = roundTo(
    Math.min(amountInches, recommendation.targetAmountInches),
    2,
  );
  const remainingInches = roundTo(
    Math.max(recommendation.targetAmountInches - appliedAmountInches, 0),
    2,
  );
  const summary =
    remainingInches > 0
      ? `${remainingInches} inches are still due after watering ${appliedAmountInches} inches.`
      : `Watering is complete for now after ${appliedAmountInches} inches were applied.`;
  const journalEntry = createWaterJournalEntry(
    garden,
    recommendation,
    appliedAmountInches,
    remainingInches,
    nowIso,
    occurredOn,
    summary,
  );
  const updatedTasks = garden.tasks.map((task) =>
    task.type === 'water' &&
    task.sourceId === recommendation.id &&
    remainingInches <= 0
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
    wateringSchedule: garden.wateringSchedule.map((candidate) =>
      candidate.id === recommendation.id
        ? {
            ...candidate,
            appliedAmountInches: roundTo(
              (candidate.appliedAmountInches ?? 0) + appliedAmountInches,
              2,
            ),
            deficitInches: remainingInches,
            dueDate: occurredOn,
            dueWindowStartIso: nowIso,
            lastWateredAtIso: nowIso,
            reasonDetails: buildUpdatedReasonDetails(candidate, summary),
            reasonSummary: summary,
            status:
              remainingInches > 0
                ? ('partial' as const)
                : ('completed' as const),
            targetAmountInches: remainingInches,
            updatedAtIso: nowIso,
          }
        : candidate,
    ),
  };

  return synchronizeGardenTasks(updatedGarden, {
    now,
    refreshOpenGenerated: true,
  });
}

function createWaterJournalEntry(
  garden: Garden,
  recommendation: Garden['wateringSchedule'][number],
  amountInches: number,
  remainingInches: number,
  nowIso: string,
  occurredOn: string,
  summary: string,
): JournalEntry {
  const plantingId =
    recommendation.targetKind === 'planting' ? recommendation.targetId : null;
  const structureId =
    recommendation.targetKind === 'bed' ? recommendation.targetId : null;
  const targetType =
    recommendation.targetKind === 'planting' ? 'planting' : 'structure';

  return {
    body: `Applied ${amountInches} in to ${recommendation.targetLabel}. ${summary}`,
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
    title:
      remainingInches > 0
        ? `Partially watered ${recommendation.targetLabel}`
        : `Watered ${recommendation.targetLabel}`,
    type: 'note',
    weatherSnapshotId: recommendation.weatherSnapshotId,
  };
}

function createWaterSkipJournalEntry(
  garden: Garden,
  recommendation: Garden['wateringSchedule'][number],
  nowIso: string,
  occurredOn: string,
  summary: string,
): JournalEntry {
  const plantingId =
    recommendation.targetKind === 'planting' ? recommendation.targetId : null;
  const structureId =
    recommendation.targetKind === 'bed' ? recommendation.targetId : null;
  const targetType =
    recommendation.targetKind === 'planting' ? 'planting' : 'structure';

  return {
    body: `Skipped watering ${recommendation.targetLabel}. ${summary}`,
    createdAtIso: nowIso,
    gardenId: garden.id,
    id: createTodayId('water-skip'),
    issueCategory: null,
    issueSeverity: null,
    issueStatus: null,
    occurredOn,
    photos: [],
    plantingId,
    structureId,
    targetLabel: recommendation.targetLabel,
    targetType,
    title: `Skipped watering ${recommendation.targetLabel}`,
    type: 'note',
    weatherSnapshotId: recommendation.weatherSnapshotId,
  };
}

function buildUpdatedReasonDetails(
  recommendation: WateringScheduleEntry,
  summary: string,
  extraDetail?: string,
) {
  return [
    summary,
    extraDetail,
    ...recommendation.reasonDetails.filter(
      (detail) => detail !== recommendation.reasonSummary,
    ),
  ].filter((detail): detail is string => Boolean(detail));
}

function getTonightIso(now: Date) {
  const tonight = new Date(now);
  tonight.setHours(18, 0, 0, 0);

  if (tonight.getTime() <= now.getTime()) {
    tonight.setHours(now.getHours() + 2);
  }

  return tonight.toISOString();
}

function getTomorrowMorningIso(now: Date) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(7, 0, 0, 0);
  return tomorrow.toISOString();
}

function roundTo(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
