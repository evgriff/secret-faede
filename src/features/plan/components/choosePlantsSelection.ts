import type {
  CropProfile,
  SeasonCropSelection,
} from '../../../domain/gardens/GardenRepository';
import {
  coercePlantQuantity,
  getRecommendedPlantingMode,
} from '../../garden/cropPickerHelpers';

export function createSeasonCropSelection(
  crop: CropProfile,
): SeasonCropSelection {
  const quantity = 1;

  return {
    cropId: crop.id,
    id: `season-${crop.id}`,
    notes: '',
    plantingForm: getRecommendedPlantingMode(crop, quantity),
    quantity,
    supportAllowed: crop.trellisRecommended || crop.trellisRequired,
    varietyName: '',
  };
}

export function normalizeSeasonCropSelections(
  selections: SeasonCropSelection[],
) {
  return selections.map((selection) => ({
    ...selection,
    quantity: coerceSeasonCropQuantity(selection.quantity),
  }));
}

function coerceSeasonCropQuantity(value: number) {
  return coercePlantQuantity(value);
}
