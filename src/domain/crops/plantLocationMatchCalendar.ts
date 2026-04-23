import type { MonthDayString, SunExposure } from '../gardens/GardenRepository';
import type { MonthDayRange } from './plantCatalogTypes';

export function getLastSpringFrostWindow(zone: string): MonthDayRange {
  if (zone === '6b') {
    return { end: '04-30', start: '04-15' };
  }

  if (zone === '5b') {
    return { end: '05-25', start: '05-10' };
  }

  if (zone === '5a') {
    return { end: '05-30', start: '05-20' };
  }

  return { end: '05-15', start: '05-01' };
}

export function getFirstFallFrostWindow(zone: string): MonthDayRange {
  if (zone === '6b') {
    return { end: '10-31', start: '10-15' };
  }

  if (zone === '5b') {
    return { end: '10-10', start: '09-25' };
  }

  if (zone === '5a') {
    return { end: '10-01', start: '09-20' };
  }

  return { end: '10-21', start: '10-06' };
}

export function sunRequirementMet(required: SunExposure, actual: SunExposure) {
  const rank: Record<SunExposure, number> = {
    fullShade: 1,
    partShade: 2,
    partSun: 3,
    fullSun: 4,
  };

  return rank[actual] >= rank[required] - 1;
}

export function daysUntilMonthDay(today: Date, monthDay: MonthDayString) {
  const { day, month } = parseMonthDay(monthDay);
  const target = new Date(
    today.getFullYear(),
    Math.max(month - 1, 0),
    Math.max(day, 1),
  );

  if (target.getTime() < today.getTime()) {
    target.setFullYear(target.getFullYear() + 1);
  }

  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export function dateToMonthDayNumber(date: Date) {
  return (date.getMonth() + 1) * 100 + date.getDate();
}

export function monthDayToNumber(value: MonthDayString) {
  const { day, month } = parseMonthDay(value);

  return month * 100 + day;
}

export function formatMonthDay(value: MonthDayString) {
  const { day, month } = parseMonthDay(value);

  return `${month}/${day}`;
}

export function formatSun(value: SunExposure) {
  return value.replace(/([A-Z])/g, ' $1').toLowerCase();
}

function parseMonthDay(value: MonthDayString) {
  const [monthText = '1', dayText = '1'] = value.split('-');

  return {
    day: Number(dayText),
    month: Number(monthText),
  };
}
