import { formatDateStringInTimeZone } from '../../shared/lib/timezoneDate';

export function formatDateForTimeZone(
  date: Date,
  timezone: string | null | undefined,
) {
  return formatDateStringInTimeZone(date, timezone);
}
