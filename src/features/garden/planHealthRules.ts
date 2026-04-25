import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  CropProfile,
  Garden,
  LocalDateString,
  Structure,
} from '../../domain/gardens/GardenRepository';
import type { GardenSuggestionDecision } from '../../domain/gardens/gardenWorkspace';
import {
  getPlanWarningDecisionCategory,
  getPlanWarningDecisionCategoryMeta,
  getPlantingFootprint,
  getStructureFootprint,
  rectsOverlap,
  type PlanWarningDecisionCategory,
  type PlanWarning,
} from './gardenPlanning';
import { buildRotationGuidance } from './gardenRotation';
import {
  estimateSupportLengthFt,
  getCropSupportNeed,
  getPathRequiredWidthFt,
  getSupportLabel,
  getWalkablePathWidthFt,
  hasPlantLevelSupport,
  hasNearbySupport,
  hasWalkablePathAccess,
  isBedLikeStructure,
  isMeaningfulAccessPath,
  isPathStructure,
} from './gardenStructureRules';

export type PlanHealthIssueType =
  | 'bedOverCapacity'
  | 'cropSupportMissing'
  | 'cropFamilyRotationCaution'
  | 'irrigationAccessConcern'
  | 'mulchReminder'
  | 'pathTooNarrow'
  | 'rowCoverSuggested'
  | 'tomatoSupportMissing'
  | 'trellisMissing'
  | 'warning';

export type PlanHealthSeverity = 'caution' | 'mustFix' | 'recommended';

export type PlanMaterialAddOnType =
  | 'cage'
  | 'coldFrame'
  | 'mulch'
  | 'rowCover'
  | 'stake'
  | 'trellis';

export interface PlanMaterialAddOn {
  id: string;
  itemIds: string[];
  label: string;
  quantity: number;
  reason: string;
  type: PlanMaterialAddOnType;
  unit: 'count' | 'cu ft' | 'ft' | 'sq ft';
}

export interface PlanHealthIssue {
  decisionCategory: PlanWarningDecisionCategory;
  dismissible: boolean;
  dismissed: boolean;
  id: string;
  itemIds: string[];
  materialAddOns: PlanMaterialAddOn[];
  message: string;
  sourceWarningId: string | null;
  restoreWarningId: string | null;
  severity: PlanHealthSeverity;
  title: string;
  type: PlanHealthIssueType;
}

export interface PlanHealthDecisionGroup {
  category: PlanWarningDecisionCategory;
  cautionCount: number;
  issues: PlanHealthIssue[];
  label: string;
  mustFixCount: number;
  prompt: string;
  recommendedCount: number;
  totalCount: number;
}

export interface PlanHealthReport {
  decisionGroups: PlanHealthDecisionGroup[];
  dismissedCautions: PlanHealthIssue[];
  materialAddOns: PlanMaterialAddOn[];
  mustFixIssues: PlanHealthIssue[];
  recommendedImprovements: PlanHealthIssue[];
}

export function buildPlanHealthReport({
  dismissedWarningIds = [],
  garden,
  now = new Date(),
  suggestionDecisions = [],
  warnings,
}: {
  dismissedWarningIds?: string[];
  garden: Garden;
  now?: Date;
  suggestionDecisions?: GardenSuggestionDecision[];
  warnings: PlanWarning[];
}): PlanHealthReport {
  const dismissedWarnings = new Set(dismissedWarningIds);
  const issues = [
    ...buildWarningIssues(warnings, dismissedWarnings),
    ...buildSupportIssues(garden),
    ...buildRotationIssues(garden, now),
    ...buildBedCapacityIssues(garden),
    ...buildMulchIssues(garden),
    ...buildSeasonProtectionIssues(garden, now),
  ];
  const dismissedDecisionIssues = suggestionDecisions.flatMap(
    toDismissedDecisionIssue,
  );
  const uniqueIssues = uniqueById([...issues, ...dismissedDecisionIssues]);
  const dismissedCautions = uniqueIssues.filter((issue) => issue.dismissed);
  const activeIssues = uniqueIssues.filter((issue) => !issue.dismissed);
  const mustFixIssues = activeIssues.filter(
    (issue) => issue.severity === 'mustFix',
  );
  const recommendedImprovements = activeIssues.filter(
    (issue) => issue.severity !== 'mustFix',
  );
  const materialAddOns = uniqueAddOns(
    activeIssues.flatMap((issue) => issue.materialAddOns),
  );

  return {
    decisionGroups: buildDecisionGroups(activeIssues),
    dismissedCautions,
    materialAddOns,
    mustFixIssues,
    recommendedImprovements,
  };
}

export function buildMaterialCompletenessAddOns(garden: Garden) {
  return buildPlanHealthReport({
    garden,
    warnings: [],
  }).materialAddOns;
}

function buildWarningIssues(
  warnings: PlanWarning[],
  dismissedWarnings: Set<string>,
): PlanHealthIssue[] {
  return warnings.flatMap((warning): PlanHealthIssue[] => {
    if (['pathway', 'rotation', 'trellis'].includes(warning.kind)) {
      return [];
    }

    const dismissed = dismissedWarnings.has(warning.id);

    return [
      {
        dismissible: warning.acknowledgeable,
        dismissed,
        decisionCategory: getPlanWarningDecisionCategory(warning),
        id: `warning:${warning.id}`,
        itemIds: warning.itemIds,
        materialAddOns: [],
        message: dismissed ? warning.fix : warning.message,
        sourceWarningId: warning.id,
        restoreWarningId: dismissed ? warning.id : null,
        severity:
          warning.severity === 'critical'
            ? 'mustFix'
            : warning.severity === 'warning'
              ? 'recommended'
              : 'caution',
        title: warning.title,
        type: 'warning',
      },
    ];
  });
}

function buildSupportIssues(garden: Garden): PlanHealthIssue[] {
  return activePlantings(garden).flatMap((planting): PlanHealthIssue[] => {
    const crop = getCropById(planting.cropId);
    const supportNeed = crop ? getCropSupportNeed(crop) : null;

    if (!crop || !supportNeed) {
      return [];
    }

    if (supportNeed.kind === 'trellis') {
      if (hasNearbySupport(garden, planting)) {
        return [];
      }

      const lengthFt = estimateSupportLengthFt(planting, crop);

      return [
        {
          dismissible: false,
          dismissed: false,
          decisionCategory: 'support',
          id: `health:trellis:${planting.id}`,
          itemIds: [planting.id],
          materialAddOns: [
            {
              id: `addon:trellis:${planting.id}`,
              itemIds: [planting.id],
              label: `${planting.label} trellis`,
              quantity: lengthFt,
              reason: supportNeed.reason,
              type: 'trellis',
              unit: 'ft',
            },
          ],
          message: `${planting.label} needs a trellis line, but no trellis is saved within reach.`,
          sourceWarningId: null,
          restoreWarningId: null,
          severity: supportNeed.required ? 'mustFix' : 'recommended',
          title: 'Trellis missing',
          type: 'trellisMissing',
        },
      ];
    }

    if (hasPlantLevelSupport(planting, supportNeed.kind)) {
      return [];
    }

    const count = Math.max(planting.plantCount ?? 1, 1);
    const supportLabel = getSupportLabel(supportNeed.kind);
    const title = isTomato(crop)
      ? 'Tomato support missing'
      : `${capitalize(supportLabel)} support missing`;

    return [
      {
        dismissible: false,
        dismissed: false,
        decisionCategory: 'support',
        id: `health:${supportNeed.kind}:${planting.id}`,
        itemIds: [planting.id],
        materialAddOns: [
          {
            id: `addon:${supportNeed.kind}:${planting.id}`,
            itemIds: [planting.id],
            label: `${planting.label} ${supportLabel}`,
            quantity: count,
            reason: supportNeed.reason,
            type: supportNeed.kind,
            unit: 'count',
          },
        ],
        message: `${planting.label} has no assigned ${supportLabel} support.`,
        sourceWarningId: null,
        restoreWarningId: null,
        severity: supportNeed.required ? 'recommended' : 'caution',
        title,
        type: isTomato(crop) ? 'tomatoSupportMissing' : 'cropSupportMissing',
      },
    ];
  });
}

export function buildPathAndIrrigationIssues(
  garden: Garden,
): PlanHealthIssue[] {
  const paths = garden.structures.filter(isPathStructure);
  const beds = garden.structures.filter(isBedLikeStructure);
  const accessPaths = paths.filter((path) =>
    isMeaningfulAccessPath(path, beds),
  );
  const pathIssues = paths.flatMap((path): PlanHealthIssue[] => {
    if (!isMeaningfulAccessPath(path, beds)) {
      return [];
    }

    const requiredWidthFt = getPathRequiredWidthFt(path);
    const walkableWidthFt = getWalkablePathWidthFt(path);

    if (walkableWidthFt >= requiredWidthFt) {
      return [];
    }

    return [
      {
        dismissible: false,
        dismissed: false,
        decisionCategory: 'pathway',
        id: `health:path-width:${path.id}`,
        itemIds: [path.id],
        materialAddOns: [],
        message: `${path.label} has ${formatMeasure(walkableWidthFt)} ft of walkable width; ${path.accessiblePath ? 'accessible' : 'standard'} access expects ${requiredWidthFt} ft.`,
        sourceWarningId: null,
        restoreWarningId: null,
        severity: path.accessiblePath ? 'mustFix' : 'recommended',
        title: 'Path too narrow',
        type: 'pathTooNarrow',
      },
    ];
  });
  const accessIssues = beds.flatMap((bed): PlanHealthIssue[] => {
    const clearanceFt = bed.workingClearanceFt ?? 2;
    const hasPathAccess = hasWalkablePathAccess(bed, accessPaths, clearanceFt);

    return hasPathAccess
      ? []
      : [
          {
            dismissible: false,
            dismissed: false,
            decisionCategory: 'pathway' as const,
            id: `health:irrigation-access:${bed.id}`,
            itemIds: [bed.id],
            materialAddOns: [],
            message: `${bed.label} has no saved path within ${formatMeasure(clearanceFt)} ft for watering or harvest access.`,
            sourceWarningId: null,
            restoreWarningId: null,
            severity: 'recommended',
            title: 'Irrigation access concern',
            type: 'irrigationAccessConcern',
          },
        ];
  });
  return [...pathIssues, ...accessIssues];
}

function buildRotationIssues(garden: Garden, now: Date): PlanHealthIssue[] {
  return buildRotationGuidance(garden, now).flatMap((guidance) => {
    if (guidance.level === 'safe' || guidance.level === 'unknown') {
      return [];
    }

    return [
      {
        dismissible: true,
        dismissed: false,
        decisionCategory: 'rotation',
        id: `health:rotation:${guidance.plantingId}`,
        itemIds: [guidance.plantingId],
        materialAddOns: [],
        message: guidance.message,
        sourceWarningId: null,
        restoreWarningId: null,
        severity: guidance.level === 'avoid' ? 'recommended' : 'caution',
        title: 'Crop family rotation caution',
        type: 'cropFamilyRotationCaution',
      },
    ];
  });
}

function buildBedCapacityIssues(garden: Garden): PlanHealthIssue[] {
  const beds = garden.structures.filter(isBedLikeStructure);

  return beds.flatMap((bed): PlanHealthIssue[] => {
    const bedFootprint = getStructureFootprint(bed);
    const plantingArea = activePlantings(garden)
      .filter((planting) => pointInsideStructure(planting, bed))
      .map(getPlantingFootprint)
      .filter((footprint) => rectsOverlap(footprint, bedFootprint))
      .reduce(
        (total, footprint) => total + footprint.widthFt * footprint.depthFt,
        0,
      );
    const bedArea = bed.widthFt * bed.depthFt;
    const ratio = bedArea > 0 ? plantingArea / bedArea : 0;

    if (ratio <= 0.85) {
      return [];
    }

    return [
      {
        dismissible: false,
        dismissed: false,
        decisionCategory: 'bedFit',
        id: `health:bed-capacity:${bed.id}`,
        itemIds: [bed.id],
        materialAddOns: [],
        message: `${bed.label} has ${Math.round(ratio * 100)}% of its footprint reserved by mature crop spacing.`,
        sourceWarningId: null,
        restoreWarningId: null,
        severity: ratio > 1 ? 'mustFix' : 'recommended',
        title: 'Bed over-capacity',
        type: 'bedOverCapacity',
      },
    ];
  });
}

function buildMulchIssues(garden: Garden): PlanHealthIssue[] {
  return garden.structures
    .filter(isBedLikeStructure)
    .flatMap((bed): PlanHealthIssue[] => {
      if (bed.mulched) {
        return [];
      }

      const areaSqFt = Math.round(bed.widthFt * bed.depthFt);

      return [
        {
          dismissible: false,
          dismissed: false,
          decisionCategory: 'care',
          id: `health:mulch:${bed.id}`,
          itemIds: [bed.id],
          materialAddOns: [
            {
              id: `addon:mulch:${bed.id}`,
              itemIds: [bed.id],
              label: `${bed.label} mulch`,
              quantity: areaSqFt,
              reason:
                'Unmulched beds lose moisture faster and make watering alerts noisier.',
              type: 'mulch',
              unit: 'sq ft',
            },
          ],
          message: `${bed.label} is not marked mulched.`,
          sourceWarningId: null,
          restoreWarningId: null,
          severity: 'caution',
          title: 'Mulch reminder',
          type: 'mulchReminder',
        },
      ];
    });
}

function buildSeasonProtectionIssues(
  garden: Garden,
  now: Date,
): PlanHealthIssue[] {
  const lastFrost = monthDayToDate(garden.climateProfile.averageLastFrost, now);
  const protectionEnds = addDays(lastFrost, 14);
  const today = toLocalDate(now);

  return activePlantings(garden).flatMap((planting): PlanHealthIssue[] => {
    const crop = getCropById(planting.cropId);
    const relevantDate = planting.plannedFor ?? planting.plantedOn ?? today;

    if (
      !crop ||
      !isWarmSeasonTender(crop) ||
      relevantDate > toLocalDate(protectionEnds)
    ) {
      return [];
    }

    const footprint = getPlantingFootprint(planting);
    const areaSqFt = Math.max(
      Math.ceil(footprint.widthFt * footprint.depthFt),
      1,
    );
    const type = crop.sowMethod === 'transplant' ? 'rowCover' : 'coldFrame';

    return [
      {
        dismissible: false,
        dismissed: false,
        decisionCategory: 'care',
        id: `health:season-protection:${planting.id}`,
        itemIds: [planting.id],
        materialAddOns: [
          {
            id: `addon:${type}:${planting.id}`,
            itemIds: [planting.id],
            label:
              type === 'rowCover'
                ? `${planting.label} row cover`
                : `${planting.label} cold frame space`,
            quantity: areaSqFt,
            reason: `${crop.commonName} is tender near the saved last-frost window.`,
            type,
            unit: 'sq ft',
          },
        ],
        message: `${planting.label} is scheduled within two weeks of the saved last frost.`,
        sourceWarningId: null,
        restoreWarningId: null,
        severity: 'recommended',
        title: 'Season protection suggested',
        type: 'rowCoverSuggested',
      },
    ];
  });
}

function toDismissedDecisionIssue(
  decision: GardenSuggestionDecision,
): PlanHealthIssue[] {
  if (decision.status === 'accepted') {
    return [];
  }

  return [
    {
      dismissible: false,
      dismissed: true,
      decisionCategory: 'care',
      id: `decision:${decision.id}`,
      itemIds: [],
      materialAddOns: [],
      message:
        decision.note ?? `${formatDecisionStatus(decision.status)} in Review.`,
      sourceWarningId: null,
      restoreWarningId: null,
      severity: 'caution',
      title: decision.label,
      type: 'warning',
    },
  ];
}

function formatDecisionStatus(status: GardenSuggestionDecision['status']) {
  return status === 'snoozed' ? 'ignored' : status;
}

function activePlantings(garden: Garden) {
  return garden.plantings.filter(
    (planting) =>
      planting.status !== 'removed' && planting.status !== 'harvested',
  );
}

function isTomato(crop: CropProfile) {
  return crop.id.includes('tomato') || /tomato/i.test(crop.commonName);
}

function isWarmSeasonTender(crop: CropProfile) {
  return (
    crop.frostSensitive ||
    ['Cucurbitaceae', 'Solanaceae'].includes(crop.family) ||
    ['cucumber', 'eggplant', 'melon', 'pepper', 'squash', 'tomato'].some(
      (term) => crop.commonName.toLowerCase().includes(term),
    )
  );
}

function pointInsideStructure(
  point: { xFt: number; yFt: number },
  structure: Structure,
) {
  return (
    point.xFt >= structure.xFt &&
    point.xFt <= structure.xFt + structure.widthFt &&
    point.yFt >= structure.yFt &&
    point.yFt <= structure.yFt + structure.depthFt
  );
}

function uniqueById(items: PlanHealthIssue[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function buildDecisionGroups(
  issues: PlanHealthIssue[],
): PlanHealthDecisionGroup[] {
  const groups = new Map<PlanWarningDecisionCategory, PlanHealthIssue[]>();

  for (const issue of issues) {
    groups.set(issue.decisionCategory, [
      ...(groups.get(issue.decisionCategory) ?? []),
      issue,
    ]);
  }

  return [...groups.entries()]
    .map(([category, groupIssues]) => {
      const meta = getPlanWarningDecisionCategoryMeta(category);
      const sortedIssues = [...groupIssues].sort(compareIssues);

      return {
        category,
        cautionCount: sortedIssues.filter(
          (issue) => issue.severity === 'caution',
        ).length,
        issues: sortedIssues,
        label: meta.label,
        mustFixCount: sortedIssues.filter(
          (issue) => issue.severity === 'mustFix',
        ).length,
        prompt: meta.prompt,
        recommendedCount: sortedIssues.filter(
          (issue) => issue.severity === 'recommended',
        ).length,
        totalCount: sortedIssues.length,
      };
    })
    .sort(compareDecisionGroups);
}

function compareDecisionGroups(
  left: PlanHealthDecisionGroup,
  right: PlanHealthDecisionGroup,
) {
  const leftRank = groupRank(left);
  const rightRank = groupRank(right);

  if (leftRank !== rightRank) {
    return rightRank - leftRank;
  }

  return categoryOrder(left.category) - categoryOrder(right.category);
}

function compareIssues(left: PlanHealthIssue, right: PlanHealthIssue) {
  const leftRank = issueRank(left);
  const rightRank = issueRank(right);

  if (leftRank !== rightRank) {
    return rightRank - leftRank;
  }

  return left.title.localeCompare(right.title);
}

function groupRank(group: PlanHealthDecisionGroup) {
  if (group.mustFixCount > 0) {
    return 4;
  }

  if (group.recommendedCount > 0) {
    return 3;
  }

  return 2;
}

function issueRank(issue: PlanHealthIssue) {
  if (issue.severity === 'mustFix') {
    return 4;
  }

  if (issue.severity === 'recommended') {
    return 3;
  }

  return 2;
}

function categoryOrder(category: PlanWarningDecisionCategory) {
  const order: Record<PlanWarningDecisionCategory, number> = {
    boundary: 0,
    spacing: 1,
    support: 2,
    shade: 3,
    sun: 4,
    pathway: 5,
    bedFit: 6,
    structure: 7,
    rotation: 8,
    care: 9,
  };

  return order[category];
}

function uniqueAddOns(items: PlanMaterialAddOn[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function monthDayToDate(monthDay: string, now: Date) {
  const [month = '1', day = '1'] = monthDay.split('-');

  return new Date(
    Date.UTC(now.getUTCFullYear(), Number(month) - 1, Number(day)),
  );
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toLocalDate(date: Date): LocalDateString {
  return date.toISOString().slice(0, 10);
}

function formatMeasure(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
