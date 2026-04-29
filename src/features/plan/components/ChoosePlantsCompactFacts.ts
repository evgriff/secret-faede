import { getPlantCatalogEntry } from '../../../domain/crops/plantCatalog';
import {
  createPlantLocationContext,
  explainPlantLocationMatch,
  getPlantTimingGuidance,
  scorePlantLocationMatch,
} from '../../../domain/crops/plantLocationMatch';
import type {
  CropProfile,
  Garden,
  PlantingMode,
  SunExposure,
} from '../../../domain/gardens/GardenRepository';
import { getCropSupportProfile } from '../../../domain/gardens/GardenRepository';
import {
  formatLabel,
  formatSun,
  formatWater,
  modeLabels,
} from '../../garden/cropPickerHelpers';

export interface CompactPlantFacts {
  description: string;
  difficultyLabel: string;
  difficultyShortLabel: string;
  harvestLabel: string;
  lifecycleLabel: string;
  locationMatchReasons: string[];
  locationMatchBasis: string;
  locationMatchBand: string;
  locationMatchDetails: string[];
  locationMatchLabel: string;
  locationMatchShortLabel: string;
  locationMatchSummary: string;
  locationMatchWarnings: string[];
  modeLabel: string;
  spacingLabel: string;
  supportLabel: string;
  supportShortLabel: string;
  timingDetail: string;
  timingLabel: string;
  sunShortLabel: string;
  sunLabel: string;
  waterShortLabel: string;
  waterLabel: string;
}

export function getCompactPlantFacts({
  crop,
  garden,
  mode,
  sunExposureAtPlacement,
  today = new Date(),
}: {
  crop: CropProfile;
  garden: Garden;
  mode: PlantingMode;
  sunExposureAtPlacement: SunExposure | null;
  today?: Date;
}): CompactPlantFacts {
  const plant = getPlantCatalogEntry(crop.id);
  const locationContext = createPlantLocationContext({
    climateProfile: garden.climateProfile,
    location: garden.plot.location,
  });
  const locationMatch = scorePlantLocationMatch({
    context: locationContext,
    crop,
    sunExposureAtPlacement,
    today,
  });
  const locationRationale = explainPlantLocationMatch({
    context: locationContext,
    crop,
    match: locationMatch,
    today,
  });
  const timing = getPlantTimingGuidance({
    context: locationContext,
    crop,
    today,
  });
  const harvest = plant?.harvest;
  const lifecycle = plant?.lifecycle ?? crop.lifecycle;

  return {
    description: compactDescription(
      plant?.description || crop.notes || crop.perennialSuitability,
    ),
    difficultyLabel: formatLabel(plant?.difficulty ?? 'moderate'),
    difficultyShortLabel: formatShortDifficulty(
      plant?.difficulty ?? 'moderate',
    ),
    harvestLabel: harvest
      ? formatHarvestCycle(harvest.cycle, harvest.daysToFirstHarvest)
      : formatDaysToMaturity(crop.daysToMaturity),
    lifecycleLabel: formatLabel(lifecycle),
    locationMatchBasis: locationRationale.basis,
    locationMatchBand: locationMatch.band,
    locationMatchDetails: locationRationale.details,
    locationMatchLabel: locationMatch.label,
    locationMatchReasons: locationMatch.reasons,
    locationMatchShortLabel: formatShortLocationMatch(locationMatch.band),
    locationMatchSummary: locationRationale.headline,
    locationMatchWarnings: locationMatch.warnings,
    modeLabel: modeLabels[mode],
    spacingLabel: formatSpacing(
      crop.spacingInches ?? plant?.defaultSpacingInches,
    ),
    supportLabel: plant?.defaultSupport.label ?? formatSupportNeed(crop),
    supportShortLabel: plant?.defaultSupport
      ? formatShortSupportNeed(
          plant.defaultSupport.kind,
          plant.defaultSupport.type,
        )
      : formatShortSupportNeed(
          getCropSupportProfile(crop).scope === 'structure'
            ? 'trellis'
            : getCropSupportProfile(crop).scope === 'plant'
              ? 'perPlant'
              : 'none',
          getCropSupportProfile(crop).plantSupportType ?? 'none',
        ),
    timingDetail: timing.detail,
    timingLabel: timing.label,
    sunShortLabel: formatShortSun(crop.sunRequirement),
    sunLabel: formatSun(crop.sunRequirement),
    waterShortLabel: formatLabel(crop.waterNeeds),
    waterLabel: formatWater(crop.waterNeeds),
  };
}

function compactDescription(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return 'Home-garden planning profile with spacing and timing defaults.';
  }

  const [firstSentence] = normalized.split(/(?<=[.!?])\s+/);
  const candidate = firstSentence || normalized;

  return candidate.length > 112
    ? `${candidate.slice(0, 109).trim()}...`
    : candidate;
}

function formatHarvestCycle(cycle: string, daysToFirstHarvest: number | null) {
  const cycleLabels: Record<string, string> = {
    continuous: 'Continuous harvest',
    cutAndComeAgain: 'Cut-and-come-again',
    single: 'Single harvest',
    successive: 'Succession crop',
  };
  const label = cycleLabels[cycle] ?? formatLabel(cycle);

  return daysToFirstHarvest ? `${label} - ${daysToFirstHarvest}d` : label;
}

function formatDaysToMaturity(daysToMaturity: number | null) {
  return daysToMaturity ? `${daysToMaturity}d to harvest` : 'Harvest varies';
}

function formatSpacing(spacingInches: number | null | undefined) {
  return spacingInches ? `${spacingInches} in` : 'Spacing varies';
}

function formatSupportNeed(crop: CropProfile) {
  const supportProfile = getCropSupportProfile(crop);

  if (supportProfile.required || supportProfile.recommended) {
    return supportProfile.label;
  }

  return 'No default support';
}

function formatShortSupportNeed(
  kind: 'none' | 'perPlant' | 'trellis',
  type: string,
) {
  if (kind === 'none' || type === 'none') {
    return 'No support';
  }

  if (kind === 'trellis') {
    return 'Trellis';
  }

  if (type === 'cage') {
    return 'Cage';
  }

  if (type === 'stakeAndWeave') {
    return 'Stake/weave';
  }

  return formatLabel(type);
}

function formatShortDifficulty(value: string) {
  return value === 'demanding' ? 'Hard' : formatLabel(value);
}

function formatShortLocationMatch(band: string) {
  const labels: Record<string, string> = {
    good: 'Good',
    poor: 'Poor',
    strong: 'Strong',
    watch: 'Watch',
  };

  return labels[band] ?? formatLabel(band);
}

function formatShortSun(value: SunExposure) {
  const labels: Record<SunExposure, string> = {
    fullShade: 'Shade',
    fullSun: 'Full',
    partShade: 'Part shade',
    partSun: 'Part',
  };

  return labels[value];
}
