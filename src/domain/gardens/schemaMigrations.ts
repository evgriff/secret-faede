export const CURRENT_GARDEN_SCHEMA_VERSION = 3;
export const LEGACY_GARDEN_SCHEMA_VERSION = 0;

export interface GardenMigrationResult {
  applied: string[];
  fromVersion: number;
  record: Record<string, unknown>;
  toVersion: number;
}

export function migrateGardenRecord(value: unknown): GardenMigrationResult {
  const record = isPlainRecord(value) ? { ...value } : {};
  const fromVersion = readGardenSchemaVersion(record.schemaVersion);
  const applied: string[] = [];

  if (fromVersion < 1) {
    migrateLegacyPlantCollection(record, applied);
  }

  if (fromVersion < 2) {
    migratePlannerWorkspaceDefaults(record, applied);
  }

  if (fromVersion < 3) {
    migrateSimplifiedSeasonPlan(record, applied);
  }

  record.schemaVersion = CURRENT_GARDEN_SCHEMA_VERSION;

  return {
    applied,
    fromVersion,
    record,
    toVersion: CURRENT_GARDEN_SCHEMA_VERSION,
  };
}

export function readGardenSchemaVersion(value: unknown): number {
  if (!Number.isInteger(value) || typeof value !== 'number' || value < 0) {
    return LEGACY_GARDEN_SCHEMA_VERSION;
  }

  return Math.min(value, CURRENT_GARDEN_SCHEMA_VERSION);
}

function migrateLegacyPlantCollection(
  record: Record<string, unknown>,
  applied: string[],
) {
  if (!Array.isArray(record.plants)) {
    return;
  }

  if (!Array.isArray(record.plantings) || record.plantings.length === 0) {
    record.plantings = record.plants;
    applied.push('legacy plants copied into plantings');
  }
}

function migratePlannerWorkspaceDefaults(
  record: Record<string, unknown>,
  applied: string[],
) {
  record.plot = migratePlotDefaults(record.plot);
  record.seasonPlan = migrateSeasonPlanDefaults(record.seasonPlan);

  for (const key of [
    'harvestEvents',
    'journalEntries',
    'notificationLogs',
    'structures',
    'sunShadeLayers',
    'tasks',
    'waterRecommendations',
    'weatherSnapshots',
  ]) {
    if (!Array.isArray(record[key])) {
      record[key] = [];
    }
  }

  applied.push('planner workspace defaults normalized');
}

function migratePlotDefaults(value: unknown) {
  const plot = isPlainRecord(value) ? { ...value } : {};

  return {
    ...plot,
    gridUnitFt: 1,
    snapUnitFt: 0.125,
  };
}

function migrateSeasonPlanDefaults(value: unknown) {
  const seasonPlan = isPlainRecord(value) ? { ...value } : {};

  return {
    ...seasonPlan,
    updatedAtIso:
      typeof seasonPlan.updatedAtIso === 'string'
        ? seasonPlan.updatedAtIso
        : null,
    wantedCrops: Array.isArray(seasonPlan.wantedCrops)
      ? seasonPlan.wantedCrops
      : [],
  };
}

function migrateSimplifiedSeasonPlan(
  record: Record<string, unknown>,
  applied: string[],
) {
  const seasonPlan = isPlainRecord(record.seasonPlan)
    ? { ...record.seasonPlan }
    : {};
  const wantedCrops = Array.isArray(seasonPlan.wantedCrops)
    ? seasonPlan.wantedCrops.flatMap(simplifySeasonCropSelection)
    : [];

  record.seasonPlan = {
    ...seasonPlan,
    wantedCrops,
  };

  applied.push('season plan inputs simplified');
}

function simplifySeasonCropSelection(value: unknown) {
  if (!isPlainRecord(value) || typeof value.id !== 'string') {
    return [];
  }

  const cropId = typeof value.cropId === 'string' ? value.cropId.trim() : '';

  if (!cropId) {
    return [];
  }

  const quantity = readNumber(
    value.quantity,
    readNumber(value.targetQuantity, 1),
  );

  return [
    {
      cropId,
      id: value.id,
      notes: typeof value.notes === 'string' ? value.notes : '',
      plantingForm:
        typeof value.plantingForm === 'string'
          ? value.plantingForm
          : value.modePreference,
      quantity,
      supportAllowed:
        typeof value.supportAllowed === 'boolean' ? value.supportAllowed : true,
      varietyName:
        typeof value.varietyName === 'string' ? value.varietyName : '',
    },
  ];
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
