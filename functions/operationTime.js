'use strict';

const dayMs = 24 * 60 * 60 * 1000;
const defaultLocation = {
  latitude: null,
  locationName: 'Unspecified garden',
  longitude: null,
  timezone: 'UTC',
};

function isUserDueForWateringCheck(
  profile,
  now = new Date(),
  windowMinutes = 70,
) {
  const preference = profile?.notificationPreference || {};
  const timezone = normalizeTimezone(
    preference.timezone || profile?.timezone,
    defaultLocation.timezone,
  );
  const targetMinutes = parseLocalTime(
    normalizeLocalTime(preference.defaultWateringCheckTime, '07:00'),
  );
  const elapsedMinutes =
    (getLocalMinutes(now, timezone) - targetMinutes + 1440) % 1440;

  return elapsedMinutes < windowMinutes;
}

function getGardenLocation(garden, profile) {
  const location = garden?.plot?.location || {};

  return {
    latitude: toNumber(location.latitude, defaultLocation.latitude),
    locationName:
      location.locationName ||
      profile?.climateProfile?.locationName ||
      defaultLocation.locationName,
    longitude: toNumber(location.longitude, defaultLocation.longitude),
    timezone: normalizeTimezone(
      location.timezone || profile?.timezone,
      defaultLocation.timezone,
    ),
  };
}

function getGardenTimezone(garden) {
  return normalizeTimezone(
    garden?.plot?.location?.timezone,
    defaultLocation.timezone,
  );
}

function formatLocalDate(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: normalizeTimezone(timezone, defaultLocation.timezone),
    year: 'numeric',
  }).formatToParts(date);

  return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`;
}

function getLocalMinutes(date, timezone) {
  const parts = getLocalDateTimeParts(
    date,
    normalizeTimezone(timezone, defaultLocation.timezone),
  );

  return Number(parts.hour) * 60 + Number(parts.minute);
}

function parseLocalTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value).trim());

  if (!match) {
    throw new TypeError(`Invalid local time: ${String(value)}`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    throw new RangeError(`Invalid local time: ${String(value)}`);
  }

  return hours * 60 + minutes;
}

function isValidLocalTime(value) {
  try {
    parseLocalTime(value);
    return true;
  } catch {
    return false;
  }
}

function normalizeLocalTime(value, fallback = '07:00') {
  return isValidLocalTime(value) ? value : fallback;
}

function isBeforeWateringCheck(date, timezone, wateringCheckTime) {
  return (
    getLocalMinutes(date, timezone) <
    parseLocalTime(normalizeLocalTime(wateringCheckTime, '07:00'))
  );
}

function resolveWateringCheckWindowStartIso(
  localDate,
  timezone,
  wateringCheckTime,
) {
  return resolveLocalDateTimeIso(
    localDate,
    normalizeLocalTime(wateringCheckTime, '07:00'),
    timezone,
  );
}

function resolveLocalDateTimeIso(localDate, localTime, timezone) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(localDate))) {
    throw new TypeError(`Invalid local date: ${String(localDate)}`);
  }

  const normalizedTimezone = normalizeTimezone(timezone, null);

  if (!normalizedTimezone) {
    throw new RangeError(`Invalid timezone: ${String(timezone)}`);
  }

  const targetMinutes = parseLocalTime(localTime);
  const targetPseudoUtc =
    Date.parse(`${localDate}T00:00:00.000Z`) + targetMinutes * 60_000;
  const exactMatches = [];
  let nextValid = null;

  // A bounded minute scan is deterministic through DST gaps and repeated hours.
  for (
    let candidateMs = targetPseudoUtc - 14 * 60 * 60_000;
    candidateMs <= targetPseudoUtc + 14 * 60 * 60_000;
    candidateMs += 60_000
  ) {
    const candidate = new Date(candidateMs);
    const parts = getLocalDateTimeParts(candidate, normalizedTimezone);
    const candidateDate = `${parts.year}-${parts.month}-${parts.day}`;

    if (candidateDate !== localDate) {
      continue;
    }

    const candidateMinutes = Number(parts.hour) * 60 + Number(parts.minute);

    if (candidateMinutes === targetMinutes) {
      exactMatches.push(candidateMs);
      continue;
    }

    if (
      candidateMinutes > targetMinutes &&
      (!nextValid || candidateMinutes < nextValid.localMinutes)
    ) {
      nextValid = { candidateMs, localMinutes: candidateMinutes };
    }
  }

  if (exactMatches.length > 0) {
    return new Date(Math.max(...exactMatches)).toISOString();
  }

  if (nextValid) {
    return new Date(nextValid.candidateMs).toISOString();
  }

  throw new RangeError(
    `Unable to resolve ${localDate} ${localTime} in ${normalizedTimezone}`,
  );
}

function resolveQuietHoursEndIso(now, preference = {}) {
  const quietHours = preference.quietHours;

  if (
    !quietHours ||
    !isValidLocalTime(quietHours.startLocalTime) ||
    !isValidLocalTime(quietHours.endLocalTime)
  ) {
    return null;
  }

  const timezone = normalizeTimezone(
    preference.timezone,
    defaultLocation.timezone,
  );
  const current = getLocalMinutes(now, timezone);
  const start = parseLocalTime(quietHours.startLocalTime);
  const end = parseLocalTime(quietHours.endLocalTime);

  if (start === end || !isMinuteInsideWindow(current, start, end)) {
    return null;
  }

  const currentDate = formatLocalDate(now, timezone);
  const endDate =
    start > end && current >= start ? addDays(currentDate, 1) : currentDate;

  return resolveLocalDateTimeIso(endDate, quietHours.endLocalTime, timezone);
}

function resolveWateringCheckDelayIso(now, preference = {}) {
  if (
    !isValidLocalTime(preference.defaultWateringCheckTime) ||
    !isValidTimezone(preference.timezone)
  ) {
    return null;
  }

  const current = getLocalMinutes(now, preference.timezone);
  const target = parseLocalTime(preference.defaultWateringCheckTime);
  if (current >= target) {
    return null;
  }

  return resolveLocalDateTimeIso(
    formatLocalDate(now, preference.timezone),
    preference.defaultWateringCheckTime,
    preference.timezone,
  );
}

function isMinuteInsideWindow(current, start, end) {
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

function isValidTimezone(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeTimezone(value, fallback = defaultLocation.timezone) {
  if (isValidTimezone(value)) {
    return value;
  }

  return fallback && isValidTimezone(fallback) ? fallback : null;
}

function getLocalDateTimeParts(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  }).formatToParts(date);

  return {
    day: part(parts, 'day'),
    hour: part(parts, 'hour'),
    minute: part(parts, 'minute'),
    month: part(parts, 'month'),
    year: part(parts, 'year'),
  };
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00.000Z`);
  return new Date(date.getTime() + days * dayMs).toISOString().slice(0, 10);
}

function sortTasks(tasks) {
  return [...tasks].sort((left, right) => {
    const leftDate = left.dueDate || '9999-12-31';
    const rightDate = right.dueDate || '9999-12-31';

    return leftDate === rightDate
      ? left.title.localeCompare(right.title)
      : leftDate.localeCompare(rightDate);
  });
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function toNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function part(parts, type) {
  return parts.find((entry) => entry.type === type)?.value || '00';
}

module.exports = {
  addDays,
  defaultLocation,
  formatLocalDate,
  getGardenLocation,
  getGardenTimezone,
  getLocalMinutes,
  isBeforeWateringCheck,
  isUserDueForWateringCheck,
  isValidLocalTime,
  isValidTimezone,
  normalizeLocalTime,
  normalizeTimezone,
  parseLocalTime,
  resolveLocalDateTimeIso,
  resolveQuietHoursEndIso,
  resolveWateringCheckDelayIso,
  resolveWateringCheckWindowStartIso,
  roundTo,
  sortTasks,
};
