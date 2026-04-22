import type { Task } from '../../domain/gardens/GardenRepository';

const dayMs = 24 * 60 * 60 * 1000;

export function formatTaskType(type: Task['type']) {
  const labels: Record<Task['type'], string> = {
    amend: 'Amend',
    fertilize: 'Feed',
    harvest: 'Harvest',
    inspect: 'Inspect',
    mulch: 'Mulch',
    other: 'Task',
    plant: 'Plant',
    prune: 'Prune',
    sow: 'Sow',
    thin: 'Thin',
    transplant: 'Transplant',
    trellis: 'Support',
    water: 'Water',
    weed: 'Weed',
  };

  return labels[type];
}

export function formatPriority(priority: Task['priority']) {
  return `${priority[0]?.toUpperCase() ?? ''}${priority.slice(1)} priority`;
}

export function formatWeekday(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(parseLocalDate(date));
}

export function formatMonthDay(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(parseLocalDate(date));
}

export function formatLongDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'short',
  }).format(parseLocalDate(date));
}

export function addDays(date: string, days: number) {
  return toLocalDate(new Date(parseLocalDate(date).getTime() + days * dayMs));
}

export function parseLocalDate(date: string) {
  const [year = '1970', month = '1', day = '1'] = date.split('-');

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

export function toLocalDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
