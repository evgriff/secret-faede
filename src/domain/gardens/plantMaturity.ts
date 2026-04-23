import type {
  CropGrowthForm,
  CropProfile,
  PlantCanopyDensity,
  Planting,
  PlantingLifecycleStatus,
  PlantPlanningGrowthStage,
} from './models';
import type {
  PlantMaturityProfile,
  PlantSupportType,
} from './plantPlanningTypes';

export const canopyOpacityByDensity: Record<PlantCanopyDensity, number> = {
  dense: 0.78,
  moderate: 0.55,
  open: 0.34,
};

export const growthStageHeightScale: Record<PlantPlanningGrowthStage, number> =
  {
    dormant: 0.15,
    early: 0.35,
    mature: 1,
    vegetative: 0.68,
  };

export const defaultSupportHeightFtByType: Record<PlantSupportType, number> = {
  cage: 4,
  custom: 5,
  netting: 2,
  none: 0,
  rowCover: 1.5,
  stake: 5,
  stakeAndWeave: 5.5,
};

const defaultMatureHeightFtByGrowthForm: Record<CropGrowthForm, number> = {
  bulb: 1.25,
  bush: 2.5,
  climber: 6,
  clump: 1.5,
  groundcover: 0.75,
  rosette: 1,
  root: 1.25,
  upright: 3,
  vining: 2,
};

const defaultMatureSpreadFtByGrowthForm: Record<CropGrowthForm, number> = {
  bulb: 0.75,
  bush: 2,
  climber: 1.25,
  clump: 1.25,
  groundcover: 2,
  rosette: 1,
  root: 0.75,
  upright: 1.5,
  vining: 3,
};

export function buildPlantMaturityProfile({
  crop,
  planting,
}: {
  crop: CropProfile | null;
  planting: Planting;
}): PlantMaturityProfile {
  const growthForm = crop?.growthForm ?? 'upright';
  const sourceNotes: string[] = [];
  const matureHeightFt = inchesToFeet(
    planting.matureHeightInches ?? crop?.matureHeightInches,
    defaultMatureHeightFtByGrowthForm[growthForm],
    'mature height',
    sourceNotes,
  );
  const matureSpreadFt = inchesToFeet(
    planting.matureSpreadInches ??
      crop?.matureSpreadInches ??
      planting.spacingInches ??
      crop?.spacingInches,
    defaultMatureSpreadFtByGrowthForm[growthForm],
    'mature spread',
    sourceNotes,
  );
  const supportHeightFt = getPlanningSupportHeightFt(planting, matureHeightFt);
  const growthStage = getPlanningGrowthStage(planting.status);
  const canopyDensity = getPlanningCanopyDensity(crop);
  const stageScale = growthStageHeightScale[growthStage];
  const effectiveHeightFt = Math.max(
    matureHeightFt * stageScale,
    supportHeightFt ?? 0,
  );

  return {
    canopyDensity,
    canopyOpacity: Number(canopyOpacityByDensity[canopyDensity].toFixed(2)),
    canopyRadiusFt: Number(Math.max(matureSpreadFt / 2, 0.25).toFixed(2)),
    effectiveHeightFt: Number(effectiveHeightFt.toFixed(2)),
    growthStage,
    matureHeightFt: Number(matureHeightFt.toFixed(2)),
    matureSpreadFt: Number(matureSpreadFt.toFixed(2)),
    sourceNotes,
    supportHeightFt,
  };
}

export function getPlanningGrowthStage(
  status: PlantingLifecycleStatus,
): PlantPlanningGrowthStage {
  switch (status) {
    case 'harvested':
    case 'removed':
      return 'dormant';
    case 'planned':
    case 'planted':
      return 'mature';
    case 'growing':
      return 'vegetative';
    case 'harvest-ready':
      return 'mature';
  }
}

export function getPlanningCanopyDensity(
  crop: CropProfile | null,
): PlantCanopyDensity {
  switch (crop?.growthForm) {
    case 'climber':
    case 'vining':
      return crop.trellisRequired || crop.trellisRecommended
        ? 'moderate'
        : 'dense';
    case 'bush':
    case 'groundcover':
      return 'dense';
    case 'clump':
    case 'rosette':
    case 'upright':
      return 'moderate';
    case 'bulb':
    case 'root':
    case undefined:
      return 'open';
  }
}

export function getPlanningSupportHeightFt(
  planting: Planting,
  matureHeightFt: number,
) {
  if (planting.support.type !== 'none') {
    return Math.max(
      defaultSupportHeightFtByType[planting.support.type],
      matureHeightFt,
    );
  }

  if (planting.mode === 'trellisLine' || (planting.trellisLengthFt ?? 0) > 0) {
    return Math.max(defaultSupportHeightFtByType.stakeAndWeave, matureHeightFt);
  }

  return null;
}

function inchesToFeet(
  value: number | null | undefined,
  fallbackFt: number,
  label: string,
  sourceNotes: string[],
) {
  if (value && value > 0) {
    return value / 12;
  }

  sourceNotes.push(`${label} uses growth-form fallback`);
  return fallbackFt;
}
