export interface TimeZoneDateParts {
  day: number;
  month: number;
  year: number;
}

export function getDatePartsInTimeZone(
  date: Date,
  timezone: string | null | undefined,
): TimeZoneDateParts {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone: timezone || 'UTC',
      year: 'numeric',
    });
    const parts = formatter.formatToParts(date);

    return {
      day: Number(parts.find((part) => part.type === 'day')?.value ?? '1'),
      month: Number(parts.find((part) => part.type === 'month')?.value ?? '1'),
      year: Number(parts.find((part) => part.type === 'year')?.value ?? '1970'),
    };
  } catch {
    return {
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  }
}

export function getCalendarDateInTimeZone(
  date: Date,
  timezone: string | null | undefined,
) {
  const { day, month, year } = getDatePartsInTimeZone(date, timezone);

  return new Date(Date.UTC(year, Math.max(month - 1, 0), Math.max(day, 1), 12));
}

export function formatDateStringInTimeZone(
  date: Date,
  timezone: string | null | undefined,
) {
  if (Number.isNaN(date.getTime())) {
    return '1970-01-01';
  }

  const { day, month, year } = getDatePartsInTimeZone(date, timezone);

  return `${year}-${padDatePart(month)}-${padDatePart(day)}`;
}

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}
