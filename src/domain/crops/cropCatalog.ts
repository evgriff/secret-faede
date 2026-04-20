import type {
  CropCategory,
  CropGrowthForm,
  CropLifecycle,
  CropProfile,
  CropSowMethod,
  CropWaterNeed,
  PlantingMode,
  SunExposure,
} from '../gardens/GardenRepository';
import cropOverrides from './curatedCropOverrides.json';

interface CuratedCropOverride {
  category: CropCategory;
  commonName: string;
  daysToMaturity: number | null;
  defaultIcon: string;
  family: string;
  growthForm: CropGrowthForm;
  hardiness: string;
  id: string;
  lifecycle: CropLifecycle;
  matureHeightInches: number | null;
  matureSpreadInches: number | null;
  notes: string;
  perennialSuitability: string;
  rowSpacingInches: number | null;
  scientificName: string;
  sowMethod: CropSowMethod;
  spacingInches: number | null;
  sunRequirement: SunExposure;
  supportedPlantingModes: PlantingMode[];
  trefleQuery?: string;
  trellisRecommended: boolean;
  weeklyWaterNeedInches: number | null;
}

export interface CropCatalogFilters {
  growthForm?: CropGrowthForm | 'any';
  query?: string;
  sowMethod?: CropSowMethod | 'any';
  sunRequirement?: SunExposure | 'any';
  waterNeeds?: CropWaterNeed | 'any';
}

const curatedCropOverrides = cropOverrides as CuratedCropOverride[];

export const cropCatalog: CropProfile[] = curatedCropOverrides
  .map(toCropProfile)
  .sort((left, right) => left.commonName.localeCompare(right.commonName));

export const cropCatalogById = new Map(
  cropCatalog.map((crop) => [crop.id, crop]),
);

export const cropCatalogFilterOptions = {
  growthForms: uniqueSorted(cropCatalog.map((crop) => crop.growthForm)),
  sowMethods: uniqueSorted(cropCatalog.map((crop) => crop.sowMethod)),
  sunRequirements: uniqueSorted(cropCatalog.map((crop) => crop.sunRequirement)),
  waterNeeds: uniqueSorted(cropCatalog.map((crop) => crop.waterNeeds)),
};

export function getCropById(cropId: string | null | undefined) {
  return cropId ? (cropCatalogById.get(cropId) ?? null) : null;
}

export function filterCropCatalog(filters: CropCatalogFilters) {
  const normalizedQuery = filters.query?.trim().toLowerCase() ?? '';

  return cropCatalog.filter((crop) => {
    const matchesQuery =
      !normalizedQuery ||
      crop.commonName.toLowerCase().includes(normalizedQuery) ||
      crop.scientificName.toLowerCase().includes(normalizedQuery) ||
      crop.family.toLowerCase().includes(normalizedQuery);

    return (
      matchesQuery &&
      matchesFilter(crop.sunRequirement, filters.sunRequirement) &&
      matchesFilter(crop.waterNeeds, filters.waterNeeds) &&
      matchesFilter(crop.growthForm, filters.growthForm) &&
      matchesSowMethod(crop.sowMethod, filters.sowMethod)
    );
  });
}

function toCropProfile(override: CuratedCropOverride): CropProfile {
  return {
    category: override.category,
    commonName: override.commonName,
    daysToMaturity: override.daysToMaturity,
    defaultIcon: override.defaultIcon,
    family: override.family,
    frostSensitive: override.hardiness
      .toLowerCase()
      .includes('frost sensitive'),
    growthForm: override.growthForm,
    hardiness: override.hardiness,
    id: override.id,
    lifecycle: override.lifecycle,
    matureHeightInches: override.matureHeightInches,
    matureSpreadInches: override.matureSpreadInches,
    name: override.commonName,
    notes: override.notes,
    perennialSuitability: override.perennialSuitability,
    rowSpacingInches: override.rowSpacingInches,
    scientificName: override.scientificName,
    sowMethod: override.sowMethod,
    spacingInches: override.spacingInches,
    sunExposure: override.sunRequirement,
    sunRequirement: override.sunRequirement,
    supportedPlantingModes: override.supportedPlantingModes,
    trellisRecommended: override.trellisRecommended,
    trellisRequired: override.trellisRecommended,
    weeklyWaterNeedInches: override.weeklyWaterNeedInches,
    waterNeeds: toWaterNeed(override.weeklyWaterNeedInches),
  };
}

function toWaterNeed(weeklyWaterNeedInches: number | null): CropWaterNeed {
  if (weeklyWaterNeedInches === null) {
    return 'medium';
  }

  if (weeklyWaterNeedInches < 0.75) {
    return 'low';
  }

  return weeklyWaterNeedInches > 1.15 ? 'high' : 'medium';
}

function matchesFilter<T extends string>(
  value: T,
  filter: T | 'any' | undefined,
) {
  return !filter || filter === 'any' || value === filter;
}

function matchesSowMethod(
  value: CropSowMethod,
  filter: CropSowMethod | 'any' | undefined,
) {
  return !filter || filter === 'any' || value === filter || value === 'both';
}

function uniqueSorted<T extends string>(values: T[]) {
  return [...new Set(values)].sort();
}
