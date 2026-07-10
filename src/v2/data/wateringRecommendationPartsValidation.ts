import {
  WATERING_CALCULATION_REVISION,
  WATERING_MODEL_VERSION,
} from '../domain';
import {
  assertBoolean,
  assertEnum,
  assertExactKeys,
  assertFiniteNumber,
  assertIso,
  assertNullableNumber,
  assertText,
  requireArray,
  requireRecord,
} from './recordValidationSupport';

const confidenceValues = ['high', 'low', 'medium'] as const;
const reasonCodes = [
  'AREA_UNRELIABLE_NO_GALLONS',
  'BACKDATED_APPLICATION_CREDITED',
  'BALANCE_AT_OR_ABOVE_TRIGGER',
  'BALANCE_BELOW_TRIGGER',
  'BALANCE_ROLLED_FORWARD',
  'CACHED_WEATHER_USED',
  'CONTAINER_DEMAND_ADJUSTED',
  'EXCESS_WATER_DRAINED',
  'FORECAST_DEPLETION_EXPECTED',
  'FORECAST_ET_ESTIMATED',
  'FORECAST_RAIN_SUPPRESSION',
  'FORECAST_WEATHER_INSUFFICIENT',
  'FORECAST_WEATHER_STALE',
  'HISTORICAL_ET_ACCRUED',
  'HISTORICAL_ET_ESTIMATED',
  'HISTORICAL_WEATHER_GAP',
  'HISTORICAL_WEATHER_INSUFFICIENT',
  'HISTORICAL_WEATHER_STALE',
  'LIFECYCLE_STAGE_FALLBACK',
  'LOW_CONFIDENCE_CROP_PROFILE',
  'MISSING_BALANCE_BASELINE',
  'MISSING_RAIN_OBSERVATION',
  'MISSING_STRUCTURE_CONTEXT',
  'MULCH_DEMAND_ADJUSTED',
  'OBSERVED_RAIN_CREDITED',
  'PROFILE_REVISION_APPLIED',
  'ROOT_ZONE_LIMITED_BY_SOIL_DEPTH',
  'SKIPPED_APPLICATION_ZERO_CREDIT',
  'UNKNOWN_APPLICATION_AMOUNT',
  'WATER_APPLICATION_CREDITED',
] as const;

export function assertWateringRecommendationBalance(
  value: unknown,
  cropGroupId: string,
) {
  const balance = requireRecord(value, 'Water balance');
  assertExactKeys(
    balance,
    [
      'applicationLedger',
      'asOfIso',
      'calculationRevision',
      'cropGroupId',
      'depletionInches',
      'modelVersion',
      'profileFingerprint',
    ],
    'Water balance',
  );
  assertIso(balance.asOfIso, 'Water balance time');
  if (balance.calculationRevision !== WATERING_CALCULATION_REVISION) {
    throw new Error('Water balance calculation revision is unsupported.');
  }
  if (balance.cropGroupId !== cropGroupId) {
    throw new Error('Water balance crop group does not match its target.');
  }
  assertFiniteNumber(balance.depletionInches, 'Water depletion', 0, 1_000);
  if (balance.modelVersion !== WATERING_MODEL_VERSION) {
    throw new Error('Water balance model version is unsupported.');
  }
  assertText(balance.profileFingerprint, 'Water profile fingerprint', 1, 500);
  const applicationIds = new Set<string>();
  requireArray(
    balance.applicationLedger,
    'Water application ledger',
    5_000,
  ).forEach((value, index) => {
    const entry = requireRecord(value, `Water ledger entry ${index + 1}`);
    assertExactKeys(
      entry,
      ['applicationId', 'creditedDepthInches', 'outcome', 'revision'],
      `Water ledger entry ${index + 1}`,
    );
    assertText(
      entry.applicationId,
      `Water ledger entry ${index + 1} id`,
      1,
      500,
    );
    if (applicationIds.has(entry.applicationId)) {
      throw new Error('Water application ledger contains duplicate ids.');
    }
    applicationIds.add(entry.applicationId);
    assertFiniteNumber(
      entry.creditedDepthInches,
      `Water ledger entry ${index + 1} credit`,
      0,
      100,
    );
    assertEnum(
      entry.outcome,
      ['applied', 'skipped'],
      `Water ledger entry ${index + 1} outcome`,
    );
    assertFiniteNumber(
      entry.revision,
      `Water ledger entry ${index + 1} revision`,
      1,
      1_000_000,
      { integer: true },
    );
  });
}

export function assertWateringRecommendationBasis(value: unknown) {
  const basis = requireRecord(value, 'Watering basis');
  assertExactKeys(
    basis,
    ['area', 'cropProfile', 'structure'],
    'Watering basis',
  );
  assertArea(basis.area);
  assertCropProfile(basis.cropProfile);
  if (basis.structure !== null) assertStructureBasis(basis.structure);
}

function assertArea(value: unknown) {
  const area = requireRecord(value, 'Watering area');
  assertExactKeys(area, ['reliability', 'squareFeet'], 'Watering area');
  assertEnum(
    area.reliability,
    ['estimated', 'geometry', 'measured', 'unknown'],
    'Watering area reliability',
  );
  assertNullableNumber(
    area.squareFeet,
    'Watering square feet',
    Number.MIN_VALUE,
    250_000,
  );
}

function assertCropProfile(value: unknown) {
  const profile = requireRecord(value, 'Watering crop profile');
  assertExactKeys(
    profile,
    [
      'baseWeeklyInches',
      'confidence',
      'depletionFraction',
      'rootDepthInches',
      'source',
      'sourceVersion',
      'stage',
      'stageCoefficient',
      'stageSource',
    ],
    'Watering crop profile',
  );
  assertFiniteNumber(profile.baseWeeklyInches, 'Weekly water need', 0, 10);
  assertEnum(profile.confidence, confidenceValues, 'Crop-profile confidence');
  assertFiniteNumber(profile.depletionFraction, 'Depletion fraction', 0, 1, {
    minimumExclusive: true,
  });
  assertFiniteNumber(profile.rootDepthInches, 'Root depth', 0, 120, {
    minimumExclusive: true,
  });
  assertEnum(
    profile.source,
    ['catalog', 'curated', 'estimated', 'manual'],
    'Crop-profile source',
  );
  assertText(profile.sourceVersion, 'Crop-profile source version', 1, 200);
  assertEnum(
    profile.stage,
    ['establishing', 'flowering', 'fruiting', 'mature'],
    'Watering stage',
  );
  assertFiniteNumber(
    profile.stageCoefficient,
    'Watering stage coefficient',
    0,
    3,
  );
  assertEnum(
    profile.stageSource,
    ['lifecycleFallback', 'manual', 'plantingEvent'],
    'Watering stage source',
  );
}

function assertStructureBasis(value: unknown) {
  const structure = requireRecord(value, 'Watering structure basis');
  assertExactKeys(
    structure,
    [
      'drainage',
      'id',
      'isContainer',
      'mulched',
      'soilDepthInches',
      'soilType',
      'type',
    ],
    'Watering structure basis',
  );
  assertEnum(
    structure.drainage,
    ['fast', 'moderate', 'slow', 'unknown'],
    'Structure drainage',
  );
  assertText(structure.id, 'Watering structure id', 1, 128);
  assertBoolean(structure.isContainer, 'Watering container state');
  assertBoolean(structure.mulched, 'Watering mulch state');
  assertNullableNumber(structure.soilDepthInches, 'Soil depth', 1, 120);
  assertEnum(
    structure.soilType,
    ['clay', 'loam', 'sandy', 'unknown'],
    'Structure soil type',
  );
  assertEnum(
    structure.type,
    ['bed', 'container', 'raisedBed'],
    'Watering structure type',
  );
}

export function assertWateringRecommendationReasons(
  codesValue: unknown,
  detailsValue: unknown,
) {
  const codes = requireArray(codesValue, 'Watering reason codes', 100);
  const codeSet = new Set<string>();
  codes.forEach((code) => {
    assertEnum(code, reasonCodes, 'Watering reason code');
    if (codeSet.has(code)) throw new Error('Watering reason codes repeat.');
    codeSet.add(code);
  });
  const detailCodes = new Set<string>();
  requireArray(detailsValue, 'Watering reason details', 100).forEach(
    (value, index) => {
      const detail = requireRecord(value, `Watering reason ${index + 1}`);
      assertExactKeys(
        detail,
        ['amountInches', 'code', 'message', 'sourceIds'],
        `Watering reason ${index + 1}`,
      );
      assertNullableNumber(
        detail.amountInches,
        `Watering reason ${index + 1} amount`,
        0,
        100,
      );
      assertEnum(detail.code, reasonCodes, `Watering reason ${index + 1} code`);
      detailCodes.add(detail.code);
      assertText(
        detail.message,
        `Watering reason ${index + 1} message`,
        1,
        1_000,
      );
      requireArray(
        detail.sourceIds,
        `Watering reason ${index + 1} sources`,
        1_000,
      ).forEach((sourceId) =>
        assertText(sourceId, `Watering reason ${index + 1} source id`, 1, 500),
      );
    },
  );
  if (
    codeSet.size !== detailCodes.size ||
    [...codeSet].some((code) => !detailCodes.has(code))
  ) {
    throw new Error('Watering reason codes do not match their details.');
  }
}
