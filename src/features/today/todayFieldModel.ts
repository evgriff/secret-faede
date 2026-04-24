import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  Garden,
  JournalEntry,
  Planting,
  Task,
  WateringScheduleEntry,
  WeatherSnapshot,
} from '../../domain/gardens/GardenRepository';
import {
  getCropStageActions,
  getRecentActivity,
  type TodayCropStageAction,
  type TodayRecentActivity,
} from './todayFieldActivity';
import { toLocalDate } from './todayFormatters';
import { getBedLabelForPlanting } from './todayGardenLabels';

export interface TodayFieldModel {
  activeWatering: WateringScheduleEntry[];
  bedAttention: Array<{ count: number; label: string; summary: string }>;
  cropStageActions: TodayCropStageAction[];
  harvestReady: TodayHarvestReadyItem[];
  latestWeather: WeatherSnapshot | null;
  recentActivity: TodayRecentActivity[];
  unresolvedIssues: JournalEntry[];
  urgentAlerts: Array<{
    id: string;
    message: string;
    tone: 'danger' | 'warning';
  }>;
}

export interface TodayHarvestReadyItem {
  cropName: string;
  delayReason: string | null;
  dueDate: string | null;
  planting: Planting;
}

export type { TodayCropStageAction, TodayRecentActivity };

export function buildTodayFieldModel(
  garden: Garden,
  openTasks: Task[],
  todayDate: string,
  now = new Date(),
): TodayFieldModel {
  const activeWatering = getActiveWatering(garden, todayDate, now);
  const unresolvedIssues = getUnresolvedIssues(garden);

  return {
    activeWatering,
    bedAttention: getBedAttention(
      garden,
      openTasks,
      activeWatering,
      unresolvedIssues,
    ),
    cropStageActions: getCropStageActions(garden, todayDate),
    harvestReady: getHarvestReady(garden, openTasks, todayDate),
    latestWeather: getLatestWeather(garden),
    recentActivity: getRecentActivity(garden),
    unresolvedIssues,
    urgentAlerts: getUrgentAlerts(
      garden,
      openTasks,
      activeWatering,
      unresolvedIssues,
      todayDate,
    ),
  };
}

function getActiveWatering(garden: Garden, todayDate: string, now: Date) {
  const currentDate = toLocalDate(now);

  return garden.wateringSchedule
    .filter(
      (entry) =>
        ['due', 'partial', 'scheduled', 'snoozed'].includes(entry.status) &&
        entry.targetAmountInches > 0 &&
        entry.dueDate <= todayDate &&
        !isDeferredUntilLaterToday(entry, todayDate, currentDate, now),
    )
    .sort(
      (left, right) =>
        urgencyRank(right.urgency) - urgencyRank(left.urgency) ||
        right.targetAmountInches - left.targetAmountInches,
    )
    .slice(0, 8);
}

function isDeferredUntilLaterToday(
  entry: Garden['wateringSchedule'][number],
  selectedDate: string,
  currentDate: string,
  now: Date,
) {
  if (
    selectedDate !== currentDate ||
    (entry.status !== 'scheduled' && entry.status !== 'snoozed')
  ) {
    return false;
  }

  const dueWindowStartMs = Date.parse(entry.dueWindowStartIso ?? '');
  return Number.isFinite(dueWindowStartMs) && dueWindowStartMs > now.getTime();
}

function getUnresolvedIssues(garden: Garden) {
  return garden.journalEntries
    .filter(
      (entry) => entry.type === 'issue' && entry.issueStatus !== 'resolved',
    )
    .sort(
      (left, right) =>
        severityRank(right.issueSeverity) - severityRank(left.issueSeverity) ||
        right.occurredOn.localeCompare(left.occurredOn),
    )
    .slice(0, 8);
}

function getHarvestReady(garden: Garden, openTasks: Task[], todayDate: string) {
  return garden.plantings
    .map((planting) => {
      const dueTask = openTasks.find(
        (task) => task.type === 'harvest' && task.plantingId === planting.id,
      );
      const harvestTaskIsDue = Boolean(
        dueTask && (!dueTask.dueDate || dueTask.dueDate <= todayDate),
      );
      const delayedHarvestTask =
        dueTask && dueTask.dueDate && dueTask.dueDate > todayDate
          ? dueTask
          : null;

      if (
        !harvestTaskIsDue &&
        (planting.status !== 'harvest-ready' || delayedHarvestTask)
      ) {
        return null;
      }

      return {
        cropName: getCropById(planting.cropId)?.commonName ?? planting.label,
        delayReason: dueTask?.delayReason ?? null,
        dueDate: dueTask?.dueDate ?? null,
        planting,
      };
    })
    .filter((item): item is TodayHarvestReadyItem => Boolean(item))
    .slice(0, 6);
}

function getLatestWeather(garden: Garden) {
  return (
    [...garden.weatherSnapshots].sort((left, right) =>
      right.capturedAtIso.localeCompare(left.capturedAtIso),
    )[0] ?? null
  );
}

function getUrgentAlerts(
  garden: Garden,
  openTasks: Task[],
  activeWatering: WateringScheduleEntry[],
  unresolvedIssues: JournalEntry[],
  todayDate: string,
) {
  const latestWeather = getLatestWeather(garden);
  const weatherAlerts =
    latestWeather?.alertSummaries.map((message, index) => ({
      id: `weather-${index}`,
      message,
      tone: 'warning' as const,
    })) ?? [];
  const waterAlerts = activeWatering
    .filter((recommendation) => recommendation.urgency === 'high')
    .map((recommendation) => ({
      id: `water-${recommendation.id}`,
      message: `High water need: ${recommendation.targetLabel}`,
      tone: 'warning' as const,
    }));
  const overdueTasks = openTasks
    .filter(
      (task) =>
        task.priority === 'high' &&
        Boolean(task.dueDate && task.dueDate <= todayDate),
    )
    .map((task) => ({
      id: `task-${task.id}`,
      message: task.title,
      tone: 'danger' as const,
    }));
  const issueAlerts = unresolvedIssues
    .filter((entry) => entry.issueSeverity === 'high')
    .map((entry) => ({
      id: `issue-${entry.id}`,
      message: `High severity issue: ${entry.title}`,
      tone: 'danger' as const,
    }));

  return [
    ...issueAlerts,
    ...overdueTasks,
    ...waterAlerts,
    ...weatherAlerts,
  ].slice(0, 6);
}

function getBedAttention(
  garden: Garden,
  openTasks: Task[],
  activeWatering: WateringScheduleEntry[],
  unresolvedIssues: JournalEntry[],
) {
  const counts = new Map<string, { count: number; reasons: Set<string> }>();

  openTasks.slice(0, 20).forEach((task) => {
    addAttention(counts, task.bedLabel ?? 'Open plot', 'task');
  });
  activeWatering.forEach((recommendation) => {
    addAttention(
      counts,
      getWaterRecommendationLabel(garden, recommendation),
      'water',
    );
  });
  unresolvedIssues.forEach((entry) => {
    addAttention(counts, getJournalAttentionLabel(garden, entry), 'issue');
  });

  return [...counts.entries()]
    .map(([label, value]) => ({
      count: value.count,
      label,
      summary: [...value.reasons].join(', '),
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label),
    )
    .slice(0, 6);
}

function getWaterRecommendationLabel(
  garden: Garden,
  recommendation: WateringScheduleEntry,
) {
  if (recommendation.targetKind === 'bed') {
    return recommendation.targetLabel;
  }

  const planting = garden.plantings.find(
    (candidate) => candidate.id === recommendation.targetId,
  );

  return planting
    ? getBedLabelForPlanting(garden, planting)
    : recommendation.targetLabel;
}

function getJournalAttentionLabel(garden: Garden, entry: JournalEntry) {
  if (entry.targetType === 'structure' && entry.structureId) {
    return (
      garden.structures.find((structure) => structure.id === entry.structureId)
        ?.label ?? entry.targetLabel
    );
  }

  if (entry.targetType === 'planting' && entry.plantingId) {
    const planting = garden.plantings.find(
      (candidate) => candidate.id === entry.plantingId,
    );

    return planting
      ? getBedLabelForPlanting(garden, planting)
      : entry.targetLabel;
  }

  return 'Whole garden';
}

function addAttention(
  counts: Map<string, { count: number; reasons: Set<string> }>,
  label: string,
  reason: string,
) {
  const current = counts.get(label) ?? { count: 0, reasons: new Set<string>() };
  current.count += 1;
  current.reasons.add(reason);
  counts.set(label, current);
}

function urgencyRank(urgency: WateringScheduleEntry['urgency']) {
  const ranks: Record<WateringScheduleEntry['urgency'], number> = {
    high: 3,
    low: 1,
    medium: 2,
    none: 0,
  };

  return ranks[urgency];
}

function severityRank(severity: JournalEntry['issueSeverity']) {
  if (severity === 'high') {
    return 3;
  }

  if (severity === 'medium') {
    return 2;
  }

  return 1;
}
