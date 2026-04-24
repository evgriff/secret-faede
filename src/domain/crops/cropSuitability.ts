import type {
  ClimateProfile,
  CropProfile,
  Garden,
  GardenLocation,
  PlantingMode,
  SunExposure,
  StructureType,
} from '../gardens/GardenRepository';
import {
  createPlantLocationContext,
  explainPlantLocationMatch,
  getPlantTimingGuidance,
  scorePlantLocationMatch,
} from './plantLocationMatch';
import type { PlantLocationMatch } from './plantCatalogTypes';

export type CropSuitabilityLevel = 'fit' | 'risk' | 'watch';

export interface CropSuitabilityInput {
  climateProfile: ClimateProfile;
  crop: CropProfile;
  location?: GardenLocation | null;
  mode: PlantingMode;
  plantCount: number | null;
  plotType: StructureType | 'containers' | 'mixed' | 'open';
  requestedAreaSqFt: number | null;
  sunExposureAtPlacement: SunExposure | null;
  today?: Date;
}

export interface CropSuitabilityScore {
  level: CropSuitabilityLevel;
  locationContext: {
    regionName: string;
    source: 'annArborDefault' | 'gardenProfile';
  };
  locationHeadline: string;
  locationMatch: PlantLocationMatch;
  reasons: string[];
  score: number;
  sunCompatible: boolean | null;
  timing: ReturnType<typeof getPlantTimingGuidance>;
  warnings: string[];
}

export function scoreCropSuitability({
  climateProfile,
  crop,
  location,
  mode,
  plantCount,
  plotType,
  requestedAreaSqFt,
  sunExposureAtPlacement,
  today = new Date(),
}: CropSuitabilityInput): CropSuitabilityScore {
  const context = createPlantLocationContext({
    climateProfile,
    ...(location !== undefined ? { location } : {}),
  });
  const locationMatch = scorePlantLocationMatch({
    context,
    crop,
    sunExposureAtPlacement,
    today,
  });
  const locationRationale = explainPlantLocationMatch({
    context,
    crop,
    match: locationMatch,
    today,
  });
  const timing = getPlantTimingGuidance({
    context,
    crop,
    today,
  });
  let score = locationMatch.score;
  const reasons: string[] = [...locationMatch.reasons];
  const warnings: string[] = [...locationMatch.warnings];
  const sunCompatible = sunExposureAtPlacement
    ? sunExposureAtPlacement === crop.sunRequirement ||
      locationMatch.reasons.some((reason) => reason.startsWith('Sun matches'))
    : null;

  if (plotType === 'container' || plotType === 'containers') {
    if (crop.growthForm === 'vining' || (crop.matureSpreadInches ?? 0) > 48) {
      score -= 16;
      warnings.push(
        'Large spreading crops need a very large container or bed.',
      );
    } else {
      score += 8;
      reasons.push('Container scale is reasonable for this crop.');
    }
  }

  if (mode === 'trellisLine' || crop.trellisRecommended) {
    score += 5;
    reasons.push('Plan accounts for support or trellising.');
  }

  const spacingFit = getSpacingFit(crop, plantCount, requestedAreaSqFt);

  if (spacingFit === 'tight') {
    score -= 14;
    warnings.push('Spacing is tight for the requested count.');
  } else if (spacingFit === 'comfortable') {
    score += 8;
    reasons.push('Spacing has enough room for mature spread.');
  }

  if (crop.profileCompleteness === 'complete') {
    score += 5;
    reasons.push(
      'Crop profile has complete spacing, water, sun, and timing data.',
    );
  } else {
    warnings.push('Crop profile is usable but still marked for review.');
  }

  const boundedScore = Math.max(0, Math.min(100, score));

  return {
    level: boundedScore >= 76 ? 'fit' : boundedScore >= 52 ? 'watch' : 'risk',
    locationContext: {
      regionName: context.regionName,
      source: context.source,
    },
    locationHeadline: locationRationale.headline,
    locationMatch,
    reasons: reasons.slice(0, 4),
    score: boundedScore,
    sunCompatible,
    timing,
    warnings: warnings.slice(0, 4),
  };
}

export function inferPlotType(
  garden: Garden,
): CropSuitabilityInput['plotType'] {
  if (garden.structures.some((structure) => structure.type === 'container')) {
    return 'containers';
  }

  if (garden.structures.some((structure) => structure.type === 'raisedBed')) {
    return 'raisedBed';
  }

  if (garden.structures.some((structure) => structure.type === 'inGroundBed')) {
    return 'inGroundBed';
  }

  return garden.structures.length > 1 ? 'mixed' : 'open';
}

function getSpacingFit(
  crop: CropProfile,
  plantCount: number | null,
  requestedAreaSqFt: number | null,
) {
  if (!plantCount || !requestedAreaSqFt || !crop.spacingInches) {
    return 'unknown';
  }

  const spacingFt = crop.spacingInches / 12;
  const requiredArea = Math.max(spacingFt * spacingFt * plantCount, 0.25);
  const ratio = requestedAreaSqFt / requiredArea;

  if (ratio < 0.85) {
    return 'tight';
  }

  return ratio >= 1.2 ? 'comfortable' : 'unknown';
}
