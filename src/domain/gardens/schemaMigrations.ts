import { isPageStructureType } from './structureTypes';

export const CURRENT_GARDEN_SCHEMA_VERSION = 7;
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

  if (fromVersion < 4) {
    migratePlantPlanningDefaults(record, applied);
  }

  if (fromVersion < 5) {
    migratePageLevelStructures(record, applied);
  }

  if (fromVersion < 6) {
    migrateWateringSchedule(record, applied);
  }

  if (fromVersion < 7) {
    migratePlantingEvents(record, applied);
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
    'wateringSchedule',
    'weatherSnapshots',
  ]) {
    if (!Array.isArray(record[key])) {
      record[key] = [];
    }
  }

  applied.push('planner workspace defaults normalized');
}

function migrateWateringSchedule(
  record: Record<string, unknown>,
  applied: string[],
) {
  const nextSchedule = Array.isArray(record.wateringSchedule)
    ? record.wateringSchedule
    : Array.isArray(record.waterRecommendations)
      ? record.waterRecommendations
      : [];
  const hadLegacyRecommendations = Array.isArray(record.waterRecommendations);
  const needsScheduleArray = !Array.isArray(record.wateringSchedule);

  record.wateringSchedule = nextSchedule;

  if ('waterRecommendations' in record) {
    delete record.waterRecommendations;
  }

  if (hadLegacyRecommendations || needsScheduleArray) {
    applied.push('watering schedule normalized');
  }
}

function migratePlantingEvents(
  record: Record<string, unknown>,
  applied: string[],
) {
  if (!Array.isArray(record.plantings)) {
    return;
  }

  let changed = false;
  record.plantings = record.plantings.map((planting): unknown => {
    if (!isPlainRecord(planting)) {
      return planting as unknown;
    }

    const nextPlanting = { ...planting };
    const rawPlantingEvents = nextPlanting.plantingEvents;
    const existingEvents: unknown[] = Array.isArray(rawPlantingEvents)
      ? rawPlantingEvents.map((event): unknown => event)
      : [];

    if (!Array.isArray(nextPlanting.plantingEvents)) {
      nextPlanting.plantingEvents = [];
      changed = true;
    }

    const plantStatus = isPlainRecord(nextPlanting.plantStatus)
      ? nextPlanting.plantStatus
      : null;
    const thinnedAtIso =
      plantStatus && typeof plantStatus.thinnedAtIso === 'string'
        ? plantStatus.thinnedAtIso
        : null;

    if (
      thinnedAtIso &&
      !existingEvents.some(
        (event) =>
          isPlainRecord(event) &&
          event.type === 'thinned' &&
          event.occurredOn === thinnedAtIso.slice(0, 10),
      )
    ) {
      nextPlanting.plantingEvents = [
        ...existingEvents,
        {
          id: `planting-event:thinned:${thinnedAtIso.slice(0, 10)}`,
          occurredOn: thinnedAtIso.slice(0, 10),
          type: 'thinned',
        },
      ];
      changed = true;
    }

    return nextPlanting;
  });

  if (changed) {
    applied.push('planting events normalized');
  }
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

function migratePlantPlanningDefaults(
  record: Record<string, unknown>,
  applied: string[],
) {
  if (Array.isArray(record.plantings)) {
    record.plantings = record.plantings.map((planting) =>
      migratePlantingSupportDefaults(planting),
    );
  }

  for (const key of ['markerLayer', 'markers', 'plantNodes']) {
    if (key in record) {
      delete record[key];
    }
  }

  applied.push('plant planning defaults normalized');
}

function migratePageLevelStructures(
  record: Record<string, unknown>,
  applied: string[],
) {
  if (!Array.isArray(record.structures)) {
    return;
  }

  const nextStructures = record.structures.filter(
    (structure) =>
      isPlainRecord(structure) &&
      typeof structure.type === 'string' &&
      isPageStructureType(structure.type),
  );

  if (nextStructures.length === record.structures.length) {
    return;
  }

  record.structures = nextStructures;
  applied.push('legacy utility structures removed');
}

function migratePlantingSupportDefaults(value: unknown) {
  if (!isPlainRecord(value) || isPlainRecord(value.support)) {
    return value;
  }

  const supportType = readSupportType(value.supportType);
  const plantCount = Math.max(readNumber(value.plantCount, 1), 1);

  return {
    ...value,
    support: {
      installedAtIso: null,
      notes: '',
      perPlant: supportType !== 'none',
      quantity: supportType === 'none' ? 0 : plantCount,
      required: false,
      type: supportType,
    },
  };
}

function readSupportType(value: unknown) {
  return typeof value === 'string' &&
    [
      'cage',
      'custom',
      'netting',
      'none',
      'rowCover',
      'stake',
      'stakeAndWeave',
    ].includes(value)
    ? value
    : 'none';
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
