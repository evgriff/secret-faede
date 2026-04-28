import type { LocalDateString } from '../../domain/gardens/GardenRepository';

const dayMs = 24 * 60 * 60 * 1000;

export const TASK_LOOKAHEAD_DAYS = 7;

export function getTaskLookaheadEndDate(today: LocalDateString) {
  return addDays(today, TASK_LOOKAHEAD_DAYS - 1);
}

function addDays(date: LocalDateString, days: number): LocalDateString {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * dayMs)
    .toISOString()
    .slice(0, 10);
}
