import type {
  DrainageProfile,
  GardenStructure,
  HarvestRecord,
  PlantingGroup,
  PlantingLifecycle,
  SoilType,
  SunExposure,
} from '../domain';

export function readCoordinates(
  value: Record<string, unknown>,
  warnings: string[],
) {
  const latitude = readOptionalNumber(value.latitude);
  const longitude = readOptionalNumber(value.longitude);
  if (latitude === null && longitude === null) return null;
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    warnings.push('Invalid or incomplete legacy coordinates were cleared.');
    return null;
  }
  return { latitude, longitude };
}

export function readTimezone(value: unknown, warnings: string[]) {
  const timezone = readNonEmptyString(value);
  if (!timezone) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(
      new Date(0),
    );
    return timezone;
  } catch {
    warnings.push(`Invalid legacy timezone ${timezone} was replaced.`);
    return null;
  }
}

export function readLifecycle(value: unknown): PlantingLifecycle {
  switch (value) {
    case 'planted':
    case 'growing':
    case 'harvested':
    case 'removed':
      return value;
    case 'harvest-ready':
    case 'harvestReady':
      return 'harvestReady';
    default:
      return 'planned';
  }
}

export function readArrangement(value: unknown): PlantingGroup['arrangement'] {
  if (
    value === 'block' ||
    value === 'cluster' ||
    value === 'row' ||
    value === 'single'
  ) {
    return value;
  }
  return value === 'trellis' || value === 'trellisLine'
    ? 'trellisLine'
    : 'single';
}

export function readSun(value: unknown): SunExposure {
  if (value === 'shade') return 'shade';
  if (value === 'part' || value === 'partShade') return 'partShade';
  return 'fullSun';
}

export function readStructureType(value: unknown): GardenStructure['type'] {
  if (value === 'pathway') return 'path';
  if (
    value === 'bed' ||
    value === 'container' ||
    value === 'path' ||
    value === 'raisedBed' ||
    value === 'trellis'
  )
    return value;
  return 'path';
}

export function readSoilType(value: unknown): SoilType {
  return value === 'clay' || value === 'loam' || value === 'sandy'
    ? value
    : 'unknown';
}

export function readDrainage(value: unknown): DrainageProfile {
  return value === 'fast' || value === 'moderate' || value === 'slow'
    ? value
    : 'unknown';
}

export function readHarvestUnit(value: unknown): HarvestRecord['unit'] {
  return value === 'bunch' ||
    value === 'count' ||
    value === 'lb' ||
    value === 'oz'
    ? value
    : 'freeform';
}

export function readMonthDay(value: unknown): `${number}-${number}` | null {
  const text = readNonEmptyString(value);
  return text && /^\d{2}-\d{2}$/.test(text)
    ? (text as `${number}-${number}`)
    : null;
}

export function readLocalDate(value: unknown) {
  const text = readNonEmptyString(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function readIso(value: unknown) {
  const text = readNonEmptyString(value);
  return text && Number.isFinite(Date.parse(text)) ? text : null;
}

export function normalizeDegrees(value: number) {
  return ((value % 360) + 360) % 360;
}

export function firstPositiveNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = readOptionalPositiveNumber(value);
    if (parsed !== null) return parsed;
  }
  return 1;
}

export function readOptionalPositiveNumber(value: unknown) {
  const parsed = readOptionalNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

export function readOptionalNumber(value: unknown) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function readNumber(value: unknown, fallback: number) {
  return readOptionalNumber(value) ?? fallback;
}

export function readString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function readNonEmptyString(value: unknown) {
  const text = readString(value).trim();
  return text || null;
}

export function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
