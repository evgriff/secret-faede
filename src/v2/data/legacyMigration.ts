import { getCropById } from '../../domain/crops/cropCatalog';
import {
  PLAN_SCHEMA_VERSION,
  wateringStageForLifecycle,
  type GardenPlan,
  type GardenStructure,
  type PlantingGroup,
} from '../domain';
import {
  asRecord,
  firstPositiveNumber,
  normalizeDegrees,
  readArrangement,
  readArray,
  readCoordinates,
  readDrainage,
  readIso,
  readLifecycle,
  readLocalDate,
  readMonthDay,
  readNonEmptyString,
  readNumber,
  readOptionalPositiveNumber,
  readSoilType,
  readString,
  readStructureType,
  readSun,
  readTimezone,
} from './legacyMigrationReaders';
import {
  migrateLegacyOperations,
  type LegacyOperationArchiveCounts,
  type LegacyWaterApplicationCandidate,
} from './legacyMigrationOperations';
import {
  resolveLegacyPlantingGeometry,
  type LegacyMigrationBlocker,
  type LegacyMigrationBlockerCode,
} from './legacyMigrationGeometry';
import { validateGardenPlan, type PlanValidationIssue } from './planValidation';

export type { LegacyWaterApplicationCandidate } from './legacyMigrationOperations';
export { migrateLegacyOperations } from './legacyMigrationOperations';

export interface LegacyGardenMigrationResult {
  archived: LegacyOperationArchiveCounts;
  blockers: LegacyMigrationBlocker[];
  operations: ReturnType<typeof migrateLegacyOperations>['operations'];
  plan: GardenPlan;
  waterApplications: LegacyWaterApplicationCandidate[];
  warnings: string[];
}

export function migrateLegacyGarden(
  input: unknown,
  now = new Date(),
): LegacyGardenMigrationResult {
  const legacy = asRecord(input);
  const warnings: string[] = [];
  const blockers: LegacyMigrationBlocker[] = [];
  const plot = asRecord(legacy.plot);
  const location = asRecord(plot.location);
  const climate = asRecord(legacy.climateProfile);
  const structures = readArray(legacy.structures).map((value, index) =>
    migrateStructure(asRecord(value), index),
  );
  const plotDepthFt = readNumber(plot.depthFt, 8);
  const plotWidthFt = readNumber(plot.widthFt, 12);
  const plantings = readArray(legacy.plantings).map((value, index) =>
    migratePlanting(
      asRecord(value),
      index,
      structures,
      { depthFt: plotDepthFt, widthFt: plotWidthFt },
      blockers,
      warnings,
    ),
  );
  const createdAtIso = readIso(legacy.createdAtIso) ?? now.toISOString();
  const updatedAtIso = readIso(legacy.updatedAtIso) ?? now.toISOString();
  const plan: GardenPlan = {
    createdAtIso,
    id: readNonEmptyString(legacy.id) ?? 'garden-main',
    name: readNonEmptyString(legacy.name) ?? 'Home garden',
    plantings,
    plot: {
      climate: {
        firstFrost: readMonthDay(climate.firstFrostDate) ?? '10-15',
        hardinessZone: readNonEmptyString(climate.hardinessZone) ?? '6b',
        lastFrost: readMonthDay(climate.lastFrostDate) ?? '04-30',
      },
      depthFt: plotDepthFt,
      location: {
        coordinates: readCoordinates(location, warnings),
        label: readNonEmptyString(location.locationName) ?? '',
        query: readNonEmptyString(location.locationQuery) ?? '',
        timezone: readTimezone(location.timezone, warnings) ?? 'UTC',
      },
      northDegrees: normalizeDegrees(readNumber(plot.orientationDegrees, 0)),
      snapFt: readNumber(plot.snapUnitFt, 0.125),
      widthFt: plotWidthFt,
    },
    reviewDecisions: [],
    schemaVersion: PLAN_SCHEMA_VERSION,
    setupCompleted: true,
    structures,
    updatedAtIso,
  };

  addResidualValidationBlockers(validateGardenPlan(plan), plantings, blockers);

  const operationMigration = migrateLegacyOperations(legacy, now);
  warnings.push(...operationMigration.warnings);

  return {
    archived: operationMigration.archived,
    blockers,
    operations: operationMigration.operations,
    plan,
    waterApplications: operationMigration.waterApplications,
    warnings,
  };
}

function migrateStructure(
  legacy: Record<string, unknown>,
  index: number,
): GardenStructure {
  const type = readStructureType(legacy.type);
  return {
    depthFt: readNumber(legacy.depthFt, 1),
    drainage: readDrainage(legacy.drainageProfile),
    id: readNonEmptyString(legacy.id) ?? `structure-${index + 1}`,
    irrigationZoneId: readNonEmptyString(legacy.irrigationZone),
    label: readNonEmptyString(legacy.label) ?? `Structure ${index + 1}`,
    locked: legacy.locked === true,
    mulched: legacy.mulched === true,
    notes: readString(legacy.notes),
    rotationDegrees: normalizeDegrees(readNumber(legacy.rotationDegrees, 0)),
    soilDepthInches: null,
    soilType: readSoilType(legacy.soilType),
    type,
    widthFt: readNumber(legacy.widthFt, 1),
    xFt: readNumber(legacy.xFt, 0),
    yFt: readNumber(legacy.yFt, 0),
  };
}

function migratePlanting(
  legacy: Record<string, unknown>,
  index: number,
  structures: GardenStructure[],
  plot: Pick<GardenPlan['plot'], 'depthFt' | 'widthFt'>,
  blockers: LegacyMigrationBlocker[],
  warnings: string[],
): PlantingGroup {
  const cropId = readNonEmptyString(legacy.cropId) ?? '';
  const crop = cropId ? getCropById(cropId) : undefined;
  const id = readNonEmptyString(legacy.id) ?? `planting-${index + 1}`;
  const xFt = readNumber(legacy.xFt, 0);
  const yFt = readNumber(legacy.yFt, 0);
  const migratedInstances = readArray(legacy.instances).map(
    (value, instanceIndex) => {
      const instance = asRecord(value);
      return {
        id:
          readNonEmptyString(instance.id) ?? `${id}-plant-${instanceIndex + 1}`,
        label:
          readNonEmptyString(instance.label) ?? `Plant ${instanceIndex + 1}`,
        xFt: readNumber(instance.xFt, xFt),
        yFt: readNumber(instance.yFt, yFt),
      };
    },
  );
  const instances =
    migratedInstances.length > 0
      ? migratedInstances
      : [
          {
            id: `${id}-plant-1`,
            label: `${readNonEmptyString(legacy.label) ?? crop?.commonName ?? 'Plant'} 1`,
            xFt,
            yFt,
          },
        ];
  const spreadFt = Math.max(
    readNumber(legacy.matureSpreadInches, 12) / 12,
    0.25,
  );
  const widthFt = firstPositiveNumber(
    legacy.blockWidthFt,
    legacy.rowLengthFt,
    spreadFt,
  );
  const depthFt = firstPositiveNumber(
    legacy.blockDepthFt,
    legacy.clusterRadiusFt ? readNumber(legacy.clusterRadiusFt, 0.5) * 2 : null,
    spreadFt,
  );
  const geometry = resolveLegacyPlantingGeometry({
    explicitGrowingAreaStructureId: readNonEmptyString(
      legacy.growingAreaStructureId,
    ),
    planting: { depthFt, instances, widthFt, xFt, yFt },
    plantingNumber: index + 1,
    plot,
    structures,
  });
  blockers.push(...geometry.blockers);
  if (geometry.repairedInstanceFootprint) {
    warnings.push(
      `Planting ${index + 1}: footprint was minimally expanded to preserve explicit plant positions inside one growing area.`,
    );
  }
  const manualWeekly = readOptionalPositiveNumber(legacy.weeklyWaterNeedInches);
  const catalogWeekly = crop?.weeklyWaterNeedInches ?? 1;
  const rootDepth = crop?.rootDepthInches ?? 12;
  const completeness = crop?.profileCompleteness;
  const lifecycle = readLifecycle(legacy.status);
  const explicitStage = readWateringStage(legacy.wateringStage);
  const fallbackStage = wateringStageForLifecycle(lifecycle);
  const explicitStageSource = readWateringStageSource(
    legacy.wateringStageSource,
  );
  const wateringStageSource = explicitStage
    ? explicitStageSource === 'lifecycleFallback' &&
      explicitStage !== fallbackStage
      ? 'manual'
      : (explicitStageSource ?? 'manual')
    : 'lifecycleFallback';

  return {
    arrangement: readArrangement(legacy.mode),
    cropId,
    cropName:
      readNonEmptyString(legacy.label) ??
      crop?.commonName ??
      `Crop ${index + 1}`,
    depthFt: geometry.depthFt,
    growingAreaStructureId: geometry.growingAreaStructureId,
    id,
    instances,
    irrigationZoneId: readNonEmptyString(legacy.irrigationZone),
    lifecycle,
    locked: legacy.locked === true,
    mulched: legacy.mulched === true,
    notes: readString(legacy.notes),
    plantedOn: readLocalDate(legacy.plantedOn),
    plannedFor: readLocalDate(legacy.plannedFor),
    spacingInches: readOptionalPositiveNumber(legacy.spacingInches) ?? 12,
    sun: readSun(legacy.sunRequirement),
    waterProfile: {
      baseWeeklyInches: manualWeekly ?? catalogWeekly,
      confidence: manualWeekly
        ? 'medium'
        : completeness === 'complete'
          ? 'medium'
          : 'low',
      depletionFraction: 0.45,
      rootDepthInches: rootDepth,
      source: manualWeekly ? 'manual' : crop ? 'catalog' : 'estimated',
      sourceVersion: 'v8-to-v9-migration',
      stageCoefficients: {
        establishing: 1.2,
        flowering: 1.05,
        fruiting: 1.15,
        mature: 1,
      },
    },
    wateringStage: explicitStage ?? fallbackStage,
    wateringStageSource,
    widthFt: geometry.widthFt,
    xFt: geometry.xFt,
    yFt: geometry.yFt,
  };
}

function readWateringStage(
  value: unknown,
): PlantingGroup['wateringStage'] | null {
  return value === 'establishing' ||
    value === 'flowering' ||
    value === 'fruiting' ||
    value === 'mature'
    ? value
    : null;
}

function readWateringStageSource(
  value: unknown,
): PlantingGroup['wateringStageSource'] | null {
  return value === 'manual' ||
    value === 'plantingEvent' ||
    value === 'lifecycleFallback'
    ? value
    : null;
}

function addResidualValidationBlockers(
  issues: PlanValidationIssue[],
  plantings: PlantingGroup[],
  blockers: LegacyMigrationBlocker[],
) {
  for (const issue of issues) {
    const plantingNumber =
      plantings.findIndex((planting) =>
        issue.field.startsWith(`plantings.${planting.id}`),
      ) + 1;
    const normalizedPlantingNumber =
      plantingNumber > 0 ? plantingNumber : undefined;
    const code = blockerCodeForIssue(issue, normalizedPlantingNumber, blockers);
    if (!code) continue;
    if (
      !blockers.some(
        (blocker) =>
          blocker.code === code &&
          blocker.plantingNumber === normalizedPlantingNumber,
      )
    ) {
      blockers.push({
        code,
        ...(normalizedPlantingNumber
          ? { plantingNumber: normalizedPlantingNumber }
          : {}),
      });
    }
  }
}

function blockerCodeForIssue(
  issue: PlanValidationIssue,
  plantingNumber: number | undefined,
  blockers: LegacyMigrationBlocker[],
): LegacyMigrationBlockerCode | null {
  if (issue.message === 'A saved growing area is required.') {
    return blockers.some(
      (blocker) =>
        blocker.plantingNumber === plantingNumber &&
        blocker.code.includes('growing-area'),
    )
      ? null
      : 'missing-growing-area';
  }
  if (issue.message.includes('planting footprint must stay inside the plot')) {
    return 'planting-footprint-outside-plot';
  }
  if (
    issue.message === 'Plant instance must stay inside its group footprint.'
  ) {
    return 'instances-outside-planting';
  }
  if (
    issue.field.includes('.instances.') &&
    issue.message === 'Value is outside the supported range.'
  ) {
    return 'instance-outside-plot';
  }
  if (
    issue.message === 'Growing area does not exist.' ||
    issue.message === 'Assigned structure is not a bed or container.' ||
    issue.message ===
      'Full planting footprint must fit inside its growing area.'
  ) {
    return blockers.some(
      (blocker) =>
        blocker.plantingNumber === plantingNumber &&
        blocker.code.includes('growing-area'),
    )
      ? null
      : 'invalid-growing-area';
  }
  return 'invalid-plan';
}
