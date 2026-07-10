'use strict';

const {
  addDays,
  formatLocalDate,
  isValidTimezone,
  resolveLocalDateTimeIso,
} = require('./operationTime');

const WATERING_MODEL_VERSION = 'crop-water-balance-v2';
const WATERING_CALCULATION_REVISION = 1;
const GALLONS_PER_INCH_SQUARE_FOOT = 0.623;
const EPSILON = 0.000001;
const availableWaterPerSoilInch = {
  clay: 0.16,
  loam: 0.13,
  sandy: 0.07,
  unknown: 0.1,
};
const drainageDemandFactor = {
  fast: 1.1,
  moderate: 1,
  slow: 0.92,
  unknown: 1,
};
const drainageCaptureFactor = {
  fast: 0.72,
  moderate: 0.9,
  slow: 0.82,
  unknown: 0.75,
};

function createCropGroupTargets(plan) {
  const structures = new Map(
    plan.structures.map((structure) => [structure.id, structure]),
  );

  return plan.plantings
    .filter((planting) =>
      ['planted', 'growing', 'harvestReady'].includes(planting.lifecycle),
    )
    .map((planting) => {
      const structure = planting.growingAreaStructureId
        ? structures.get(planting.growingAreaStructureId) || null
        : null;
      const area = planting.widthFt * planting.depthFt;
      const allowedStages = ['establishing', 'flowering', 'fruiting', 'mature'];
      const allowedStageSources = [
        'manual',
        'plantingEvent',
        'lifecycleFallback',
      ];
      const savedStage = allowedStages.includes(planting.wateringStage)
        ? planting.wateringStage
        : null;
      const savedStageSource = allowedStageSources.includes(
        planting.wateringStageSource,
      )
        ? planting.wateringStageSource
        : null;
      const fallbackStage =
        planting.lifecycle === 'planted'
          ? 'establishing'
          : planting.lifecycle === 'harvestReady'
            ? 'fruiting'
            : 'mature';

      return {
        area: {
          reliability: area > 0 ? 'geometry' : 'unknown',
          squareFeet: area > 0 ? area : null,
        },
        deepLink: `/app/today?focus=watering&cropGroupId=${encodeURIComponent(planting.id)}`,
        kind: 'cropGroup',
        label: getCropGroupLabel(plan, planting),
        planting,
        stage:
          savedStageSource === 'lifecycleFallback'
            ? fallbackStage
            : savedStage || fallbackStage,
        stageSource:
          savedStage && savedStageSource
            ? savedStageSource
            : 'lifecycleFallback',
        structure:
          structure &&
          ['bed', 'raisedBed', 'container'].includes(structure.type)
            ? structure
            : null,
      };
    });
}

function getCropGroupLabel(plan, planting) {
  const peers = plan.plantings.filter(
    (candidate) => candidate.cropId === planting.cropId,
  );
  const ordinal = peers.findIndex((candidate) => candidate.id === planting.id);
  const cropLabel =
    peers.length > 1 && ordinal >= 0
      ? `${planting.cropName} group ${ordinal + 1}`
      : planting.cropName;
  const structure = plan.structures.find(
    (candidate) => candidate.id === planting.growingAreaStructureId,
  );
  return structure?.label ? `${cropLabel} in ${structure.label}` : cropLabel;
}

function getTargetFactors(target, reasons) {
  const profile = target.planting.waterProfile;
  assertNonNegative(profile.baseWeeklyInches, 'baseWeeklyInches');
  assertNonNegative(profile.rootDepthInches, 'rootDepthInches');
  assertFraction(profile.depletionFraction, 'depletionFraction');
  const stageCoefficient = profile.stageCoefficients[target.stage];
  assertNonNegative(stageCoefficient, 'stageCoefficient');
  const structure = target.structure;
  const soilType = structure?.soilType || 'unknown';
  const drainage = structure?.drainage || 'unknown';
  const soilDepth = structure?.soilDepthInches;

  if (soilDepth !== null && soilDepth !== undefined) {
    assertNonNegative(soilDepth, 'structure soilDepthInches');
  }

  const effectiveRootDepth =
    soilDepth > 0
      ? Math.min(profile.rootDepthInches, soilDepth)
      : profile.rootDepthInches;
  const isContainer = structure?.type === 'container';
  const isMulched = target.planting.mulched || structure?.mulched === true;
  const rootZoneCapacityInches = Math.max(
    0.1,
    effectiveRootDepth *
      (availableWaterPerSoilInch[soilType] ||
        availableWaterPerSoilInch.unknown) *
      (isContainer ? 0.8 : 1),
  );
  const demandFactor =
    (drainageDemandFactor[drainage] || 1) *
    (isMulched ? 0.85 : 1) *
    (isContainer ? 1.15 : 1);
  const contextUncertain =
    structure === null ||
    structure.soilType === 'unknown' ||
    structure.drainage === 'unknown' ||
    structure.soilDepthInches === null;

  if (soilDepth > 0 && soilDepth < profile.rootDepthInches) {
    reasons.push(
      reason(
        'ROOT_ZONE_LIMITED_BY_SOIL_DEPTH',
        `The ${soilDepth} inch soil depth limits the crop's ${profile.rootDepthInches} inch root profile.`,
      ),
    );
  }
  if (isContainer) {
    reasons.push(
      reason(
        'CONTAINER_DEMAND_ADJUSTED',
        'Container exposure and limited storage increase modeled crop demand.',
      ),
    );
  }
  if (isMulched) {
    reasons.push(
      reason(
        'MULCH_DEMAND_ADJUSTED',
        'Mulch reduces modeled evaporation and improves rain capture.',
      ),
    );
  }
  if (contextUncertain) {
    reasons.push(
      reason(
        'MISSING_STRUCTURE_CONTEXT',
        'Soil depth, soil type, drainage, and container context are not all known.',
      ),
    );
  }
  if (profile.confidence === 'low') {
    reasons.push(
      reason(
        'LOW_CONFIDENCE_CROP_PROFILE',
        `The crop water profile from ${profile.source}@${profile.sourceVersion} has low confidence.`,
      ),
    );
  }
  if (target.stageSource === 'lifecycleFallback') {
    reasons.push(
      reason(
        'LIFECYCLE_STAGE_FALLBACK',
        'The crop stage is a deterministic lifecycle fallback, not a directly recorded growth observation.',
      ),
    );
  }

  const cropDemandPerReferenceEtInch =
    profile.baseWeeklyInches * stageCoefficient * demandFactor;
  return {
    baseDailyDemandInches: cropDemandPerReferenceEtInch / 7,
    contextUncertain,
    cropDemandPerReferenceEtInch,
    rainCaptureFactor: clamp(
      (drainageCaptureFactor[drainage] || 0.75) + (isMulched ? 0.05 : 0),
      0,
      0.95,
    ),
    rootZoneCapacityInches,
    stageCoefficient,
    triggerDepletionInches: rootZoneCapacityInches * profile.depletionFraction,
  };
}

function buildRecommendationBasis(target, factors) {
  const profile = target.planting.waterProfile;
  const structure = target.structure;
  return {
    area: { ...target.area },
    cropProfile: {
      baseWeeklyInches: profile.baseWeeklyInches,
      confidence: profile.confidence,
      depletionFraction: profile.depletionFraction,
      rootDepthInches: profile.rootDepthInches,
      source: profile.source,
      sourceVersion: profile.sourceVersion,
      stage: target.stage,
      stageCoefficient: factors.stageCoefficient,
      stageSource: target.stageSource,
    },
    structure: structure
      ? {
          drainage: structure.drainage,
          id: structure.id,
          isContainer: structure.type === 'container',
          mulched: target.planting.mulched || structure.mulched,
          soilDepthInches: structure.soilDepthInches,
          soilType: structure.soilType,
          type: structure.type,
        }
      : null,
  };
}

function profileFingerprint(target) {
  const profile = target.planting.waterProfile;
  const structure = target.structure;
  return [
    profile.source,
    profile.sourceVersion,
    profile.baseWeeklyInches,
    profile.rootDepthInches,
    profile.depletionFraction,
    target.stage,
    target.stageSource,
    profile.stageCoefficients[target.stage],
    structure?.type || 'none',
    structure?.soilType || 'unknown',
    structure?.soilDepthInches ?? 'unknown',
    structure?.drainage || 'unknown',
    target.planting.mulched || structure?.mulched === true ? 'mulched' : 'bare',
  ].join('|');
}

function nextGardenTimeIso(nowIso, localTime, timezone) {
  const today = formatLocalDate(new Date(nowIso), timezone);
  const candidate = resolveLocalDateTimeIso(today, localTime, timezone);
  return Date.parse(candidate) > Date.parse(nowIso)
    ? candidate
    : resolveLocalDateTimeIso(addDays(today, 1), localTime, timezone);
}

function differenceInGardenDays(startIso, endIso, timezone) {
  const wallTime = (iso) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      fractionalSecondDigits: 3,
      hour: '2-digit',
      hourCycle: 'h23',
      minute: '2-digit',
      month: '2-digit',
      second: '2-digit',
      timeZone: timezone,
      year: 'numeric',
    }).formatToParts(new Date(iso));
    const read = (type) =>
      Number(parts.find((part) => part.type === type)?.value);
    return Date.UTC(
      read('year'),
      read('month') - 1,
      read('day'),
      read('hour'),
      read('minute'),
      read('second'),
      read('fractionalSecond'),
    );
  };
  return (wallTime(endIso) - wallTime(startIso)) / 86_400_000;
}

function createInitialWaterBalance(asOfIso, cropGroupId) {
  return {
    applicationLedger: [],
    asOfIso,
    calculationRevision: WATERING_CALCULATION_REVISION,
    cropGroupId,
    depletionInches: 0,
    modelVersion: WATERING_MODEL_VERSION,
    profileFingerprint: 'uninitialized',
  };
}

function assertIsoInstant(value) {
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new Error(`Invalid UTC ISO instant: ${value}`);
  }
}

function assertNonNegative(value, label) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be finite and non-negative.`);
  }
}

function assertFraction(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be between 0 and 1.`);
  }
}

function reason(code, message, amountInches = null, sourceIds = []) {
  return {
    amountInches: amountInches === null ? null : round(amountInches),
    code,
    message,
    sourceIds,
  };
}

function worstQuality(...qualities) {
  const ranks = { cached: 1, fresh: 0, insufficient: 3, stale: 2 };
  return qualities.reduce((worst, value) =>
    ranks[value] > ranks[worst] ? value : worst,
  );
}

function hasReliableArea(area) {
  return (
    area?.squareFeet > 0 && ['measured', 'geometry'].includes(area.reliability)
  );
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

module.exports = {
  EPSILON,
  GALLONS_PER_INCH_SQUARE_FOOT,
  WATERING_CALCULATION_REVISION,
  WATERING_MODEL_VERSION,
  assertFraction,
  assertIsoInstant,
  assertNonNegative,
  buildRecommendationBasis,
  clamp,
  createCropGroupTargets,
  createInitialWaterBalance,
  differenceInGardenDays,
  getTargetFactors,
  getCropGroupLabel,
  hasReliableArea,
  isValidTimezone,
  nextGardenTimeIso,
  profileFingerprint,
  reason,
  round,
  worstQuality,
};
