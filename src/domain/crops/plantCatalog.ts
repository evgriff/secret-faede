import type {
  CropProfile,
  PlantDifficulty,
  PlantPlacementMode,
} from '../gardens/GardenRepository';
import {
  cropCatalog,
  filterCropCatalog,
  type CropCatalogFilters,
} from './cropCatalog';
import type {
  PlantCatalogEntry,
  PlantCatalogSupportNeed,
  PlantHarvestCycle,
  PlantHarvestCycleInfo,
  PlantPreferredSeason,
  PlantSeasonWindow,
} from './plantCatalogTypes';
export type {
  MonthDayRange,
  PlantCatalogEntry,
  PlantCatalogSupportNeed,
  PlantClimateInputs,
  PlantHarvestCycle,
  PlantHarvestCycleInfo,
  PlantLocationContext,
  PlantLocationMatch,
  PlantLocationMatchBand,
  PlantLocationMatchConfidence,
  PlantLocationMatchRationale,
  PlantLifecycleTiming,
  PlantPreferredSeason,
  PlantSeasonWindow,
} from './plantCatalogTypes';

export const plantCatalog: PlantCatalogEntry[] =
  cropCatalog.map(toPlantCatalogEntry);

export const plantCatalogById = new Map(
  plantCatalog.map((plant) => [plant.id, plant]),
);

export function getPlantCatalogEntry(cropId: string | null | undefined) {
  return cropId ? (plantCatalogById.get(cropId) ?? null) : null;
}

export function filterPlantCatalogEntries(filters: CropCatalogFilters) {
  return filterCropCatalog(filters).map(toPlantCatalogEntry);
}

export function toPlantCatalogEntry(crop: CropProfile): PlantCatalogEntry {
  const preferredSeason = getPreferredSeason(crop);

  return {
    climate: {
      frostSensitive: crop.frostSensitive,
      hardiness: crop.hardiness,
      locationNotes: getClimateNotes(crop),
      perennialSuitability: crop.perennialSuitability,
      preferredSeason,
      southeastMichiganWindow: getSoutheastMichiganWindow(preferredSeason),
    },
    commonName: crop.commonName,
    compatiblePlacementModes: getCompatiblePlacementModes(crop),
    crop,
    defaultSpacingInches: crop.spacingInches ?? crop.matureSpreadInches ?? 18,
    defaultSupport: getDefaultSupportNeed(crop),
    description: crop.notes || crop.caution || crop.perennialSuitability,
    difficulty: getPlantDifficulty(crop),
    harvest: getHarvestCycle(crop),
    id: crop.id,
    lifecycle: crop.lifecycle,
    matureHeightInches: crop.matureHeightInches,
    matureSpreadInches: crop.matureSpreadInches,
    rowSpacingInches: crop.rowSpacingInches,
    scientificName: crop.scientificName,
    sunPreference: crop.sunRequirement,
    timing: {
      daysToMaturity: crop.daysToMaturity,
      directSowCompatible:
        crop.sowMethod === 'directSow' || crop.sowMethod === 'both',
      minimumSoilTempF:
        preferredSeason === 'warmSeason'
          ? 75
          : preferredSeason === 'coolSeason'
            ? 55
            : null,
      preferredSeason,
      transplantCompatible:
        crop.sowMethod === 'transplant' || crop.sowMethod === 'both',
      transplantLeadWeeks: crop.sowMethod === 'directSow' ? null : 4,
    },
    waterNeed: crop.waterNeeds,
  };
}

function getCompatiblePlacementModes(crop: CropProfile): PlantPlacementMode[] {
  const modes = crop.supportedPlantingModes.map(
    (mode): PlantPlacementMode =>
      mode === 'block'
        ? 'block'
        : mode === 'row' || mode === 'trellisLine'
          ? 'row'
          : 'cluster',
  );

  return [...new Set(modes)];
}

function getDefaultSupportNeed(crop: CropProfile): PlantCatalogSupportNeed {
  if (crop.trellisRequired || crop.trellisRecommended) {
    const isTrellisCrop =
      !/tomato/i.test(crop.commonName) &&
      (crop.growthForm === 'vining' || crop.growthForm === 'climber');

    return {
      kind: isTrellisCrop ? 'trellis' : 'perPlant',
      label: isTrellisCrop
        ? 'Trellis recommended'
        : 'Cage or stake recommended',
      perPlant: !isTrellisCrop,
      recommended: true,
      required: crop.trellisRequired,
      type: /tomato/i.test(crop.commonName) ? 'cage' : 'stake',
    };
  }

  if ((crop.matureHeightInches ?? 0) >= 36 && crop.growthForm === 'upright') {
    return {
      kind: 'perPlant',
      label: 'Stake if exposed',
      perPlant: true,
      recommended: true,
      required: false,
      type: 'stake',
    };
  }

  return {
    kind: 'none',
    label: 'No default support',
    perPlant: false,
    recommended: false,
    required: false,
    type: 'none',
  };
}

export function getPreferredSeason(crop: CropProfile): PlantPreferredSeason {
  const hardiness = crop.hardiness.toLowerCase();

  if (crop.lifecycle === 'perennial' && !hardiness.includes('tender')) {
    return 'perennial';
  }

  if (crop.frostSensitive || hardiness.includes('warm-season')) {
    return 'warmSeason';
  }

  if (
    hardiness.includes('cool-season') ||
    hardiness.includes('frost tolerant') ||
    hardiness.includes('light frost')
  ) {
    return 'coolSeason';
  }

  return 'flexible';
}

function getSoutheastMichiganWindow(
  preferredSeason: PlantPreferredSeason,
): PlantSeasonWindow {
  switch (preferredSeason) {
    case 'coolSeason':
      return {
        fallPlanting: { end: '09-15', start: '07-01' },
        springPlanting: { end: '05-15', start: '03-15' },
      };
    case 'warmSeason':
      return {
        fallPlanting: null,
        springPlanting: { end: '06-30', start: '05-15' },
      };
    case 'perennial':
      return {
        fallPlanting: { end: '10-01', start: '09-01' },
        springPlanting: { end: '06-01', start: '04-15' },
      };
    case 'flexible':
      return {
        fallPlanting: { end: '09-01', start: '07-15' },
        springPlanting: { end: '06-15', start: '04-15' },
      };
  }
}

function getHarvestCycle(crop: CropProfile): PlantHarvestCycleInfo {
  const text =
    `${crop.commonName} ${crop.notes} ${crop.roles.join(' ')}`.toLowerCase();
  const cycle: PlantHarvestCycle =
    /lettuce|kale|chard|spinach|arugula|herb|basil|cilantro/.test(text)
      ? 'cutAndComeAgain'
      : /tomato|pepper|bean|cucumber|squash|zucchini|berry|strawberry/.test(
            text,
          )
        ? 'continuous'
        : /radish|carrot|beet|turnip|succession/.test(text)
          ? 'successive'
          : 'single';

  return {
    cycle,
    daysToFirstHarvest: crop.daysToMaturity,
    harvestWindowDays:
      cycle === 'continuous' ? 45 : cycle === 'cutAndComeAgain' ? 30 : null,
    notes: getHarvestCycleNotes(cycle),
  };
}

function getHarvestCycleNotes(cycle: PlantHarvestCycle) {
  switch (cycle) {
    case 'continuous':
      return 'Harvest repeatedly once production starts.';
    case 'cutAndComeAgain':
      return 'Harvest outer leaves or tips while the plant keeps growing.';
    case 'successive':
      return 'Best planned as small repeat sowings.';
    case 'single':
      return 'Usually harvested once at maturity.';
  }
}

function getPlantDifficulty(crop: CropProfile): PlantDifficulty {
  if (
    crop.trellisRequired ||
    crop.waterNeeds === 'high' ||
    crop.frostSensitive ||
    crop.profileCompleteness === 'needsReview'
  ) {
    return 'demanding';
  }

  return crop.trellisRecommended || crop.waterNeeds === 'medium'
    ? 'moderate'
    : 'easy';
}

function getClimateNotes(crop: CropProfile) {
  return [crop.hardiness, crop.perennialSuitability, crop.caution]
    .filter((value): value is string => Boolean(value && value.trim()))
    .slice(0, 3);
}
