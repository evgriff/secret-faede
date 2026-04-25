import type {
  Garden,
  JournalEntry,
  Task,
  WeatherSnapshot,
} from '../../domain/gardens/GardenRepository';
import {
  getPlantingHarvestSchedule,
  type PlantingHarvestSchedule,
} from '../garden/harvestSchedule';
import {
  buildWateringOutlook,
  type WateringOutlookRun,
} from '../garden/wateringOutlook';
import {
  getCropStageActions,
  getRecentActivity,
  type TodayCropStageAction,
  type TodayRecentActivity,
} from './todayFieldActivity';
import { addDays, formatMonthDay } from './todayFormatters';
import { getBedLabelForPlanting } from './todayGardenLabels';
import {
  buildTodayWateringGroups,
  type TodayWateringGroup,
} from './todayWateringGroups';

export interface TodayFieldModel {
  bedAttention: Array<{ count: number; label: string; summary: string }>;
  cropStageActions: TodayCropStageAction[];
  harvestSchedule: TodayHarvestScheduleItem[];
  latestWeather: WeatherSnapshot | null;
  nextWateringRun: TodayWateringOutlookItem | null;
  recentActivity: TodayRecentActivity[];
  selectedWeather: TodaySelectedWeather | null;
  unresolvedIssues: JournalEntry[];
  urgentAlerts: Array<{
    id: string;
    message: string;
    tone: 'danger' | 'warning';
  }>;
  wateringGroups: TodayWateringGroup[];
  wateringOutlook: TodayWateringOutlookItem[];
}

export interface TodayHarvestScheduleItem {
  cropName: string;
  expectedHarvestDate: string;
  planting: Garden['plantings'][number];
  status: 'late' | 'opening' | 'ready' | 'upcoming';
  summary: string;
}

export type TodayWateringOutlookItem = WateringOutlookRun;

export interface TodaySelectedWeather {
  alertSummaries: string[];
  conditionSummary: string;
  date: string;
  displayDateLabel: 'Forecast for' | 'Observed';
  forecastRainIn: number | null;
  frostRisk: WeatherSnapshot['frostRisk'];
  heatRisk: WeatherSnapshot['heatRisk'];
  mode: 'forecast' | 'observed';
  nextRainIso: string | null;
  precipitationChancePercent: number | null;
  providerLabel: string;
  recentPrecipitation72hIn: number | null;
  temperatureF: number | null;
}

export type { TodayCropStageAction, TodayRecentActivity };

export function buildTodayFieldModel(
  garden: Garden,
  openTasks: Task[],
  selectedDate: string,
  todayDate: string,
  now = new Date(),
): TodayFieldModel {
  const latestWeather = getLatestWeather(garden);
  const wateringGroups = buildTodayWateringGroups(
    garden,
    selectedDate,
    todayDate,
    now,
  );
  const wateringOutlook = latestWeather
    ? buildWateringOutlook(garden, latestWeather, now).filter(
        (item) => item.date >= selectedDate,
      )
    : [];
  const unresolvedIssues = getUnresolvedIssues(garden);

  return {
    bedAttention: getBedAttention(
      garden,
      openTasks,
      wateringGroups,
      unresolvedIssues,
    ),
    cropStageActions: getCropStageActions(garden, selectedDate),
    harvestSchedule: getHarvestSchedule(garden, selectedDate),
    latestWeather,
    nextWateringRun: wateringOutlook[0] ?? null,
    recentActivity: getRecentActivity(garden),
    selectedWeather: getSelectedWeather(latestWeather, selectedDate, todayDate),
    unresolvedIssues,
    urgentAlerts: getUrgentAlerts(
      garden,
      openTasks,
      wateringGroups,
      unresolvedIssues,
      selectedDate,
    ),
    wateringGroups,
    wateringOutlook: wateringOutlook.slice(0, 6),
  };
}

function getSelectedWeather(
  latestWeather: WeatherSnapshot | null,
  selectedDate: string,
  todayDate: string,
): TodaySelectedWeather | null {
  if (!latestWeather) {
    return null;
  }

  const providerLabel =
    latestWeather.providerLabel ?? latestWeather.source ?? 'Manual';

  if (selectedDate !== todayDate && latestWeather.forecastDays) {
    const forecastDay = latestWeather.forecastDays.find(
      (day) => day.date === selectedDate,
    );

    if (forecastDay) {
      return {
        alertSummaries: latestWeather.alertSummaries,
        conditionSummary: forecastDay.conditionSummary,
        date: forecastDay.date,
        displayDateLabel: 'Forecast for',
        forecastRainIn: forecastDay.expectedRainIn,
        frostRisk: latestWeather.frostRisk,
        heatRisk: latestWeather.heatRisk,
        mode: 'forecast',
        nextRainIso: latestWeather.nextRainIso,
        precipitationChancePercent:
          forecastDay.precipitationChancePercent ?? null,
        providerLabel,
        recentPrecipitation72hIn: null,
        temperatureF: forecastDay.highF,
      };
    }
  }

  return {
    alertSummaries: latestWeather.alertSummaries,
    conditionSummary: latestWeather.conditionSummary,
    date: latestWeather.observedForDate,
    displayDateLabel: 'Observed',
    forecastRainIn: latestWeather.forecastRainNext24In,
    frostRisk: latestWeather.frostRisk,
    heatRisk: latestWeather.heatRisk,
    mode: 'observed',
    nextRainIso: latestWeather.nextRainIso,
    precipitationChancePercent: null,
    providerLabel,
    recentPrecipitation72hIn: latestWeather.recentPrecipitation72hIn,
    temperatureF: latestWeather.temperatureF,
  };
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

function getHarvestSchedule(garden: Garden, todayDate: string) {
  const visibleThroughDate = addDays(todayDate, 21);

  return garden.plantings
    .map((planting): TodayHarvestScheduleItem | null => {
      const schedule = getPlantingHarvestSchedule(garden, planting, todayDate);

      if (
        !schedule ||
        (schedule.status === 'upcoming' &&
          schedule.expectedHarvestDate > visibleThroughDate)
      ) {
        return null;
      }

      return {
        cropName: schedule.cropName,
        expectedHarvestDate: schedule.expectedHarvestDate,
        planting,
        status: schedule.status,
        summary: formatHarvestSummary(schedule, todayDate),
      };
    })
    .filter((item): item is TodayHarvestScheduleItem => Boolean(item))
    .sort(
      (left, right) =>
        harvestStatusRank(left.status) - harvestStatusRank(right.status) ||
        left.expectedHarvestDate.localeCompare(right.expectedHarvestDate) ||
        left.planting.label.localeCompare(right.planting.label),
    )
    .slice(0, 6);
}

function formatHarvestSummary(
  schedule: PlantingHarvestSchedule,
  todayDate: string,
) {
  const expectedLabel = formatMonthDay(schedule.expectedHarvestDate);

  if (schedule.status === 'ready') {
    return `Picking can start now. Expected harvest opened around ${expectedLabel}.`;
  }

  if (schedule.status === 'late') {
    return `Harvest window likely opened around ${expectedLabel}. Check ripeness in the field.`;
  }

  if (schedule.isIndoorEstimate) {
    return `If this indoor start stays on track, harvest should start around ${expectedLabel}.`;
  }

  if (schedule.status === 'opening') {
    return schedule.expectedHarvestDate <= todayDate
      ? `Harvest window is opening now. Expected first picking around ${expectedLabel}.`
      : `Harvest window should open around ${expectedLabel}.`;
  }

  return `Expected harvest starts around ${expectedLabel}.`;
}

function harvestStatusRank(status: TodayHarvestScheduleItem['status']) {
  const ranks: Record<TodayHarvestScheduleItem['status'], number> = {
    late: 0,
    ready: 1,
    opening: 2,
    upcoming: 3,
  };

  return ranks[status];
}

function getLatestWeather(garden: Garden) {
  return garden.weatherSnapshots.reduce<WeatherSnapshot | null>(
    (latestSnapshot, snapshot) =>
      latestSnapshot === null ||
      snapshot.capturedAtIso >= latestSnapshot.capturedAtIso
        ? snapshot
        : latestSnapshot,
    null,
  );
}

function getUrgentAlerts(
  garden: Garden,
  openTasks: Task[],
  wateringGroups: TodayWateringGroup[],
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
  const waterAlerts = wateringGroups
    .filter((group) => group.urgency === 'high')
    .map((group) => ({
      id: `water-${group.id}`,
      message: `High water need: ${group.label}`,
      tone: 'warning' as const,
    }));
  const overdueTasks = openTasks
    .filter(
      (task) =>
        task.source !== 'wateringSchedule' &&
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
  wateringGroups: TodayWateringGroup[],
  unresolvedIssues: JournalEntry[],
) {
  const counts = new Map<string, { count: number; reasons: Set<string> }>();

  openTasks
    .filter((task) => task.source !== 'wateringSchedule')
    .slice(0, 20)
    .forEach((task) => {
      addAttention(counts, task.bedLabel ?? 'Open plot', 'task');
    });
  wateringGroups.forEach((group) => {
    addAttention(counts, group.label, 'water');
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

function severityRank(severity: JournalEntry['issueSeverity']) {
  if (severity === 'high') {
    return 3;
  }

  if (severity === 'medium') {
    return 2;
  }

  return 1;
}
