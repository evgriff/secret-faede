import {
  addReason,
  assertFiniteNonNegative,
  assertFraction,
  availableWaterPerSoilInch,
  clamp,
  drainageCaptureFactor,
  drainageDemandFactor,
  type TargetFactors,
} from './modelSupport';
import type {
  CropGroupWateringTarget,
  WateringReasonDetail,
  WateringRecommendationBasis,
} from './types';

export function getTargetFactors(
  target: CropGroupWateringTarget,
  reasons: WateringReasonDetail[],
): TargetFactors {
  const profile = target.planting.waterProfile;
  assertFiniteNonNegative(profile.baseWeeklyInches, 'baseWeeklyInches');
  assertFiniteNonNegative(profile.rootDepthInches, 'rootDepthInches');
  assertFraction(profile.depletionFraction, 'depletionFraction');
  const stageCoefficient = profile.stageCoefficients[target.stage];
  assertFiniteNonNegative(stageCoefficient, 'stageCoefficient');
  const structure = target.structure;
  const soilType = structure?.soilType ?? 'unknown';
  const drainage = structure?.drainage ?? 'unknown';
  const soilDepth = structure?.soilDepthInches;

  if (soilDepth !== null && soilDepth !== undefined) {
    assertFiniteNonNegative(soilDepth, 'structure soilDepthInches');
  }

  const effectiveRootDepth =
    soilDepth !== null && soilDepth !== undefined && soilDepth > 0
      ? Math.min(profile.rootDepthInches, soilDepth)
      : profile.rootDepthInches;
  const isContainer = structure?.type === 'container';
  const isMulched = target.planting.mulched || structure?.mulched === true;
  const capacityFactor = isContainer ? 0.8 : 1;
  const rootZoneCapacityInches = Math.max(
    0.1,
    effectiveRootDepth * availableWaterPerSoilInch[soilType] * capacityFactor,
  );
  const triggerDepletionInches =
    rootZoneCapacityInches * profile.depletionFraction;
  const demandFactor =
    drainageDemandFactor[drainage] *
    (isMulched ? 0.85 : 1) *
    (isContainer ? 1.15 : 1);
  const rainCaptureFactor = clamp(
    drainageCaptureFactor[drainage] + (isMulched ? 0.05 : 0),
    0,
    0.95,
  );
  const cropDemandPerReferenceEtInch =
    profile.baseWeeklyInches * stageCoefficient * demandFactor;

  if (
    soilDepth !== null &&
    soilDepth !== undefined &&
    soilDepth > 0 &&
    soilDepth < profile.rootDepthInches
  ) {
    addReason(
      reasons,
      'ROOT_ZONE_LIMITED_BY_SOIL_DEPTH',
      `The ${soilDepth} inch soil depth limits the crop's ${profile.rootDepthInches} inch root profile.`,
    );
  }

  if (isContainer) {
    addReason(
      reasons,
      'CONTAINER_DEMAND_ADJUSTED',
      'Container exposure and limited storage increase modeled crop demand.',
    );
  }

  if (isMulched) {
    addReason(
      reasons,
      'MULCH_DEMAND_ADJUSTED',
      'Mulch reduces modeled evaporation and improves rain capture.',
    );
  }

  const contextUncertain =
    structure === null ||
    structure.soilType === 'unknown' ||
    structure.drainage === 'unknown' ||
    structure.soilDepthInches === null;

  if (contextUncertain) {
    addReason(
      reasons,
      'MISSING_STRUCTURE_CONTEXT',
      'Soil depth, soil type, drainage, and container context are not all known.',
    );
  }

  if (profile.confidence === 'low') {
    addReason(
      reasons,
      'LOW_CONFIDENCE_CROP_PROFILE',
      `The crop water profile from ${profile.source}@${profile.sourceVersion} has low confidence.`,
    );
  }

  if (target.stageSource === 'lifecycleFallback') {
    addReason(
      reasons,
      'LIFECYCLE_STAGE_FALLBACK',
      'The crop stage is a deterministic lifecycle fallback, not a directly recorded growth observation.',
    );
  }

  return {
    baseDailyDemandInches: cropDemandPerReferenceEtInch / 7,
    contextUncertain,
    cropDemandPerReferenceEtInch,
    rainCaptureFactor,
    rootZoneCapacityInches,
    stageCoefficient,
    triggerDepletionInches,
  };
}

export function buildRecommendationBasis(
  target: CropGroupWateringTarget,
  factors: TargetFactors,
): WateringRecommendationBasis {
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
    structure:
      structure === null
        ? null
        : {
            drainage: structure.drainage,
            id: structure.id,
            isContainer: structure.type === 'container',
            mulched: target.planting.mulched || structure.mulched,
            soilDepthInches: structure.soilDepthInches,
            soilType: structure.soilType,
            type: structure.type,
          },
  };
}
