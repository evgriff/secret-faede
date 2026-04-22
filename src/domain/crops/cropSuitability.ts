import type {
  ClimateProfile,
  CropProfile,
  Garden,
  PlantingMode,
  SunExposure,
  StructureType,
} from '../gardens/GardenRepository';

export type CropSuitabilityLevel = 'fit' | 'risk' | 'watch';

export interface CropSuitabilityInput {
  climateProfile: ClimateProfile;
  crop: CropProfile;
  mode: PlantingMode;
  plantCount: number | null;
  plotType: StructureType | 'containers' | 'mixed' | 'open';
  requestedAreaSqFt: number | null;
  sunExposureAtPlacement: SunExposure | null;
  today?: Date;
}

export interface CropSuitabilityScore {
  level: CropSuitabilityLevel;
  reasons: string[];
  score: number;
  warnings: string[];
}

export function scoreCropSuitability({
  climateProfile,
  crop,
  mode,
  plantCount,
  plotType,
  requestedAreaSqFt,
  sunExposureAtPlacement,
  today = new Date(),
}: CropSuitabilityInput): CropSuitabilityScore {
  let score = 70;
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (sunExposureAtPlacement) {
    if (sunRequirementMet(crop.sunRequirement, sunExposureAtPlacement)) {
      score += 12;
      reasons.push(`Sun matches ${formatSun(crop.sunRequirement)} preference.`);
    } else {
      score -= 20;
      warnings.push(
        `Needs ${formatSun(crop.sunRequirement)}; placement reads ${formatSun(
          sunExposureAtPlacement,
        )}.`,
      );
    }
  } else {
    score -= 4;
    warnings.push('Sun fit is unknown until a placement area is selected.');
  }

  const frostState = getFrostWindowState(climateProfile, today);
  const warmSeason = crop.frostSensitive || /warm-season/i.test(crop.hardiness);

  if (warmSeason && frostState !== 'inside') {
    score -= 18;
    warnings.push(
      `Warm-season crop; editable frost window is ${climateProfile.averageLastFrost} to ${climateProfile.averageFirstFrost}.`,
    );
  } else if (!warmSeason && frostState === 'inside') {
    score += 4;
    reasons.push('Fits the current frost window for this climate profile.');
  } else {
    reasons.push('Climate timing is workable with the saved frost dates.');
  }

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

  if (crop.profileConfidence === 'complete') {
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
    reasons: reasons.slice(0, 4),
    score: boundedScore,
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

function getFrostWindowState(profile: ClimateProfile, today: Date) {
  const current = monthDayToNumber(
    `${String(today.getMonth() + 1).padStart(2, '0')}-${String(
      today.getDate(),
    ).padStart(2, '0')}`,
  );
  const lastFrost = monthDayToNumber(profile.averageLastFrost);
  const firstFrost = monthDayToNumber(profile.averageFirstFrost);

  return current >= lastFrost && current <= firstFrost ? 'inside' : 'outside';
}

function monthDayToNumber(value: string) {
  const [monthText, dayText] = value.split('-');
  const month = Number(monthText);
  const day = Number(dayText);

  if (!Number.isFinite(month) || !Number.isFinite(day)) {
    return 0;
  }

  return month * 100 + day;
}

function sunRequirementMet(required: SunExposure, actual: SunExposure) {
  const rank: Record<SunExposure, number> = {
    fullShade: 1,
    partShade: 2,
    partSun: 3,
    fullSun: 4,
  };

  return rank[actual] >= rank[required] - 1;
}

function formatSun(value: SunExposure) {
  return value.replace(/([A-Z])/g, ' $1').toLowerCase();
}
