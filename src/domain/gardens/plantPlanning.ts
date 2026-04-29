import { createDefaultPlantStatus } from './models';
import {
  getPlanningCanopyDensity,
  getPlanningGrowthStage,
  getPlanningSupportHeightFt,
} from './plantMaturity';
import type {
  CropProfile,
  Planting,
  PlantingLifecycleStatus,
  PlantingMode,
} from './models';
import { derivePlantingGeometry } from './plantingGeometry';
import { getPlantingInstances } from './plantingInstances';
import { getCropSupportNeed } from './supportNeeds';
import type {
  PlantDifficulty,
  PlantDot,
  PlantGroup,
  PlantGroupFootprint,
  PlantPlacementMode,
  PlantSpecies,
  PlantStatus,
  PlantStatusPhoto,
  PlantSupportPlan,
  PlantSupportType,
} from './plantPlanningTypes';

export * from './plantPlanningTypes';

const minimumPlantSpacingInches = 9;

export function toPlantSpecies(crop: CropProfile): PlantSpecies {
  const supportNeed = getCropSupportNeed(crop);
  const supportedPlacementModes = crop.supportedPlantingModes
    .flatMap(toPlantPlacementModeOrNull)
    .filter(isPlantPlacementMode)
    .filter(uniquePlacementMode);

  return {
    aliases: crop.aliases,
    catalogCropId: crop.id,
    category: crop.category,
    commonName: crop.commonName,
    difficulty: getPlantDifficulty(crop),
    growthForm: crop.growthForm,
    id: crop.id,
    lifecycle: crop.lifecycle,
    matureHeightInches: crop.matureHeightInches,
    matureSpreadInches: crop.matureSpreadInches,
    planningCanopyDensity: getPlanningCanopyDensity(crop),
    planningGrowthStage: 'mature',
    rowSpacingInches: crop.rowSpacingInches,
    scientificName: crop.scientificName,
    source: 'catalog',
    spacingInches: crop.spacingInches,
    supportHeightFt:
      supportNeed?.scope === 'structure'
        ? Math.max((crop.matureHeightInches ?? 60) / 12, 5)
        : null,
    sunRequirement: crop.sunRequirement,
    supportedPlacementModes:
      supportedPlacementModes.length > 0
        ? supportedPlacementModes
        : ['cluster'],
    trellisRecommended:
      supportNeed?.kind === 'trellis' && supportNeed.recommended,
    trellisRequired: supportNeed?.kind === 'trellis' && supportNeed.required,
    waterNeeds: crop.waterNeeds,
    weeklyWaterNeedInches: crop.weeklyWaterNeedInches,
  };
}

export function createPlantGroupFromPlanting(
  planting: Planting,
  species: PlantSpecies = createLegacyPlantSpecies(planting),
): PlantGroup {
  const instances = getPlantingInstances(planting);
  const quantity = Math.max(
    Math.round(planting.plantCount ?? instances.length),
    1,
  );

  return {
    allowRelocation: planting.allowRelocation,
    bedStructureId: null,
    id: planting.id,
    label: planting.label,
    locked: planting.locked,
    placementMode: toPlantPlacementMode(planting.mode),
    plannedFor: planting.plannedFor,
    plantedOn: planting.plantedOn,
    planningCanopyDensity: species.planningCanopyDensity,
    planningGrowthStage: getPlanningGrowthStage(planting.status),
    quantity,
    rowSpacingInches:
      planting.rowSpacingInches ?? species.rowSpacingInches ?? null,
    spacingInches: normalizeSpacingInches(
      planting.spacingInches ??
        species.spacingInches ??
        planting.matureSpreadInches ??
        species.matureSpreadInches,
    ),
    species,
    status: normalizePlantStatusForPlanting(planting),
    support: normalizePlantSupportPlanForQuantity(
      planting.support.type === 'none'
        ? inferPlantSupportPlan(species, quantity)
        : planting.support,
      quantity,
    ),
    supportHeightFt: getPlanningSupportHeightFt(
      planting,
      getSpeciesHeightFt(species),
    ),
    supportStructureIds: planting.supportStructureIds,
    trellisLengthFt: planting.trellisLengthFt,
    trellisStructureId: planting.supportStructureIds[0] ?? null,
    xFt: planting.xFt,
    yFt: planting.yFt,
  };
}

export function createPlantStatus({
  lifecycle = 'planned',
  notes = '',
  photos = [],
}: {
  lifecycle?: PlantingLifecycleStatus;
  notes?: string;
  photos?: PlantStatusPhoto[];
} = {}): PlantStatus {
  return createDefaultPlantStatus({ lifecycle, notes, photos });
}

function normalizePlantStatusForPlanting(planting: Planting): PlantStatus {
  const lifecycle =
    planting.plantStatus.lifecycle === 'planned' &&
    planting.status !== 'planned'
      ? planting.status
      : planting.plantStatus.lifecycle;

  return {
    ...createPlantStatus({
      lifecycle: planting.status,
      notes: planting.notes,
    }),
    ...planting.plantStatus,
    lifecycle,
    notes: planting.plantStatus.notes || planting.notes,
  };
}

export function derivePlantDots(group: PlantGroup): PlantDot[] {
  const geometry = derivePlantingGeometry({
    id: group.id,
    matureSpreadInches: group.species.matureSpreadInches,
    mode: group.placementMode,
    quantity: group.quantity,
    rowSpacingInches: group.rowSpacingInches,
    spacingInches: group.spacingInches,
    xFt: group.xFt,
    yFt: group.yFt,
  });

  return geometry.dots.map((dot, index) => ({
    id: `${group.id}-dot-${index + 1}`,
    index,
    label:
      geometry.quantity === 1
        ? group.label
        : `${group.species.commonName} ${index + 1}`,
    plantGroupId: group.id,
    xFt: dot.xFt,
    yFt: dot.yFt,
  }));
}

export function derivePlantGroupFootprint(
  group: PlantGroup,
): PlantGroupFootprint {
  const geometry = derivePlantingGeometry({
    id: group.id,
    matureSpreadInches: group.species.matureSpreadInches,
    mode: group.placementMode,
    quantity: group.quantity,
    rowSpacingInches: group.rowSpacingInches,
    spacingInches: group.spacingInches,
    xFt: group.xFt,
    yFt: group.yFt,
  });

  return {
    depthFt: geometry.footprint.depthFt,
    id: `${group.id}:footprint`,
    label: group.label,
    plantGroupId: group.id,
    widthFt: geometry.footprint.widthFt,
    xFt: geometry.footprint.xFt,
    yFt: geometry.footprint.yFt,
  };
}

export function toPlantPlacementMode(mode: PlantingMode): PlantPlacementMode {
  return mode === 'block'
    ? 'block'
    : mode === 'row' || mode === 'trellisLine'
      ? 'row'
      : 'cluster';
}

function toPlantPlacementModeOrNull(
  mode: PlantingMode,
): PlantPlacementMode | null {
  return mode === 'single' ? null : toPlantPlacementMode(mode);
}

function uniquePlacementMode(
  mode: PlantPlacementMode,
  index: number,
  modes: PlantPlacementMode[],
) {
  return modes.indexOf(mode) === index;
}

function isPlantPlacementMode(
  mode: PlantPlacementMode | null,
): mode is PlantPlacementMode {
  return mode !== null;
}

function createLegacyPlantSpecies(planting: Planting): PlantSpecies {
  return {
    aliases: [],
    catalogCropId: planting.cropId,
    category: 'vegetable',
    commonName: planting.label,
    difficulty: 'moderate',
    growthForm: 'upright',
    id: planting.cropId ?? `legacy:${planting.id}`,
    lifecycle: 'annual',
    matureHeightInches: planting.matureHeightInches,
    matureSpreadInches: planting.matureSpreadInches,
    planningCanopyDensity: 'moderate',
    planningGrowthStage: getPlanningGrowthStage(planting.status),
    rowSpacingInches: planting.rowSpacingInches,
    scientificName: '',
    source: 'legacyCustom',
    spacingInches: planting.spacingInches,
    supportHeightFt:
      planting.mode === 'trellisLine' || (planting.trellisLengthFt ?? 0) > 0
        ? Math.max((planting.matureHeightInches ?? 60) / 12, 5)
        : null,
    sunRequirement: planting.sunRequirement ?? 'fullSun',
    supportedPlacementModes: [toPlantPlacementMode(planting.mode)],
    trellisRecommended:
      planting.mode === 'trellisLine' || (planting.trellisLengthFt ?? 0) > 0,
    trellisRequired: false,
    waterNeeds: 'medium',
    weeklyWaterNeedInches: planting.weeklyWaterNeedInches,
  };
}

function getPlantDifficulty(crop: CropProfile): PlantDifficulty {
  const supportNeed = getCropSupportNeed(crop);

  if (
    supportNeed?.required ||
    crop.waterNeeds === 'high' ||
    crop.frostSensitive ||
    crop.profileCompleteness === 'needsReview'
  ) {
    return 'demanding';
  }

  if (supportNeed?.recommended || crop.waterNeeds === 'medium') {
    return 'moderate';
  }

  return 'easy';
}

function inferPlantSupportPlan(
  species: PlantSpecies,
  quantity: number,
): PlantSupportPlan {
  const type = getPerPlantSupportType(species);

  return {
    installedAtIso: null,
    notes: '',
    perPlant: type !== 'none',
    quantity: type === 'none' ? 0 : quantity,
    required: type !== 'none' && species.trellisRequired,
    type,
  };
}

export function normalizePlantSupportPlanForQuantity(
  support: PlantSupportPlan,
  quantity: number,
): PlantSupportPlan {
  if (support.type === 'none') {
    return {
      ...support,
      perPlant: false,
      quantity: 0,
      required: false,
    };
  }

  return {
    ...support,
    quantity: support.perPlant
      ? Math.max(Math.round(quantity), 1)
      : support.quantity,
  };
}

function getPerPlantSupportType(species: PlantSpecies): PlantSupportType {
  if (/tomato/i.test(species.commonName)) {
    return 'cage';
  }

  if (/eggplant|aubergine/i.test(species.commonName)) {
    return 'stake';
  }

  if (
    species.growthForm === 'upright' &&
    (species.matureHeightInches ?? 0) >= 36
  ) {
    return 'stake';
  }

  return 'none';
}

function normalizeSpacingInches(value: number | null | undefined) {
  return Math.max(value ?? 12, minimumPlantSpacingInches);
}

function getSpeciesHeightFt(species: PlantSpecies) {
  return Math.max((species.matureHeightInches ?? 0) / 12, 0);
}
