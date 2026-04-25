export function formatDateForTimeZone(
  date: Date,
  timezone: string | null | undefined,
) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      day: '2-digit',
      month: '2-digit',
      timeZone: timezone || 'UTC',
      year: 'numeric',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
