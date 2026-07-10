const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_TIME_PATTERN = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;
const MILLISECONDS_PER_DAY = 86_400_000;

export interface GardenDateTimeParts {
  day: number;
  hour: number;
  millisecond: number;
  minute: number;
  month: number;
  second: number;
  year: number;
}

export type AmbiguousGardenTimeResolution = 'earlier' | 'later' | 'reject';
export type MissingGardenTimeResolution = 'nextValid' | 'reject';

export interface GardenTimeResolution {
  ambiguous: AmbiguousGardenTimeResolution;
  missing: MissingGardenTimeResolution;
}

export class GardenTimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GardenTimeError';
  }
}

function integerPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  const value = parts.find((part) => part.type === type)?.value;

  if (value === undefined) {
    throw new GardenTimeError(`Could not resolve the ${type} date part.`);
  }

  return Number.parseInt(value, 10);
}

function formatter(timezone: string) {
  assertValidTimezone(timezone);

  return new Intl.DateTimeFormat('en-US-u-ca-iso8601-nu-latn', {
    day: '2-digit',
    fractionalSecondDigits: 3,
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: timezone,
    year: 'numeric',
  });
}

function parseLocalDate(localDate: string) {
  const match = LOCAL_DATE_PATTERN.exec(localDate);

  if (!match) {
    throw new GardenTimeError(`Invalid local date: ${localDate}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));

  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    throw new GardenTimeError(`Invalid local date: ${localDate}`);
  }

  return { day, month, year };
}

function parseLocalTime(localTime: string) {
  const match = LOCAL_TIME_PATTERN.exec(localTime);

  if (!match) {
    throw new GardenTimeError(`Invalid local time: ${localTime}`);
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);

  if (hour > 23 || minute > 59 || second > 59) {
    throw new GardenTimeError(`Invalid local time: ${localTime}`);
  }

  return { hour, minute, second };
}

function partsEqual(
  actual: GardenDateTimeParts,
  expected: GardenDateTimeParts,
) {
  return (
    actual.year === expected.year &&
    actual.month === expected.month &&
    actual.day === expected.day &&
    actual.hour === expected.hour &&
    actual.minute === expected.minute &&
    actual.second === expected.second &&
    actual.millisecond === expected.millisecond
  );
}

function offsetAt(instantMs: number, timezone: string) {
  const parts = getGardenDateTimeParts(
    new Date(instantMs).toISOString(),
    timezone,
  );
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );

  return representedAsUtc - instantMs;
}

function candidateInstants(desired: GardenDateTimeParts, timezone: string) {
  const wallTimeAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second,
    desired.millisecond,
  );
  const offsets = new Set<number>();

  for (let hours = -48; hours <= 48; hours += 6) {
    offsets.add(offsetAt(wallTimeAsUtc + hours * 3_600_000, timezone));
  }

  return [...offsets]
    .map((offset) => wallTimeAsUtc - offset)
    .filter((candidate) =>
      partsEqual(
        getGardenDateTimeParts(new Date(candidate).toISOString(), timezone),
        desired,
      ),
    )
    .sort((left, right) => left - right);
}

function resolveExactGardenDateTime(
  desired: GardenDateTimeParts,
  timezone: string,
  ambiguous: AmbiguousGardenTimeResolution,
) {
  const candidates = candidateInstants(desired, timezone);

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length > 1 && ambiguous === 'reject') {
    throw new GardenTimeError(
      'The requested local time occurs twice because of a timezone transition.',
    );
  }

  const resolved = ambiguous === 'later' ? candidates.at(-1) : candidates[0];

  if (resolved === undefined) {
    return null;
  }

  return new Date(resolved).toISOString();
}

export function assertValidTimezone(timezone: string) {
  if (timezone.trim() === '') {
    throw new GardenTimeError('A garden timezone is required.');
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(0);
  } catch {
    throw new GardenTimeError(`Invalid IANA timezone: ${timezone}`);
  }
}

export function assertIsoInstant(iso: string) {
  if (!ISO_INSTANT_PATTERN.test(iso) || !Number.isFinite(Date.parse(iso))) {
    throw new GardenTimeError(`Invalid UTC ISO instant: ${iso}`);
  }
}

export function getGardenDateTimeParts(
  iso: string,
  timezone: string,
): GardenDateTimeParts {
  assertIsoInstant(iso);
  const date = new Date(iso);
  const parts = formatter(timezone).formatToParts(date);

  return {
    day: integerPart(parts, 'day'),
    hour: integerPart(parts, 'hour'),
    millisecond: integerPart(parts, 'fractionalSecond'),
    minute: integerPart(parts, 'minute'),
    month: integerPart(parts, 'month'),
    second: integerPart(parts, 'second'),
    year: integerPart(parts, 'year'),
  };
}

export function getGardenDate(iso: string, timezone: string) {
  const { day, month, year } = getGardenDateTimeParts(iso, timezone);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addGardenDays(localDate: string, days: number) {
  if (!Number.isInteger(days)) {
    throw new GardenTimeError('Garden calendar days must be a whole number.');
  }

  const { day, month, year } = parseLocalDate(localDate);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${String(shifted.getUTCFullYear()).padStart(4, '0')}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

export function gardenDateTimeToIso(
  localDate: string,
  localTime: string,
  timezone: string,
  resolution: GardenTimeResolution,
) {
  assertValidTimezone(timezone);
  const date = parseLocalDate(localDate);
  const time = parseLocalTime(localTime);
  const desired: GardenDateTimeParts = {
    ...date,
    ...time,
    millisecond: 0,
  };
  const exact = resolveExactGardenDateTime(
    desired,
    timezone,
    resolution.ambiguous,
  );

  if (exact !== null) {
    return exact;
  }

  if (resolution.missing === 'reject') {
    throw new GardenTimeError(
      'The requested local time does not exist because of a timezone transition.',
    );
  }

  const wallTimeAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
    desired.second,
  );

  for (let minutes = 1; minutes <= 180; minutes += 1) {
    const probe = new Date(wallTimeAsUtc + minutes * 60_000);
    const shifted: GardenDateTimeParts = {
      day: probe.getUTCDate(),
      hour: probe.getUTCHours(),
      millisecond: 0,
      minute: probe.getUTCMinutes(),
      month: probe.getUTCMonth() + 1,
      second: probe.getUTCSeconds(),
      year: probe.getUTCFullYear(),
    };
    const candidate = resolveExactGardenDateTime(
      shifted,
      timezone,
      resolution.ambiguous,
    );

    if (candidate !== null) {
      return candidate;
    }
  }

  throw new GardenTimeError(
    'Could not resolve a valid local time after the timezone transition.',
  );
}

export function nextGardenTimeIso(
  nowIso: string,
  localTime: string,
  timezone: string,
) {
  assertIsoInstant(nowIso);
  const today = getGardenDate(nowIso, timezone);
  const resolution: GardenTimeResolution = {
    ambiguous: 'later',
    missing: 'nextValid',
  };
  const todayCandidate = gardenDateTimeToIso(
    today,
    localTime,
    timezone,
    resolution,
  );

  if (Date.parse(todayCandidate) > Date.parse(nowIso)) {
    return todayCandidate;
  }

  return gardenDateTimeToIso(
    addGardenDays(today, 1),
    localTime,
    timezone,
    resolution,
  );
}

export function differenceInGardenDays(
  startIso: string,
  endIso: string,
  timezone: string,
) {
  const start = getGardenDateTimeParts(startIso, timezone);
  const end = getGardenDateTimeParts(endIso, timezone);
  const startWallTime = Date.UTC(
    start.year,
    start.month - 1,
    start.day,
    start.hour,
    start.minute,
    start.second,
    start.millisecond,
  );
  const endWallTime = Date.UTC(
    end.year,
    end.month - 1,
    end.day,
    end.hour,
    end.minute,
    end.second,
    end.millisecond,
  );

  return (endWallTime - startWallTime) / MILLISECONDS_PER_DAY;
}
