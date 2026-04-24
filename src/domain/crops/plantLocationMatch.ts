import type {
  ClimateProfile,
  CropProfile,
  GardenLocation,
  SunExposure,
} from '../gardens/GardenRepository';
import {
  annArborClimateProfile,
  annArborLocation,
} from '../gardens/GardenRepository';
import { toPlantCatalogEntry } from './plantCatalog';
import {
  getPlantLocationMatchBand,
  plantLocationMatchLabels,
  TENDER_PERENNIAL_MAX_SCORE,
} from './plantLocationMatchBands';
import {
  dateToMonthDayNumber,
  daysUntilMonthDay,
  formatMonthDay,
  formatSun,
  getFirstFallFrostWindow,
  getLastSpringFrostWindow,
  monthDayToNumber,
  sunRequirementMet,
} from './plantLocationMatchCalendar';
import type {
  PlantCatalogEntry,
  PlantLocationContext,
  PlantLocationMatch,
  PlantLocationMatchConfidence,
  PlantLocationMatchRationale,
  PlantTimingGuidance,
} from './plantCatalogTypes';

export const annArborPlantLocationContext = createPlantLocationContext();

export {
  getPlantLocationMatchBand,
  plantLocationMatchLabels,
} from './plantLocationMatchBands';

export function createPlantLocationContext({
  climateProfile,
  location,
}: {
  climateProfile?: ClimateProfile | null;
  location?: GardenLocation | null;
} = {}): PlantLocationContext {
  const profile = climateProfile ?? annArborClimateProfile;
  const gardenLocation = location ?? annArborLocation;
  const isAnnArborDefault =
    !climateProfile ||
    (profile.source === 'demoDefault' &&
      profile.hardinessZone === annArborClimateProfile.hardinessZone);

  return {
    averageFirstFrost: profile.averageFirstFrost,
    averageLastFrost: profile.averageLastFrost,
    confidence: profile.source === 'user' ? 'medium' : 'high',
    firstFallFrostWindow: getFirstFallFrostWindow(profile.hardinessZone),
    hardinessZone: profile.hardinessZone,
    lastSpringFrostWindow: getLastSpringFrostWindow(profile.hardinessZone),
    location: gardenLocation,
    regionName: isAnnArborDefault
      ? 'Detroit / southeast Michigan'
      : profile.locationName,
    seasonWindows: {
      coolFall: { end: profile.averageFirstFrost, start: '07-01' },
      coolSpring: { end: profile.averageLastFrost, start: '03-15' },
      warmSeason: {
        end: profile.averageFirstFrost,
        start: profile.averageLastFrost,
      },
    },
    source: isAnnArborDefault ? 'annArborDefault' : 'gardenProfile',
  };
}

export function scorePlantLocationMatch({
  context = annArborPlantLocationContext,
  crop,
  sunExposureAtPlacement,
  today = new Date(),
}: {
  context?: PlantLocationContext;
  crop: CropProfile;
  sunExposureAtPlacement?: SunExposure | null;
  today?: Date;
}): PlantLocationMatch {
  const plant = toPlantCatalogEntry(crop);
  const tenderPerennial = isTenderPerennial(plant);
  let score = 70;
  const reasons: string[] = [];
  const warnings: string[] = [];
  let confidence = context.confidence;

  if (sunExposureAtPlacement) {
    if (sunRequirementMet(plant.sunPreference, sunExposureAtPlacement)) {
      score += 10;
      reasons.push(`Sun matches ${formatSun(plant.sunPreference)} preference.`);
    } else {
      score -= 18;
      warnings.push(
        `Needs ${formatSun(plant.sunPreference)}; selected sun estimate is ${formatSun(
          sunExposureAtPlacement,
        )}.`,
      );
    }
  } else {
    score -= 4;
    confidence = reduceConfidence(confidence);
    warnings.push('Sun has not been estimated for the placement yet.');
  }

  if (tenderPerennial) {
    score -= 22;
    warnings.push(
      `Perennial not winter-hardy for ${context.regionName} zone ${context.hardinessZone} without winter protection.`,
    );
  }

  score += scoreSeasonTiming(plant, context, today, reasons, warnings);
  score += scoreHarvestWindow(plant, context, today, reasons, warnings);

  if (plant.difficulty === 'easy') {
    score += 5;
    reasons.push('Easy crop for a home garden plan.');
  } else if (plant.difficulty === 'demanding') {
    score -= 6;
    warnings.push('Needs tighter care, spacing, or timing discipline.');
  }

  if (crop.profileCompleteness !== 'complete') {
    confidence = reduceConfidence(confidence);
    warnings.push(
      'Catalog data is directional; confirm local variety details.',
    );
  }

  if (tenderPerennial) {
    score = Math.min(score, TENDER_PERENNIAL_MAX_SCORE);
  }

  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const band = getPlantLocationMatchBand(boundedScore);

  return {
    band,
    confidence,
    label: plantLocationMatchLabels[band],
    reasons: reasons.slice(0, 4),
    score: boundedScore,
    warnings: warnings.slice(0, 4),
  };
}

export function explainPlantLocationMatch({
  context = annArborPlantLocationContext,
  crop,
  match,
  today = new Date(),
}: {
  context?: PlantLocationContext;
  crop: CropProfile;
  match?: PlantLocationMatch;
  today?: Date;
}): PlantLocationMatchRationale {
  const plant = toPlantCatalogEntry(crop);
  const evaluatedMatch =
    match ??
    scorePlantLocationMatch({
      context,
      crop,
      today,
    });
  const region = getShortRegionName(context);
  const season = getSeasonPhrase(plant);
  const warningText = evaluatedMatch.warnings.join(' ');
  const headline = getLocationMatchHeadline({
    context,
    match: evaluatedMatch,
    plant,
    region,
    season,
    warningText,
  });
  const details = [...evaluatedMatch.warnings, ...evaluatedMatch.reasons].slice(
    0,
    3,
  );

  return {
    basis: `${context.regionName}, zone ${context.hardinessZone}; average last frost ${formatMonthDay(
      context.averageLastFrost,
    )}, average first frost ${formatMonthDay(context.averageFirstFrost)}.`,
    details,
    headline,
  };
}

export function getPlantTimingGuidance({
  context = annArborPlantLocationContext,
  crop,
  today = new Date(),
}: {
  context?: PlantLocationContext;
  crop: CropProfile;
  today?: Date;
}): PlantTimingGuidance {
  return getSeasonTimingAssessment(toPlantCatalogEntry(crop), context, today);
}

function getLocationMatchHeadline({
  context,
  match,
  plant,
  region,
  season,
  warningText,
}: {
  context: PlantLocationContext;
  match: PlantLocationMatch;
  plant: PlantCatalogEntry;
  region: string;
  season: string;
  warningText: string;
}) {
  if (isTenderPerennial(plant)) {
    return context.source === 'annArborDefault'
      ? `Perennial not winter-hardy for the ${context.hardinessZone} default zone`
      : `Perennial not winter-hardy for zone ${context.hardinessZone}`;
  }

  if (match.band === 'poor') {
    if (/maturity|frost|harvest/i.test(warningText)) {
      return 'Poor fit without season extension';
    }

    if (/sun estimate|needs full|needs part/i.test(warningText)) {
      return `Poor fit until placement provides ${formatSun(
        plant.sunPreference,
      )}`;
    }

    return `Poor fit for ${region} ${season}`;
  }

  if (match.band === 'watch') {
    if (/maturity|harvest window|frost/i.test(warningText)) {
      return 'Possible, but late for direct sow in this climate window';
    }

    if (/wait until|Warm-season/i.test(warningText)) {
      return `Possible, but wait for the ${season} window`;
    }

    if (/Sun has not been estimated/i.test(warningText)) {
      return `Possible; choose a ${formatSun(
        plant.sunPreference,
      )} location to confirm`;
    }

    return `Possible for ${region}; check timing`;
  }

  return `${match.band === 'strong' ? 'Strong' : 'Good'} fit for ${region} ${season}`;
}

function scoreSeasonTiming(
  plant: PlantCatalogEntry,
  context: PlantLocationContext,
  today: Date,
  reasons: string[],
  warnings: string[],
) {
  const assessment = getSeasonTimingAssessment(plant, context, today);

  if (assessment.kind === 'reason') {
    reasons.push(assessment.detail);
  } else {
    warnings.push(assessment.detail);
  }

  return assessment.scoreDelta;
}

function scoreHarvestWindow(
  plant: PlantCatalogEntry,
  context: PlantLocationContext,
  today: Date,
  reasons: string[],
  warnings: string[],
) {
  if (!plant.timing.daysToMaturity || plant.lifecycle === 'perennial') {
    return 0;
  }

  const daysUntilFrost = daysUntilMonthDay(today, context.averageFirstFrost);

  if (daysUntilFrost < plant.timing.daysToMaturity) {
    warnings.push('Days to maturity may run past the first frost window.');
    return -20;
  }

  if (daysUntilFrost < plant.timing.daysToMaturity + 21) {
    warnings.push('Harvest window is tight before first frost.');
    return -8;
  }

  reasons.push('Days to maturity fits before the first frost window.');
  return 6;
}

function reduceConfidence(
  confidence: PlantLocationMatchConfidence,
): PlantLocationMatchConfidence {
  return confidence === 'high' ? 'medium' : 'low';
}

function isTenderPerennial(plant: PlantCatalogEntry) {
  if (plant.lifecycle !== 'perennial') {
    return false;
  }

  const text =
    `${plant.climate.hardiness} ${plant.climate.perennialSuitability}`.toLowerCase();

  return /tender|protected|indoors|winter protection|annual in cold/.test(text);
}

function getShortRegionName(context: PlantLocationContext) {
  if (context.source === 'annArborDefault') {
    return 'Detroit';
  }

  return context.location.locationName || context.regionName;
}

function getSeasonPhrase(plant: PlantCatalogEntry) {
  switch (plant.timing.preferredSeason) {
    case 'coolSeason':
      return 'spring/fall';
    case 'perennial':
      return 'spring/fall planting';
    case 'warmSeason':
      return 'spring/summer';
    case 'flexible':
      return 'spring/summer';
  }
}

function getSeasonTimingAssessment(
  plant: PlantCatalogEntry,
  context: PlantLocationContext,
  today: Date,
): PlantTimingGuidance & {
  kind: 'reason' | 'warning';
  scoreDelta: number;
} {
  const current = dateToMonthDayNumber(today);

  if (plant.timing.preferredSeason === 'perennial') {
    const tenderPerennial = /tender|protected|indoors/i.test(
      plant.climate.hardiness,
    );
    const spring = context.seasonWindows.coolSpring;
    const fall = context.seasonWindows.coolFall;
    const inSpring =
      current >= monthDayToNumber(spring.start) &&
      current <= monthDayToNumber(spring.end);
    const inFall =
      current >= monthDayToNumber(fall.start) &&
      current <= monthDayToNumber(fall.end);

    if (tenderPerennial) {
      return {
        detail: `${plant.commonName} is perennial only with protection in ${context.hardinessZone}.`,
        kind: 'warning',
        label: 'Wait until after frost',
        scoreDelta: -12,
        status: 'waitUntilAfterFrost',
      };
    }

    if (inSpring || inFall) {
      return {
        detail: `Perennial profile is plausible for zone ${context.hardinessZone}.`,
        kind: 'reason',
        label: 'Plant now',
        scoreDelta: 8,
        status: 'plantNow',
      };
    }

    return {
      detail:
        'Perennials settle in best during the spring or fall planting windows.',
      kind: 'warning',
      label: 'Good for fall',
      scoreDelta: -4,
      status: 'goodForFall',
    };
  }

  if (plant.timing.preferredSeason === 'warmSeason') {
    const warmStart = monthDayToNumber(context.seasonWindows.warmSeason.start);

    if (current < warmStart) {
      if (
        plant.timing.transplantCompatible &&
        !plant.timing.directSowCompatible
      ) {
        return {
          detail: `Warm-season crop; start indoors now or wait until around ${formatMonthDay(
            context.averageLastFrost,
          )} to plant outside.`,
          kind: 'warning',
          label: 'Start indoors now',
          scoreDelta: -18,
          status: 'startIndoorsNow',
        };
      }

      return {
        detail: `Warm-season crop; wait until around ${formatMonthDay(
          context.averageLastFrost,
        )} or use protection.`,
        kind: 'warning',
        label: 'Wait until after frost',
        scoreDelta: -18,
        status: 'waitUntilAfterFrost',
      };
    }

    return {
      detail: 'Warm-season timing is inside the local frost window.',
      kind: 'reason',
      label: 'Plant now',
      scoreDelta: 8,
      status: 'plantNow',
    };
  }

  if (plant.timing.preferredSeason === 'coolSeason') {
    const spring = context.seasonWindows.coolSpring;
    const fall = context.seasonWindows.coolFall;
    const inSpring =
      current >= monthDayToNumber(spring.start) &&
      current <= monthDayToNumber(spring.end);
    const inFall =
      current >= monthDayToNumber(fall.start) &&
      current <= monthDayToNumber(fall.end);

    if (inSpring || inFall) {
      return {
        detail: 'Cool-season timing matches a local planting window.',
        kind: 'reason',
        label: 'Plant now',
        scoreDelta: 8,
        status: 'plantNow',
      };
    }

    return {
      detail: 'Cool-season crop; use spring or fall windows for best fit.',
      kind: 'warning',
      label: 'Good for fall',
      scoreDelta: -10,
      status: 'goodForFall',
    };
  }

  return {
    detail: 'Timing is flexible with the saved frost dates.',
    kind: 'reason',
    label: 'Plant now',
    scoreDelta: 2,
    status: 'plantNow',
  };
}
