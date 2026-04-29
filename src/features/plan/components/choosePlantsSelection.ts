import type {
  CropProfile,
  PlantingMode,
  SeasonCropSelection,
} from '../../../domain/gardens/GardenRepository';
import { getCropSupportProfile } from '../../../domain/gardens/GardenRepository';
import { getCropById } from '../../../domain/crops/cropCatalog';
import {
  coercePlantQuantity,
  getRecommendedPlantingMode,
} from '../../garden/cropPickerHelpers';

export function createSeasonCropSelection(
  crop: CropProfile,
  quantityInput = 1,
  plantingFormInput?: PlantingMode,
): SeasonCropSelection {
  const quantity = coercePlantQuantity(quantityInput);

  return {
    cropId: crop.id,
    id: `season-${crop.id}`,
    notes: '',
    plantingForm: normalizeSeasonPlantingForm(
      crop,
      quantity,
      plantingFormInput,
    ),
    quantity,
    spacingOverrideInches: null,
    supportAllowed: getCropSupportProfile(crop).scope === 'structure',
    varietyName: '',
  };
}

export function normalizeSeasonCropSelections(
  selections: SeasonCropSelection[],
) {
  return selections.map((selection) => {
    const crop = getCropById(selection.cropId);
    const quantity = coerceSeasonCropQuantity(selection.quantity);

    return {
      ...selection,
      plantingForm: crop
        ? normalizeSeasonPlantingForm(crop, quantity, selection.plantingForm)
        : selection.plantingForm,
      quantity,
      spacingOverrideInches: coerceSpacingOverride(
        selection.spacingOverrideInches,
      ),
    };
  });
}

export function normalizeSeasonPlantingForm(
  crop: CropProfile,
  quantityInput: number,
  plantingFormInput?: PlantingMode,
): PlantingMode {
  const quantity = coercePlantQuantity(quantityInput);
  const options = getQuantityFirstPlantingModes(crop, quantity);

  if (plantingFormInput && options.includes(plantingFormInput)) {
    return plantingFormInput;
  }

  const recommendedMode = getRecommendedPlantingMode(crop, quantity);

  return options.includes(recommendedMode)
    ? recommendedMode
    : (options[0] ?? recommendedMode);
}

export function getQuantityFirstPlantingModes(
  crop: CropProfile,
  quantityInput: number,
): PlantingMode[] {
  const quantity = coercePlantQuantity(quantityInput);
  const groupedModes = ['row', 'block', 'cluster', 'trellisLine'].filter(
    (mode): mode is PlantingMode =>
      crop.supportedPlantingModes.includes(mode as PlantingMode),
  );

  if (quantity > 1 && groupedModes.length > 0) {
    return groupedModes;
  }

  if (quantity <= 1 && crop.supportedPlantingModes.includes('single')) {
    return ['single', ...groupedModes];
  }

  return crop.supportedPlantingModes.length > 0
    ? crop.supportedPlantingModes
    : [getRecommendedPlantingMode(crop, quantity)];
}

function coerceSeasonCropQuantity(value: number) {
  return coercePlantQuantity(value);
}

function coerceSpacingOverride(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number.isFinite(value) && value > 0 ? Number(value.toFixed(1)) : null;
}
