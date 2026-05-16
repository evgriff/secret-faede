import type {
  Garden,
  Task,
  WeatherSnapshot,
} from '../../domain/gardens/GardenRepository';
import { getPlantingHarvestSchedule } from '../garden/harvestSchedule';
import { buildWateringOutlook } from '../garden/wateringOutlook';
import {
  getTaskLookaheadEndDate,
  TASK_LOOKAHEAD_DAYS,
} from '../tasks/taskScope';
import type { TodayTarget } from './todayActions';
import { addDays } from './todayFormatters';
import { buildTodayWateringGroups } from './todayWateringGroups';

export type TodayCalendarMarker = 'alert' | 'plant' | 'rain' | 'watering';

export interface TodayCalendarDay {
  count: number;
  date: string;
  markers: TodayCalendarMarker[];
}

export function buildTodayTargetOptions(garden: Garden): TodayTarget[] {
  return [
    {
      id: 'garden',
      label: 'Whole garden',
      plantingId: null,
      structureId: null,
      type: 'garden',
    },
    ...garden.structures.map((structure) => ({
      id: `structure:${structure.id}`,
      label: structure.label,
      plantingId: null,
      structureId: structure.id,
      type: 'structure' as const,
    })),
    ...garden.plantings.map((planting) => ({
      id: `planting:${planting.id}`,
      label: planting.label,
      plantingId: planting.id,
      structureId: null,
      type: 'planting' as const,
    })),
  ];
}

export function getTodayTarget(
  targets: TodayTarget[],
  targetId: string | null | undefined,
) {
  return (
    targets.find((target) => target.id === targetId) ??
    targets.find((target) => target.id === 'garden') ??
    targets[0]
  );
}

export const todayTaskGroups: Array<{
  key: keyof ReturnType<typeof groupTasks>;
  title: string;
}> = [
  { key: 'today', title: 'Today' },
  { key: 'week', title: 'This week' },
  { key: 'later', title: 'Later' },
];

export function groupTasks(tasks: Task[], today: string) {
  const weekEnd = getTaskLookaheadEndDate(today);
  const visibleTasks = tasks.filter(
    (task) => !isLegacyGeneratedHarvestTask(task) && isTaskInScope(task, today),
  );

  return {
    later: visibleTasks.filter(
      (task) => !task.dueDate || task.dueDate > weekEnd,
    ),
    today: visibleTasks.filter((task) => task.dueDate && task.dueDate <= today),
    week: visibleTasks.filter(
      (task) => task.dueDate && task.dueDate > today && task.dueDate <= weekEnd,
    ),
  };
}

export function getTasksForSelectedDate(
  tasks: Task[],
  selectedDate: string,
  today: string,
) {
  if (selectedDate > getTaskLookaheadEndDate(today)) {
    return [];
  }

  return tasks.filter(
    (task) =>
      !isLegacyGeneratedHarvestTask(task) &&
      isTaskInScope(task, today) &&
      (selectedDate === today
        ? Boolean(task.dueDate && task.dueDate <= today)
        : task.dueDate === selectedDate),
  );
}

export function countTasksByBed(tasks: Task[]) {
  const counts = new Map<string, number>();

  tasks
    .filter((task) => !isLegacyGeneratedHarvestTask(task))
    .forEach((task) => {
      const label = task.bedLabel ?? 'Open plot';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });

  return [...counts.entries()]
    .map(([label, count]) => ({ count, label }))
    .sort((left, right) => right.count - left.count);
}

export function buildCalendarDays(
  garden: Garden,
  tasks: Task[],
  today: string,
): TodayCalendarDay[] {
  const latestWeather = garden.weatherSnapshots.reduce<WeatherSnapshot | null>(
    (latestSnapshot, snapshot) =>
      latestSnapshot === null ||
      snapshot.capturedAtIso >= latestSnapshot.capturedAtIso
        ? snapshot
        : latestSnapshot,
    null,
  );
  const wateringOutlook = buildWateringOutlook(
    garden,
    latestWeather,
    new Date(`${today}T12:00:00.000Z`),
  );

  return Array.from({ length: TASK_LOOKAHEAD_DAYS }, (_, index) => {
    const date = addDays(today, index);
    const nonWaterTasks = tasks.filter((task) =>
      isScheduledWateringTask(task)
        ? false
        : isLegacyGeneratedHarvestTask(task)
          ? false
          : !isTaskInScope(task, today)
            ? false
            : date === today
              ? Boolean(task.dueDate && task.dueDate <= today)
              : task.dueDate === date,
    );
    const wateringGroupCount = buildTodayWateringGroups(
      garden,
      date,
      today,
      new Date(`${today}T12:00:00.000Z`),
    ).length;
    const wateringOutlookCount = wateringOutlook.filter(
      (item) => item.bestDate === date,
    ).length;
    const wateringCount = Math.max(wateringGroupCount, wateringOutlookCount);
    const markers = new Set<TodayCalendarMarker>();
    const hasHarvestWindow = garden.plantings.some((planting) => {
      const schedule = getPlantingHarvestSchedule(garden, planting, today);
      return schedule?.expectedHarvestDate === date;
    });
    const forecastDay = latestWeather?.forecastDays?.find(
      (day) => day.date === date,
    );

    if (wateringCount > 0) {
      markers.add('watering');
    }

    if (forecastDay && isRainSignificantForCalendar(forecastDay)) {
      markers.add('rain');
    }

    if (nonWaterTasks.length > 0 || hasHarvestWindow) {
      markers.add('plant');
    }

    if (nonWaterTasks.some((task) => task.priority === 'high')) {
      markers.add('alert');
    }

    return {
      count: nonWaterTasks.length + wateringCount,
      date,
      markers: [...markers],
    };
  });
}

function isRainSignificantForCalendar(
  forecastDay: NonNullable<WeatherSnapshot['forecastDays']>[number],
) {
  return (
    forecastDay.expectedRainIn >= 0.01 ||
    forecastDay.rainLikely === true ||
    (forecastDay.precipitationChancePercent ?? 0) >= 40
  );
}

export function getCriticalCheckTasks(tasks: Task[]) {
  const criticalTypes = new Set<Task['type']>([
    'inspect',
    'prune',
    'thin',
    'trellis',
    'weed',
  ]);

  return tasks.filter(
    (task) => task.priority === 'high' || criticalTypes.has(task.type),
  );
}

export function isScheduledWateringTask(task: Task) {
  return task.type === 'water' && task.source === 'wateringSchedule';
}

export function isLegacyGeneratedHarvestTask(task: Task) {
  return task.type === 'harvest' && task.source === 'generated';
}

function isTaskInScope(task: Task, today: string) {
  return Boolean(
    task.dueDate && task.dueDate <= getTaskLookaheadEndDate(today),
  );
}
