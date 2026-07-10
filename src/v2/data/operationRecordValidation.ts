import type {
  GardenIssue,
  GardenTask,
  HarvestRecord,
  JournalEntry,
  WaterApplication,
} from '../domain';
import {
  assertEnum,
  assertExactKeys,
  assertFiniteNumber,
  assertIso,
  assertLocalDate,
  assertNullableIso,
  assertNullableNumber,
  assertNullableText,
  assertText,
  requireArray,
  requireRecord,
  type UnknownRecord,
} from './recordValidationSupport';

const targetKinds = ['garden', 'plantingGroup', 'structure'] as const;
const journalTypes = ['issue', 'note', 'photo'] as const;
const issueCategories = [
  'disease',
  'general',
  'irrigation',
  'nutrient',
  'pest',
  'weatherDamage',
] as const;
const priorities = ['high', 'low', 'medium'] as const;
const taskKinds = [
  'feed',
  'fertilize',
  'harvest',
  'inspect',
  'mulch',
  'plant',
  'prune',
  'support',
  'thin',
  'water',
  'weed',
] as const;

const journalBaseKeys = [
  'body',
  'createdAtIso',
  'createdByUserId',
  'id',
  'occurredOn',
  'photos',
  'target',
  'title',
  'type',
] as const;

export function assertValidJournalRecord(
  value: unknown,
  expectedId?: string,
): asserts value is GardenIssue | JournalEntry {
  const record = requireRecord(value, 'Journal entry');
  assertEnum(record.type, journalTypes, 'Journal entry type');
  assertExactKeys(
    record,
    record.type === 'issue'
      ? [...journalBaseKeys, 'category', 'resolvedAtIso', 'severity', 'status']
      : journalBaseKeys,
    'Journal entry',
  );
  assertDocumentId(record, expectedId, 'Journal entry');
  assertText(record.title, 'Journal entry title', 1, 200);
  assertText(record.body, 'Journal entry body', 0, 10_000);
  assertText(record.createdByUserId, 'Journal entry owner', 1, 128);
  assertIso(record.createdAtIso, 'Journal entry creation time');
  assertLocalDate(record.occurredOn, 'Journal entry date');
  assertTarget(record.target, 'Journal entry target');
  requireArray(record.photos, 'Journal entry photos', 12).forEach(
    (photo, index) => assertPhoto(photo, index),
  );

  if (record.type === 'issue') {
    assertEnum(record.category, issueCategories, 'Issue category');
    assertNullableIso(record.resolvedAtIso, 'Issue resolution time');
    assertEnum(record.severity, priorities, 'Issue severity');
    assertEnum(
      record.status,
      ['inProgress', 'open', 'resolved'],
      'Issue status',
    );
  }
}

export function assertValidHarvestRecord(
  value: unknown,
  expectedId?: string,
): asserts value is HarvestRecord {
  const record = requireRecord(value, 'Harvest record');
  assertExactKeys(
    record,
    [
      'amount',
      'createdAtIso',
      'createdByUserId',
      'cropId',
      'id',
      'notes',
      'occurredOn',
      'plantingGroupId',
      'unit',
    ],
    'Harvest record',
  );
  assertDocumentId(record, expectedId, 'Harvest record');
  assertNullableNumber(record.amount, 'Harvest amount', 0, 1_000_000);
  assertIso(record.createdAtIso, 'Harvest creation time');
  assertText(record.createdByUserId, 'Harvest owner', 1, 128);
  assertText(record.cropId, 'Harvest crop id', 1, 128);
  assertText(record.notes, 'Harvest notes', 0, 5_000);
  assertLocalDate(record.occurredOn, 'Harvest date');
  assertText(record.plantingGroupId, 'Harvest crop-group id', 1, 128);
  assertEnum(
    record.unit,
    ['bunch', 'count', 'freeform', 'lb', 'oz'],
    'Harvest unit',
  );
}

export function assertValidTaskRecord(
  value: unknown,
  expectedId?: string,
): asserts value is GardenTask {
  const record = requireRecord(value, 'Garden task');
  assertExactKeys(
    record,
    [
      'completedAtIso',
      'createdAtIso',
      'dueOn',
      'id',
      'kind',
      'notes',
      'priority',
      'reason',
      'sourceId',
      'status',
      'target',
      'title',
      'updatedAtIso',
    ],
    'Garden task',
  );
  assertDocumentId(record, expectedId, 'Garden task');
  assertNullableIso(record.completedAtIso, 'Task completion time');
  assertIso(record.createdAtIso, 'Task creation time');
  assertLocalDate(record.dueOn, 'Task due date');
  assertEnum(record.kind, taskKinds, 'Task kind');
  assertText(record.notes, 'Task notes', 0, 5_000);
  assertEnum(record.priority, priorities, 'Task priority');
  assertText(record.reason, 'Task reason', 0, 1_000);
  assertNullableText(record.sourceId, 'Task source id', 128);
  assertEnum(
    record.status,
    ['deferred', 'done', 'open', 'snoozed'],
    'Task status',
  );
  assertTarget(record.target, 'Task target');
  assertText(record.title, 'Task title', 1, 200);
  assertIso(record.updatedAtIso, 'Task update time');
}

export function assertValidWaterApplicationRecord(
  value: unknown,
  expectedId?: string,
): asserts value is WaterApplication {
  const record = requireRecord(value, 'Water application');
  const baseKeys = [
    'appliedAtIso',
    'cropGroupId',
    'id',
    'method',
    'outcome',
    'recordedAtIso',
    'recordedByUserId',
    'revision',
  ];
  assertEnum(
    record.outcome,
    ['applied', 'partial', 'skipped'],
    'Water outcome',
  );
  assertExactKeys(
    record,
    record.outcome === 'applied' || record.outcome === 'partial'
      ? [...baseKeys, 'amount', 'efficiency']
      : [...baseKeys, 'skipReason'],
    'Water application',
  );
  assertDocumentId(record, expectedId, 'Water application');
  assertIso(record.appliedAtIso, 'Water application time');
  assertText(record.cropGroupId, 'Water crop-group id', 1, 128);
  assertEnum(
    record.method,
    ['drip', 'hand', 'hose', 'other', 'sprinkler'],
    'Watering method',
  );
  assertIso(record.recordedAtIso, 'Water recorded time');
  assertText(record.recordedByUserId, 'Water recorder', 1, 128);
  assertFiniteNumber(record.revision, 'Water revision', 1, 1_000_000, {
    integer: true,
  });

  if (record.outcome === 'applied' || record.outcome === 'partial') {
    assertWaterAmount(record.amount);
    assertEfficiency(record.efficiency);
  } else {
    assertText(record.skipReason, 'Water skip reason', 1, 1_000);
  }
}

function assertDocumentId(
  record: UnknownRecord,
  expectedId: string | undefined,
  label: string,
) {
  assertText(record.id, `${label} id`, 1, 500);
  if (expectedId !== undefined && record.id !== expectedId) {
    throw new Error(`${label} id does not match its document id.`);
  }
}

function assertTarget(value: unknown, label: string) {
  const target = requireRecord(value, label);
  assertExactKeys(target, ['id', 'kind', 'label'], label);
  assertNullableText(target.id, `${label} id`, 128);
  assertEnum(target.kind, targetKinds, `${label} kind`);
  assertText(target.label, `${label} label`, 1, 200);
  if (target.kind === 'garden' && target.id !== null) {
    throw new Error(`${label} garden id must be null.`);
  }
  if (target.kind !== 'garden' && target.id === null) {
    throw new Error(`${label} id is required.`);
  }
}

function assertPhoto(value: unknown, index: number) {
  const label = `Journal photo ${index + 1}`;
  const photo = requireRecord(value, label);
  assertExactKeys(
    photo,
    [
      'contentType',
      'fileName',
      'height',
      'id',
      'sizeBytes',
      'storagePath',
      'uploadedAtIso',
      'width',
    ],
    label,
  );
  assertText(photo.contentType, `${label} content type`, 1, 200);
  assertText(photo.fileName, `${label} file name`, 1, 500);
  assertNullableDimension(photo.height, `${label} height`);
  assertText(photo.id, `${label} id`, 1, 128);
  assertFiniteNumber(photo.sizeBytes, `${label} size`, 0, 50_000_000, {
    integer: true,
  });
  assertText(photo.storagePath, `${label} storage path`, 1, 1_000);
  assertIso(photo.uploadedAtIso, `${label} upload time`);
  assertNullableDimension(photo.width, `${label} width`);
}

function assertNullableDimension(value: unknown, label: string) {
  if (value !== null) {
    assertFiniteNumber(value, label, 1, 100_000, { integer: true });
  }
}

function assertWaterAmount(value: unknown) {
  const amount = requireRecord(value, 'Water amount');
  assertEnum(
    amount.unit,
    ['gallons', 'inches', 'unknown'],
    'Water amount unit',
  );
  if (amount.unit === 'inches') {
    assertExactKeys(amount, ['depthInches', 'unit'], 'Water amount');
    assertFiniteNumber(amount.depthInches, 'Water depth', 0, 10, {
      minimumExclusive: true,
    });
    return;
  }
  if (amount.unit === 'gallons') {
    assertExactKeys(amount, ['area', 'gallons', 'unit'], 'Water amount');
    assertFiniteNumber(amount.gallons, 'Water gallons', 0, 10_000, {
      minimumExclusive: true,
    });
    const area = requireRecord(amount.area, 'Water application area');
    assertExactKeys(
      area,
      ['reliability', 'squareFeet'],
      'Water application area',
    );
    assertEnum(
      area.reliability,
      ['estimated', 'geometry', 'measured', 'unknown'],
      'Water application area reliability',
    );
    assertNullableNumber(
      area.squareFeet,
      'Water application square feet',
      Number.MIN_VALUE,
      250_000,
    );
    return;
  }
  assertExactKeys(amount, ['unit'], 'Water amount');
}

function assertEfficiency(value: unknown) {
  const efficiency = requireRecord(value, 'Water application efficiency');
  assertExactKeys(
    efficiency,
    ['confidence', 'fraction', 'source'],
    'Water application efficiency',
  );
  assertEnum(efficiency.confidence, priorities, 'Efficiency confidence');
  assertFiniteNumber(efficiency.fraction, 'Efficiency fraction', 0, 1, {
    minimumExclusive: true,
  });
  assertEnum(
    efficiency.source,
    ['calibrated', 'estimated', 'manufacturer', 'manual'],
    'Efficiency source',
  );
}
