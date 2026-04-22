import type { Garden, Task } from '../../domain/gardens/GardenRepository';
import type { TodayTarget } from './todayActions';
import { addDays } from './todayFormatters';

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
  const weekEnd = addDays(today, 7);

  return {
    later: tasks.filter((task) => !task.dueDate || task.dueDate > weekEnd),
    today: tasks.filter((task) => task.dueDate && task.dueDate <= today),
    week: tasks.filter(
      (task) => task.dueDate && task.dueDate > today && task.dueDate <= weekEnd,
    ),
  };
}

export function getTasksForSelectedDate(
  tasks: Task[],
  selectedDate: string,
  today: string,
) {
  return tasks.filter((task) =>
    selectedDate === today
      ? Boolean(task.dueDate && task.dueDate <= today)
      : task.dueDate === selectedDate,
  );
}

export function countTasksByBed(tasks: Task[]) {
  const counts = new Map<string, number>();

  tasks.forEach((task) => {
    const label = task.bedLabel ?? 'Open plot';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return [...counts.entries()]
    .map(([label, count]) => ({ count, label }))
    .sort((left, right) => right.count - left.count);
}

export function buildCalendarDays(tasks: Task[], today: string) {
  return Array.from({ length: 14 }, (_, index) => {
    const date = addDays(today, index);

    return {
      count: tasks.filter((task) =>
        date === today
          ? Boolean(task.dueDate && task.dueDate <= today)
          : task.dueDate === date,
      ).length,
      date,
    };
  });
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
