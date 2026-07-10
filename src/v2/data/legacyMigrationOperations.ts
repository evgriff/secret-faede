import type {
  GardenIssue,
  GardenOperationsSnapshot,
  GardenTask,
  HarvestRecord,
  JournalEntry,
  PhotoAttachment,
  WaterApplication,
  WateringRecommendation,
} from '../domain';
import {
  asRecord,
  readArray,
  readHarvestUnit,
  readIso,
  readLocalDate,
  readNonEmptyString,
  readOptionalPositiveNumber,
  readString,
} from './legacyMigrationReaders';
import {
  isSafeLegacyPhotoPath,
  migrateLegacyTarget,
  readLegacyIssueCategory,
  readLegacyIssueSeverity,
  readLegacyIssueStatus,
  readLegacyTaskKind,
  readLegacyTaskPriority,
} from './legacyMigrationOperationReaders';

export interface LegacyWaterApplicationCandidate {
  actualAmountInches: number;
  legacyJournalId: string;
  occurredOn: string;
  plantingGroupId: string | null;
  structureId: string | null;
}

export interface LegacyOperationArchiveCounts {
  notifications: number;
  wateringSchedule: number;
  weatherSnapshots: number;
}

export interface LegacyOperationMigrationResult {
  archived: LegacyOperationArchiveCounts;
  operations: GardenOperationsSnapshot;
  waterApplications: LegacyWaterApplicationCandidate[];
  warnings: string[];
}

export function migrateLegacyOperations(
  input: unknown,
  now = new Date(),
): LegacyOperationMigrationResult {
  const legacy = asRecord(input);
  const warnings: string[] = [];
  const journalValues = readArray(legacy.journalEntries ?? legacy.journal).map(
    asRecord,
  );
  const journal = journalValues.map((entry, index) =>
    isV2JournalEntry(entry)
      ? (entry as unknown as GardenIssue | JournalEntry)
      : migrateJournalEntry(entry, index, now, warnings),
  );
  const harvests = readArray(legacy.harvestEvents ?? legacy.harvests).map(
    (value, index) => {
      const record = asRecord(value);
      return isV2Harvest(record)
        ? (record as unknown as HarvestRecord)
        : migrateHarvest(record, index, now);
    },
  );
  const tasks = readArray(legacy.tasks).map((value, index) => {
    const record = asRecord(value);
    return isV2Task(record)
      ? (record as unknown as GardenTask)
      : migrateTask(record, index, now);
  });
  const waterApplications = readArray(legacy.waterApplications).flatMap(
    (value) => migratePersistedWaterApplication(asRecord(value)),
  );
  const wateringRecommendations = readArray(legacy.wateringRecommendations)
    .map(asRecord)
    .filter(isV2WateringRecommendation) as unknown as WateringRecommendation[];

  return {
    archived: {
      notifications: readArray(legacy.notificationLogs ?? legacy.notifications)
        .length,
      wateringSchedule: readArray(legacy.wateringSchedule).length,
      weatherSnapshots: readArray(legacy.weatherSnapshots)
        .map(asRecord)
        .filter((snapshot) => !isV2WeatherSnapshot(snapshot)).length,
    },
    operations: {
      harvests,
      journal,
      tasks,
      waterApplications,
      wateringRecommendations,
    },
    waterApplications: journalValues.flatMap((entry) =>
      isV2JournalEntry(entry) ? [] : migrateWaterApplication(entry, warnings),
    ),
    warnings,
  };
}

export function isV2JournalEntry(value: Record<string, unknown>) {
  const target = asRecord(value.target);
  return (
    typeof value.id === 'string' &&
    ['issue', 'note', 'photo'].includes(String(value.type)) &&
    typeof value.createdAtIso === 'string' &&
    typeof value.occurredOn === 'string' &&
    ['garden', 'plantingGroup', 'structure'].includes(String(target.kind)) &&
    (value.type !== 'issue' ||
      (typeof value.category === 'string' &&
        typeof value.severity === 'string' &&
        typeof value.status === 'string'))
  );
}

export function isV2Harvest(value: Record<string, unknown>) {
  return (
    typeof value.id === 'string' &&
    typeof value.createdAtIso === 'string' &&
    typeof value.occurredOn === 'string' &&
    typeof value.plantingGroupId === 'string'
  );
}

export function isV2Task(value: Record<string, unknown>) {
  return (
    typeof value.id === 'string' &&
    typeof value.dueOn === 'string' &&
    typeof value.updatedAtIso === 'string' &&
    typeof value.target === 'object' &&
    ['deferred', 'done', 'open', 'snoozed'].includes(String(value.status))
  );
}

export function isV2WaterApplication(value: Record<string, unknown>) {
  return (
    typeof value.id === 'string' &&
    typeof value.cropGroupId === 'string' &&
    typeof value.recordedByUserId === 'string' &&
    Boolean(value.recordedByUserId.trim()) &&
    Number.isInteger(value.revision) &&
    ['applied', 'partial', 'skipped'].includes(String(value.outcome))
  );
}

function migratePersistedWaterApplication(
  value: Record<string, unknown>,
): WaterApplication[] {
  if (
    typeof value.id !== 'string' ||
    typeof value.cropGroupId !== 'string' ||
    !Number.isInteger(value.revision) ||
    !['applied', 'partial', 'skipped'].includes(String(value.outcome))
  ) {
    return [];
  }
  return [
    {
      ...value,
      recordedByUserId: readNonEmptyString(value.recordedByUserId) ?? 'legacy',
    } as unknown as WaterApplication,
  ];
}

export function isV2WateringRecommendation(value: Record<string, unknown>) {
  return (
    value.modelVersion === 'crop-water-balance-v2' &&
    value.calculationRevision === 1 &&
    asRecord(value.target).kind === 'cropGroup'
  );
}

export function isV2WeatherSnapshot(value: Record<string, unknown>) {
  return (
    typeof value.providerId === 'string' &&
    typeof value.forecastWeather === 'object' &&
    typeof value.historicalWeather === 'object'
  );
}

function migrateJournalEntry(
  legacy: Record<string, unknown>,
  index: number,
  now: Date,
  warnings: string[],
): GardenIssue | JournalEntry {
  const id = readNonEmptyString(legacy.id) ?? `journal-${index + 1}`;
  const photos = migratePhotos(legacy.photos, id, now, warnings);
  const createdAtIso = readIso(legacy.createdAtIso) ?? now.toISOString();
  const base: JournalEntry = {
    body: readString(legacy.body),
    createdAtIso,
    createdByUserId: readNonEmptyString(legacy.createdByUserId) ?? 'legacy',
    id,
    occurredOn: readLocalDate(legacy.occurredOn) ?? createdAtIso.slice(0, 10),
    photos,
    target: migrateLegacyTarget(legacy),
    title: readNonEmptyString(legacy.title) ?? 'Garden note',
    type: photos.length > 0 ? 'photo' : 'note',
  };
  if (legacy.type !== 'issue') return base;
  return {
    ...base,
    category: readLegacyIssueCategory(legacy.issueCategory ?? legacy.category),
    resolvedAtIso: readIso(legacy.resolvedAtIso),
    severity: readLegacyIssueSeverity(legacy.issueSeverity ?? legacy.severity),
    status: readLegacyIssueStatus(legacy.issueStatus ?? legacy.status),
    type: 'issue',
  };
}

function migratePhotos(
  value: unknown,
  entryId: string,
  now: Date,
  warnings: string[],
): PhotoAttachment[] {
  return readArray(value).flatMap((candidate, index) => {
    const photo = asRecord(candidate);
    const storagePath = readNonEmptyString(photo.storagePath);
    if (!storagePath || !isSafeLegacyPhotoPath(storagePath, entryId)) {
      warnings.push(
        `${entryId}: photo ${readNonEmptyString(photo.id) ?? index + 1} had an unsafe or obsolete storage path and was archived only.`,
      );
      return [];
    }
    const contentType = readNonEmptyString(photo.contentType) ?? '';
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(contentType)) {
      warnings.push(
        `${entryId}: unsupported photo content type was archived only.`,
      );
      return [];
    }
    return [
      {
        contentType,
        fileName: readNonEmptyString(photo.fileName) ?? 'garden-photo',
        height: readOptionalPositiveNumber(photo.height),
        id: readNonEmptyString(photo.id) ?? `${entryId}-photo-${index + 1}`,
        sizeBytes: Math.max(0, Number(photo.sizeBytes) || 0),
        storagePath,
        uploadedAtIso: readIso(photo.uploadedAtIso) ?? now.toISOString(),
        width: readOptionalPositiveNumber(photo.width),
      },
    ];
  });
}

function migrateHarvest(
  legacy: Record<string, unknown>,
  index: number,
  now: Date,
): HarvestRecord {
  const occurredOn =
    readLocalDate(legacy.harvestedOn ?? legacy.occurredOn) ??
    now.toISOString().slice(0, 10);
  return {
    amount: readOptionalPositiveNumber(legacy.quantity ?? legacy.amount),
    createdAtIso: readIso(legacy.createdAtIso) ?? `${occurredOn}T12:00:00.000Z`,
    createdByUserId: readNonEmptyString(legacy.createdByUserId) ?? 'legacy',
    cropId: readNonEmptyString(legacy.cropId) ?? 'unknown',
    id: readNonEmptyString(legacy.id) ?? `harvest-${index + 1}`,
    notes: readString(legacy.notes) || readString(legacy.amountText),
    occurredOn,
    plantingGroupId:
      readNonEmptyString(legacy.plantingId ?? legacy.plantingGroupId) ??
      'unknown',
    unit: readHarvestUnit(legacy.unit),
  };
}

function migrateTask(
  legacy: Record<string, unknown>,
  index: number,
  now: Date,
): GardenTask {
  const createdAtIso = readIso(legacy.createdAtIso) ?? now.toISOString();
  const legacyStatus = readString(legacy.status);
  const snoozedOn = readLocalDate(
    legacy.snoozedUntilDate ?? legacy.deferredUntilDate,
  );
  const status =
    legacyStatus === 'done'
      ? 'done'
      : snoozedOn
        ? 'snoozed'
        : legacyStatus === 'skipped'
          ? 'deferred'
          : 'open';
  return {
    completedAtIso:
      status === 'done'
        ? (readIso(legacy.completedAtIso) ?? createdAtIso)
        : null,
    createdAtIso,
    dueOn:
      snoozedOn ??
      readLocalDate(legacy.dueDate ?? legacy.dueOn) ??
      createdAtIso.slice(0, 10),
    id: readNonEmptyString(legacy.id) ?? `task-${index + 1}`,
    kind: readLegacyTaskKind(legacy.type ?? legacy.kind),
    notes: readString(legacy.notes),
    priority: readLegacyTaskPriority(legacy.priority),
    reason:
      readNonEmptyString(legacy.reason) ??
      `Migrated ${readNonEmptyString(legacy.source) ?? 'garden'} task`,
    sourceId: readNonEmptyString(legacy.sourceId),
    status,
    target: migrateLegacyTarget(legacy),
    title: readNonEmptyString(legacy.title) ?? 'Garden task',
    updatedAtIso:
      readIso(legacy.updatedAtIso ?? legacy.completedAtIso) ?? createdAtIso,
  };
}

function migrateWaterApplication(
  entry: Record<string, unknown>,
  warnings: string[],
): LegacyWaterApplicationCandidate[] {
  const content = `${readString(entry.title)} ${readString(entry.body)}`;
  if (!/\bwater(?:ed|ing)?\b/i.test(content)) return [];
  const id = readNonEmptyString(entry.id) ?? 'legacy-water-note';
  if (
    /\b(skip|skipped|not watered|rain arrived|wait(?:ed)? for rain)\b/i.test(
      content,
    )
  ) {
    warnings.push(
      `${id}: skip/rain note was not converted into applied water.`,
    );
    return [];
  }
  const amountText = /\b(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/i.exec(
    content,
  )?.[1];
  const amount = Number(amountText);
  if (!amountText || !Number.isFinite(amount) || amount <= 0 || amount > 10) {
    warnings.push(
      `${id}: water note had no safe explicit amount and was not credited.`,
    );
    return [];
  }
  return [
    {
      actualAmountInches: amount,
      legacyJournalId: id,
      occurredOn: readLocalDate(entry.occurredOn) ?? '1970-01-01',
      plantingGroupId: readNonEmptyString(entry.plantingId),
      structureId: readNonEmptyString(entry.structureId),
    },
  ];
}
