import { getCropById } from '../../domain/crops/cropCatalog';
import {
  inferPlotType,
  scoreCropSuitability,
} from '../../domain/crops/cropSuitability';
import type {
  CropProfile,
  Garden,
  PlantingMode,
  SeasonCropSelection,
  SunExposure,
} from '../../domain/gardens/GardenRepository';
import { cropSunRequirementMet } from '../garden/sunShadeEngine';
import {
  formatSeasonCropFitReasonGroup,
  formatSeasonCropPlanningState,
} from './seasonCropFitDisplay';

export type SeasonCropFitLevel =
  | 'caution'
  | 'greatFit'
  | 'unlikelyFit'
  | 'workable';

export type SeasonCropFitReasonGroup =
  | 'bedContainer'
  | 'climateSeason'
  | 'space'
  | 'sun'
  | 'support';

export type SeasonCropFitReasonSeverity = 'blocker' | 'notice' | 'watch';

export interface SeasonCropFitReason {
  group: SeasonCropFitReasonGroup;
  label: string;
  severity: SeasonCropFitReasonSeverity;
}

export interface SeasonCropFitSignal {
  groupedReasons: SeasonCropFitReason[];
  label: string;
  level: SeasonCropFitLevel;
  reasons: string[];
  summary: string;
  uncertainty: string | null;
}

export interface SeasonCropLayoutRequest {
  crop: CropProfile;
  cropId: string;
  estimatedAreaSqFt: number;
  fit: SeasonCropFitSignal;
  plantingForm: PlantingMode;
  notes: string;
  supportAllowed: boolean;
  quantity: number;
  varietyName: string;
}

export function buildSeasonCropLayoutRequests(
  garden: Garden,
  sunExposureAtPlacement: SunExposure | null = null,
): SeasonCropLayoutRequest[] {
  const totalEstimatedAreaSqFt = estimateTotalWantedAreaSqFt(garden);

  return garden.seasonPlan.wantedCrops.flatMap(
    (selection): SeasonCropLayoutRequest[] => {
      const crop = getCropById(selection.cropId);

      if (!crop) {
        return [];
      }

      return [
        {
          crop,
          cropId: selection.cropId,
          estimatedAreaSqFt: estimateSelectionAreaSqFt(selection, crop),
          fit: getSeasonCropFitSignal({
            crop,
            garden,
            selection,
            sunExposureAtPlacement,
            totalEstimatedAreaSqFt,
          }),
          plantingForm: selection.plantingForm,
          notes: selection.notes,
          supportAllowed: selection.supportAllowed,
          quantity: selection.quantity,
          varietyName: selection.varietyName,
        },
      ];
    },
  );
}

export function getSeasonCropFitSignal({
  crop,
  garden,
  selection,
  sunExposureAtPlacement = null,
  totalEstimatedAreaSqFt = estimateTotalWantedAreaSqFt(garden),
}: {
  crop: CropProfile;
  garden: Garden;
  selection: SeasonCropSelection;
  sunExposureAtPlacement?: SunExposure | null;
  totalEstimatedAreaSqFt?: number;
}): SeasonCropFitSignal {
  const estimatedAreaSqFt = estimateSelectionAreaSqFt(selection, crop);
  const plotAreaSqFt = garden.plot.widthFt * garden.plot.depthFt;
  const groupedReasons: SeasonCropFitReason[] = [];
  const suitability = scoreCropSuitability({
    climateProfile: garden.climateProfile,
    crop,
    mode: selection.plantingForm,
    plantCount: selection.quantity,
    plotType: inferPlotType(garden),
    requestedAreaSqFt: estimatedAreaSqFt,
    sunExposureAtPlacement,
  });

  if (
    sunExposureAtPlacement &&
    !cropSunRequirementMet(crop.sunRequirement, sunExposureAtPlacement)
  ) {
    groupedReasons.push({
      group: 'sun',
      label: `Needs ${formatSun(crop.sunRequirement)}; this area reads ${formatSun(
        sunExposureAtPlacement,
      )}`,
      severity: 'watch',
    });
  }

  if (estimatedAreaSqFt > plotAreaSqFt * 0.45) {
    groupedReasons.push({
      group: 'space',
      label: 'Requested quantity takes a large share of the plot',
      severity: 'blocker',
    });
  } else if (
    estimatedAreaSqFt > plotAreaSqFt * 0.28 ||
    totalEstimatedAreaSqFt > plotAreaSqFt * 0.8
  ) {
    groupedReasons.push({
      group: 'space',
      label: 'May crowd the current crop list',
      severity: 'watch',
    });
  } else if (totalEstimatedAreaSqFt > plotAreaSqFt * 0.65) {
    groupedReasons.push({
      group: 'space',
      label: 'Watch total space as the list fills out',
      severity: 'notice',
    });
  }

  if (
    suitability.warnings.some((warning) =>
      /frost|warm-season|climate/i.test(warning),
    )
  ) {
    groupedReasons.push({
      group: 'climateSeason',
      label: 'Season timing may need protection or adjusted dates',
      severity: 'watch',
    });
  }

  if (
    (crop.trellisRequired || crop.trellisRecommended) &&
    !selection.supportAllowed
  ) {
    groupedReasons.push({
      group: 'support',
      label: crop.trellisRequired
        ? 'Needs support before layout'
        : 'Support would make placement easier',
      severity: crop.trellisRequired ? 'blocker' : 'watch',
    });
  }

  if (!crop.supportedPlantingModes.includes(selection.plantingForm)) {
    groupedReasons.push({
      group: 'bedContainer',
      label: 'Selected planting mode is not supported',
      severity: 'blocker',
    });
  }

  if (suitability.warnings.some((warning) => /container|bed/i.test(warning))) {
    groupedReasons.push({
      group: 'bedContainer',
      label: 'Bed or container scale needs review',
      severity: 'watch',
    });
  }

  const dedupedReasons = dedupeGroupedReasons(groupedReasons);
  const uncertainty = getFitUncertainty(crop);
  const level = getFitLevel({
    groupedReasons: dedupedReasons,
    suitabilityLevel: suitability.level,
    uncertainty,
  });

  return {
    groupedReasons: dedupedReasons,
    label: formatSeasonCropPlanningState(level),
    level,
    reasons: dedupedReasons.map(formatCompactReason).slice(0, 4),
    summary: formatFitSummary(level, dedupedReasons),
    uncertainty,
  };
}

export function estimateSelectionAreaSqFt(
  selection: SeasonCropSelection,
  crop: CropProfile,
) {
  const spacingFt = Math.max(
    (crop.spacingInches ?? crop.matureSpreadInches ?? 18) / 12,
    0.75,
  );
  const count = Math.max(selection.quantity, 1);

  if (
    selection.plantingForm === 'row' ||
    selection.plantingForm === 'trellisLine'
  ) {
    const rowWidthFt = Math.max(
      (crop.rowSpacingInches ?? crop.spacingInches ?? 18) / 12,
      1,
    );

    return Number((spacingFt * count * rowWidthFt).toFixed(1));
  }

  return Number((spacingFt * spacingFt * count).toFixed(1));
}

function estimateTotalWantedAreaSqFt(garden: Garden) {
  return garden.seasonPlan.wantedCrops.reduce((total, selection) => {
    const crop = getCropById(selection.cropId);

    return crop ? total + estimateSelectionAreaSqFt(selection, crop) : total;
  }, 0);
}

function getFitLevel({
  groupedReasons,
  suitabilityLevel,
  uncertainty,
}: {
  groupedReasons: SeasonCropFitReason[];
  suitabilityLevel: 'fit' | 'risk' | 'watch';
  uncertainty: string | null;
}) {
  if (groupedReasons.some((reason) => reason.severity === 'blocker')) {
    return 'unlikelyFit';
  }

  if (
    groupedReasons.some((reason) => reason.severity === 'watch') ||
    suitabilityLevel === 'risk'
  ) {
    return 'caution';
  }

  if (
    groupedReasons.some((reason) => reason.severity === 'notice') ||
    suitabilityLevel === 'watch' ||
    uncertainty
  ) {
    return 'workable';
  }

  return 'greatFit';
}

function dedupeGroupedReasons(reasons: SeasonCropFitReason[]) {
  const seen = new Set<SeasonCropFitReasonGroup>();

  return reasons.filter((reason) => {
    if (seen.has(reason.group)) {
      return false;
    }

    seen.add(reason.group);
    return true;
  });
}

function formatCompactReason(reason: SeasonCropFitReason) {
  return `${formatSeasonCropFitReasonGroup(reason.group)}: ${reason.label}`;
}

function formatFitSummary(
  level: SeasonCropFitLevel,
  reasons: SeasonCropFitReason[],
) {
  if (level === 'greatFit') {
    return 'Strong match for this plot and season.';
  }

  const groups = reasons
    .filter((reason) => reason.severity !== 'notice')
    .map((reason) =>
      formatSeasonCropFitReasonGroup(reason.group).toLowerCase(),
    );
  const groupText = groups.length > 0 ? groups.join(', ') : 'placement details';

  if (level === 'workable') {
    return 'Likely workable; confirm details before layout.';
  }

  if (level === 'caution') {
    return `Can still work; review ${groupText}.`;
  }

  return `Avoid auto-placing until ${groupText} is resolved.`;
}

function getFitUncertainty(crop: CropProfile) {
  if (crop.profileCompleteness === 'needsReview') {
    return 'Catalog data is limited; confirm spacing and timing before relying on placement guidance.';
  }

  if (crop.profileCompleteness === 'partial' || crop.completenessScore < 0.9) {
    return 'Catalog data is partial, so this guidance is directional.';
  }

  return null;
}

function formatSun(value: SunExposure) {
  return value.replace(/([A-Z])/g, ' $1').toLowerCase();
}
