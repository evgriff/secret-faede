import {
  PLANTING_WATERING_STAGES,
  PLANTING_WATERING_STAGE_SOURCES,
  wateringStageForLifecycle,
  type PlantingGroup,
} from '../plan';
import { assertIsoInstant } from '../time/gardenTime';
import {
  WATERING_CALCULATION_REVISION,
  WATERING_MODEL_VERSION,
  type CropGroupTargetOptions,
  type CropGroupWateringTarget,
  type WaterBalanceBaseline,
  type WateringStage,
  type WateringStageSource,
} from './types';
import { assertFiniteNonNegative, round } from './modelSupport';

interface InitialBalanceOptions {
  asOfIso: string;
  cropGroupId: string;
  depletionInches?: number;
}

export function isWateringActivePlanting(planting: PlantingGroup) {
  return (
    planting.lifecycle === 'planted' ||
    planting.lifecycle === 'growing' ||
    planting.lifecycle === 'harvestReady'
  );
}

export function resolveLifecycleWateringStage(planting: PlantingGroup) {
  if (!isWateringActivePlanting(planting)) {
    throw new Error(
      `Planting group ${planting.id} is not active for watering recommendations.`,
    );
  }
  return {
    source: 'lifecycleFallback' as const,
    stage: wateringStageForLifecycle(planting.lifecycle),
  };
}

export function resolvePlantingWateringStage(planting: PlantingGroup): {
  source: WateringStageSource;
  stage: WateringStage;
} {
  if (!PLANTING_WATERING_STAGES.includes(planting.wateringStage)) {
    throw new Error(
      `Planting group ${planting.id} has an invalid watering stage.`,
    );
  }
  if (!PLANTING_WATERING_STAGE_SOURCES.includes(planting.wateringStageSource)) {
    throw new Error(
      `Planting group ${planting.id} has an invalid watering stage source.`,
    );
  }
  if (planting.wateringStageSource === 'lifecycleFallback') {
    const fallback = resolveLifecycleWateringStage(planting);
    if (planting.wateringStage !== fallback.stage) {
      throw new Error(
        `Planting group ${planting.id} has a watering stage that does not match its lifecycle fallback.`,
      );
    }
  }
  return {
    source: planting.wateringStageSource,
    stage: planting.wateringStage,
  };
}

export function createCropGroupWateringTarget(
  planting: PlantingGroup,
  options: CropGroupTargetOptions,
): CropGroupWateringTarget {
  if (options.deepLink.trim() === '') {
    throw new Error('A crop-group deep link is required.');
  }
  if (
    options.structure !== null &&
    planting.growingAreaStructureId !== options.structure.id
  ) {
    throw new Error('The watering structure must match the planting group.');
  }
  if (
    options.structure !== null &&
    options.structure.type !== 'bed' &&
    options.structure.type !== 'raisedBed' &&
    options.structure.type !== 'container'
  ) {
    throw new Error('Watering structure context must be a growing structure.');
  }

  assertFiniteNonNegative(planting.widthFt, 'planting widthFt');
  assertFiniteNonNegative(planting.depthFt, 'planting depthFt');
  const squareFeet = planting.widthFt * planting.depthFt;
  const wateringStage = resolvePlantingWateringStage(planting);

  return {
    area: {
      reliability: options.areaReliability,
      squareFeet: squareFeet > 0 ? squareFeet : null,
    },
    deepLink: options.deepLink,
    kind: 'cropGroup',
    label: options.label?.trim() || planting.cropName,
    planting,
    stage: wateringStage.stage,
    stageSource: wateringStage.source,
    structure: options.structure,
  };
}

export function createInitialWaterBalance({
  asOfIso,
  cropGroupId,
  depletionInches = 0,
}: InitialBalanceOptions): WaterBalanceBaseline {
  assertIsoInstant(asOfIso);
  assertFiniteNonNegative(depletionInches, 'depletionInches');

  return {
    applicationLedger: [],
    asOfIso,
    calculationRevision: WATERING_CALCULATION_REVISION,
    cropGroupId,
    depletionInches: round(depletionInches),
    modelVersion: WATERING_MODEL_VERSION,
    profileFingerprint: 'uninitialized',
  };
}
