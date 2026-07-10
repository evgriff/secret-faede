import {
  WATERING_CALCULATION_REVISION,
  WATERING_MODEL_VERSION,
  type WateringRecommendation,
} from '../domain';
import {
  assertBoolean,
  assertEnum,
  assertExactKeys,
  assertFiniteNumber,
  assertIso,
  assertNullableIso,
  assertNullableNumber,
  assertNullableText,
  assertText,
  requireArray,
  requireRecord,
} from './recordValidationSupport';
import {
  assertWateringRecommendationBalance,
  assertWateringRecommendationBasis,
  assertWateringRecommendationReasons,
} from './wateringRecommendationPartsValidation';

const confidenceValues = ['high', 'low', 'medium'] as const;
const qualityValues = ['cached', 'fresh', 'insufficient', 'stale'] as const;
export function assertValidWateringRecommendationRecord(
  value: unknown,
  expectedCropGroupId?: string,
): asserts value is WateringRecommendation & { workspaceRevisionId: string } {
  const record = requireRecord(value, 'Watering recommendation');
  assertExactKeys(
    record,
    [
      'action',
      'actionable',
      'balance',
      'basis',
      'calculatedAtIso',
      'calculationRevision',
      'confidence',
      'dataQuality',
      'forecastRainCreditInches',
      'id',
      'modelVersion',
      'projectedDepletionInches',
      'reasonCodes',
      'reasonDetails',
      'recommendedDepthInches',
      'recommendedGallons',
      'recheckAtIso',
      'rootZoneCapacityInches',
      'scheduledForIso',
      'status',
      'suppressedUntilIso',
      'target',
      'triggerDepletionInches',
      'workspaceRevisionId',
    ],
    'Watering recommendation',
  );
  assertEnum(
    record.action,
    ['checkSoil', 'planWatering', 'waitForForecast', 'waterNow'],
    'Watering action',
  );
  assertBoolean(record.actionable, 'Watering actionable state');
  assertIso(record.calculatedAtIso, 'Watering calculation time');
  if (record.calculationRevision !== WATERING_CALCULATION_REVISION) {
    throw new Error('Watering calculation revision is unsupported.');
  }
  assertEnum(record.confidence, confidenceValues, 'Watering confidence');
  assertEnum(record.dataQuality, qualityValues, 'Watering data quality');
  assertFiniteNumber(
    record.forecastRainCreditInches,
    'Forecast rain credit',
    0,
    100,
  );
  assertText(record.id, 'Watering recommendation id', 1, 500);
  if (record.modelVersion !== WATERING_MODEL_VERSION) {
    throw new Error('Watering model version is unsupported.');
  }
  assertFiniteNumber(
    record.projectedDepletionInches,
    'Projected depletion',
    0,
    1_000,
  );
  assertNullableNumber(
    record.recommendedDepthInches,
    'Recommended depth',
    0,
    100,
  );
  assertNullableNumber(
    record.recommendedGallons,
    'Recommended gallons',
    0,
    1_000_000,
  );
  assertIso(record.recheckAtIso, 'Watering recheck time');
  assertFiniteNumber(
    record.rootZoneCapacityInches,
    'Root-zone capacity',
    0,
    1_000,
  );
  assertNullableIso(record.scheduledForIso, 'Scheduled watering time');
  assertEnum(
    record.status,
    ['checkSoil', 'due', 'scheduled', 'suppressed'],
    'Watering status',
  );
  assertNullableIso(record.suppressedUntilIso, 'Watering suppression time');
  assertFiniteNumber(
    record.triggerDepletionInches,
    'Trigger depletion',
    0,
    1_000,
  );
  assertText(record.workspaceRevisionId, 'Workspace revision id', 1, 500);

  const targetCropGroupId = assertTarget(record.target, expectedCropGroupId);
  assertWateringRecommendationBalance(record.balance, targetCropGroupId);
  assertWateringRecommendationBasis(record.basis);
  assertWateringRecommendationReasons(record.reasonCodes, record.reasonDetails);
  assertActionStatus(record.action, record.actionable, record.status);
}

function assertTarget(value: unknown, expectedCropGroupId?: string) {
  const target = requireRecord(value, 'Watering target');
  assertExactKeys(
    target,
    [
      'cropGroupId',
      'cropGroupLabel',
      'cropId',
      'cropName',
      'deepLink',
      'kind',
      'plantingIds',
      'structureId',
    ],
    'Watering target',
  );
  assertText(target.cropGroupId, 'Watering crop-group id', 1, 128);
  if (target.cropGroupLabel !== undefined) {
    assertText(target.cropGroupLabel, 'Watering crop-group label', 1, 200);
  }
  assertText(target.cropId, 'Watering crop id', 1, 128);
  assertText(target.cropName, 'Watering crop name', 1, 200);
  assertText(target.deepLink, 'Watering deep link', 1, 1_000);
  if (!target.deepLink.startsWith('/app/')) {
    throw new Error('Watering deep link must stay inside the app.');
  }
  if (target.kind !== 'cropGroup') {
    throw new Error('Watering target kind is invalid.');
  }
  const plantingIds = requireArray(
    target.plantingIds,
    'Watering planting ids',
    1,
  );
  if (plantingIds.length !== 1 || plantingIds[0] !== target.cropGroupId) {
    throw new Error(
      'Watering planting ids must identify exactly one crop group.',
    );
  }
  assertNullableText(target.structureId, 'Watering structure id', 128);
  if (
    expectedCropGroupId !== undefined &&
    target.cropGroupId !== expectedCropGroupId
  ) {
    throw new Error('Watering crop-group id does not match its document id.');
  }
  return target.cropGroupId;
}

function assertActionStatus(
  action: unknown,
  actionable: unknown,
  status: unknown,
) {
  const expected = {
    checkSoil: { action: 'checkSoil', actionable: true },
    due: { action: 'waterNow', actionable: true },
    scheduled: { action: 'planWatering', actionable: false },
    suppressed: { action: 'waitForForecast', actionable: false },
  }[status as 'checkSoil' | 'due' | 'scheduled' | 'suppressed'];
  if (
    !expected ||
    action !== expected.action ||
    actionable !== expected.actionable
  ) {
    throw new Error('Watering action does not match recommendation status.');
  }
}
