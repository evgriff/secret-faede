import type {
  CropCategory,
  CropGrowthForm,
  CropLifecycle,
  CropProfile,
  CropProfileConfidence,
  CropSowMethod,
  CropWaterNeed,
  PlantingMode,
  SunExposure,
} from '../gardens/GardenRepository';
import cropRecords from './homeGardenCropCatalog.generated.json';

interface CatalogCropRecord {
  aliases?: string[];
  category: CropCategory;
  caution?: string | null;
  commonName: string;
  daysToMaturity: number | null;
  defaultIcon: string;
  family: string;
  growthForm: CropGrowthForm;
  hardiness: string;
  id: string;
  lifecycle: CropLifecycle;
  lastRefreshedIso?: string | null;
  manualOverride?: boolean;
  matureHeightInches: number | null;
  matureSpreadInches: number | null;
  notes: string;
  perennialSuitability: string;
  pollinatorRole?: string | null;
  profileConfidence?: CropProfileConfidence;
  rowSpacingInches: number | null;
  rootDepthInches?: number | null;
  roles?: string[];
  scientificName: string;
  source?: string;
  sowMethod: CropSowMethod;
  sourceTags?: string[];
  spacingInches: number | null;
  synonyms?: string[];
  sunRequirement: SunExposure;
  supportedPlantingModes: PlantingMode[];
  trefleQuery?: string;
  trellisRecommended: boolean;
  varietyGroup?: string | null;
  weeklyWaterNeedInches: number | null;
}

export interface CropCatalogFilters {
  category?: CropCategory | 'any';
  growthForm?: CropGrowthForm | 'any';
  query?: string;
  sowMethod?: CropSowMethod | 'any';
  sunRequirement?: SunExposure | 'any';
  waterNeeds?: CropWaterNeed | 'any';
}

const homeGardenCropRecords = cropRecords as CatalogCropRecord[];

export const cropCatalog: CropProfile[] = homeGardenCropRecords
  .map(toCropProfile)
  .sort(compareCatalogOrder);

export const cropCatalogById = new Map(
  cropCatalog.map((crop) => [crop.id, crop]),
);

export const cropCatalogFilterOptions = {
  categories: uniqueSorted(cropCatalog.map((crop) => crop.category)),
  growthForms: uniqueSorted(cropCatalog.map((crop) => crop.growthForm)),
  sowMethods: uniqueSorted(cropCatalog.map((crop) => crop.sowMethod)),
  sunRequirements: uniqueSorted(cropCatalog.map((crop) => crop.sunRequirement)),
  waterNeeds: uniqueSorted(cropCatalog.map((crop) => crop.waterNeeds)),
};

export function getCropById(cropId: string | null | undefined) {
  return cropId ? (cropCatalogById.get(cropId) ?? null) : null;
}

export function filterCropCatalog(filters: CropCatalogFilters) {
  const normalizedQuery = normalizeSearchText(filters.query ?? '');

  return cropCatalog
    .filter(
      (crop) =>
        queryMatchesCrop(crop, normalizedQuery) &&
        matchesFilter(crop.category, filters.category) &&
        matchesFilter(crop.sunRequirement, filters.sunRequirement) &&
        matchesFilter(crop.waterNeeds, filters.waterNeeds) &&
        matchesFilter(crop.growthForm, filters.growthForm) &&
        matchesSowMethod(crop.sowMethod, filters.sowMethod),
    )
    .sort((left, right) =>
      normalizedQuery
        ? getQueryScore(right, normalizedQuery) -
            getQueryScore(left, normalizedQuery) ||
          compareCatalogOrder(left, right)
        : compareCatalogOrder(left, right),
    );
}

function toCropProfile(override: CatalogCropRecord): CropProfile {
  const completenessScore = calculateCompletenessScore(override);
  const profileConfidence =
    override.profileConfidence ?? toProfileConfidence(completenessScore);

  return {
    aliases: override.aliases ?? [],
    category: override.category,
    caution: override.caution ?? null,
    commonName: override.commonName,
    completenessScore,
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
    lastRefreshedIso: override.lastRefreshedIso ?? null,
    manualOverride: override.manualOverride ?? false,
    matureHeightInches: override.matureHeightInches,
    matureSpreadInches: override.matureSpreadInches,
    name: override.commonName,
    notes: override.notes,
    perennialSuitability: override.perennialSuitability,
    pollinatorRole: override.pollinatorRole ?? null,
    profileConfidence,
    rowSpacingInches: override.rowSpacingInches,
    rootDepthInches: override.rootDepthInches ?? null,
    roles: override.roles ?? [],
    scientificName: override.scientificName,
    source: override.source ?? 'unknown',
    sowMethod: override.sowMethod,
    sourceTags: override.sourceTags ?? ['curated', 'secret-faede-v1'],
    spacingInches: override.spacingInches,
    synonyms: override.synonyms ?? [],
    sunExposure: override.sunRequirement,
    sunRequirement: override.sunRequirement,
    supportedPlantingModes: override.supportedPlantingModes,
    trellisRecommended: override.trellisRecommended,
    trellisRequired: override.trellisRecommended,
    varietyGroup: override.varietyGroup ?? null,
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

function calculateCompletenessScore(override: CatalogCropRecord) {
  const fields = [
    override.category,
    override.commonName,
    override.daysToMaturity,
    override.family,
    override.hardiness,
    override.matureHeightInches,
    override.matureSpreadInches,
    override.notes,
    override.rootDepthInches,
    override.rowSpacingInches,
    override.scientificName,
    override.spacingInches,
    override.sowMethod,
    override.sunRequirement,
    override.supportedPlantingModes.length > 0 ? 'modes' : null,
    override.weeklyWaterNeedInches,
  ];
  const present = fields.filter(
    (field) => field !== null && field !== undefined && field !== '',
  ).length;

  return Number((present / fields.length).toFixed(2));
}

function toProfileConfidence(completenessScore: number): CropProfileConfidence {
  if (completenessScore >= 0.9) {
    return 'complete';
  }

  return completenessScore >= 0.72 ? 'partial' : 'needsReview';
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

function queryMatchesCrop(crop: CropProfile, normalizedQuery: string) {
  if (!normalizedQuery) {
    return true;
  }

  const fields = getSearchFields(crop);
  const queryParts = getQueryParts(normalizedQuery);

  return (
    fields.some((field) => field.value.includes(normalizedQuery)) ||
    queryParts.every((part) =>
      fields.some((field) => field.value.includes(part)),
    )
  );
}

function getQueryScore(crop: CropProfile, normalizedQuery: string) {
  const fields = getSearchFields(crop);
  const queryParts = getQueryParts(normalizedQuery);
  const phraseScore = Math.max(
    ...fields.map((field) => getFieldMatchScore(field, normalizedQuery)),
  );
  const termScore = queryParts.every((part) =>
    fields.some((field) => field.value.includes(part)),
  )
    ? Math.max(...queryParts.map((part) => getTermMatchScore(fields, part)))
    : 0;

  return (
    Math.max(phraseScore, termScore) -
    getGeneratedVarietyPenalty(crop, normalizedQuery)
  );
}

function getSearchFields(crop: CropProfile) {
  return [
    { value: crop.commonName, weight: 900 },
    { value: crop.id, weight: 850 },
    ...crop.aliases.map((value) => ({
      value,
      weight: 820,
    })),
    ...crop.synonyms.map((value) => ({
      value,
      weight: 760,
    })),
    { value: crop.scientificName, weight: 720 },
    { value: crop.varietyGroup ?? '', weight: 640 },
    { value: crop.family, weight: 520 },
    { value: crop.category, weight: 500 },
    ...crop.roles.map((value) => ({
      value,
      weight: 460,
    })),
  ]
    .map((field) => ({
      ...field,
      value: normalizeSearchText(field.value),
    }))
    .filter((field) => field.value);
}

function getFieldMatchScore(
  field: { value: string; weight: number },
  normalizedQuery: string,
) {
  if (field.value === normalizedQuery) {
    return field.weight + 90;
  }

  if (field.value.startsWith(`${normalizedQuery} `)) {
    return field.weight + 60;
  }

  if (field.value.startsWith(normalizedQuery)) {
    return field.weight + 45;
  }

  if (field.value.includes(` ${normalizedQuery} `)) {
    return field.weight + 25;
  }

  if (field.value.endsWith(` ${normalizedQuery}`)) {
    return field.weight + 18;
  }

  return field.value.includes(normalizedQuery) ? field.weight : 0;
}

function getTermMatchScore(
  fields: Array<{ value: string; weight: number }>,
  queryPart: string,
) {
  return Math.max(
    ...fields.map((field) => getFieldMatchScore(field, queryPart) - 120),
  );
}

function getGeneratedVarietyPenalty(
  crop: CropProfile,
  normalizedQuery: string,
) {
  if (!crop.varietyGroup) {
    return 0;
  }

  const commonName = normalizeSearchText(crop.commonName);
  const varietyGroup = normalizeSearchText(crop.varietyGroup);

  if (commonName === normalizedQuery) {
    return 0;
  }

  if (normalizedQuery === varietyGroup) {
    return 240;
  }

  if (
    getQueryParts(normalizedQuery).length === 1 &&
    commonName.endsWith(` ${normalizedQuery}`)
  ) {
    return 180;
  }

  return 35;
}

function getQueryParts(normalizedQuery: string) {
  return normalizedQuery.split(' ').filter(Boolean);
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function compareCatalogOrder(left: CropProfile, right: CropProfile) {
  return (
    Number(Boolean(left.varietyGroup)) - Number(Boolean(right.varietyGroup)) ||
    left.commonName.localeCompare(right.commonName)
  );
}

function uniqueSorted<T extends string>(values: T[]) {
  return [...new Set(values)].sort();
}
