import type {
  CropProfile,
  PlantingMode,
  SeasonCropSelection,
} from '../../../domain/gardens/GardenRepository';

export function createSeasonCropSelection(
  crop: CropProfile,
  rank: number,
): SeasonCropSelection {
  const modePreference = getDefaultMode(crop);

  return {
    commitment: 'niceToHave',
    containerAllowed: true,
    cropId: crop.id,
    id: `season-${crop.id}`,
    modePreference,
    notes: '',
    priority: 'medium',
    rank,
    sowPreference: crop.sowMethod === 'both' ? 'noPreference' : crop.sowMethod,
    supportAllowed: crop.trellisRecommended || crop.trellisRequired,
    targetQuantity: getDefaultQuantity(modePreference),
    varietyName: '',
  };
}

export function normalizeSelectionRanks(selections: SeasonCropSelection[]) {
  return selections.map((selection, index) => ({
    ...selection,
    rank: index,
    targetQuantity: coerceTargetQuantity(selection.targetQuantity),
  }));
}

function getDefaultMode(crop: CropProfile): PlantingMode {
  if (
    crop.trellisRecommended &&
    crop.supportedPlantingModes.includes('trellisLine')
  ) {
    return 'trellisLine';
  }

  return crop.supportedPlantingModes[0] ?? 'single';
}

function getDefaultQuantity(mode: PlantingMode) {
  return mode === 'single' ? 1 : 6;
}

function coerceTargetQuantity(value: number) {
  return Math.max(1, Math.min(999, Math.round(value || 1)));
}
