import type {
  Garden,
  Planting,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import {
  getPlantingFootprint,
  getStructureFootprint,
  isRectInsidePlot,
} from './gardenPlanningGeometry';
import {
  addEarlyShadeWarnings,
  addInternalSpacingWarnings,
  addStructureAccessWarnings,
} from './gardenConstraintChecks';
import {
  addBedFitWarnings,
  addRotationWarnings,
  addSpacingWarnings,
  addStructureWarnings,
  addSunWarnings,
  addTrellisWarnings,
} from './gardenWarningChecks';
import type { SunSeason } from './sunShadeEngine';

export {
  describeFootprint,
  getPlantingFootprint,
  getPlantingInstanceFootprint,
  getStructureFootprint,
  rectsOverlap,
  type FootRect,
} from './gardenPlanningGeometry';
export { buildRotationGuidance, type RotationGuidance } from './gardenRotation';

export type PlanWarningKind =
  | 'bedFit'
  | 'bounds'
  | 'container'
  | 'pathway'
  | 'rotation'
  | 'shade'
  | 'spacing'
  | 'structure'
  | 'sun'
  | 'trellis';
export type PlanWarningSeverity = 'critical' | 'info' | 'warning';
export type PlanWarningTaxonomy =
  | 'informationalCaution'
  | 'internalSignal'
  | 'mustFix'
  | 'recommendedImprovement';
export type PlanWarningUncertainty = 'estimated' | 'modeled' | 'observed';
export type PlanWarningVisibility =
  | 'canvas'
  | 'inspector'
  | 'internal'
  | 'planHealth';
export type PlanWarningDecisionCategory =
  | 'bedFit'
  | 'boundary'
  | 'care'
  | 'pathway'
  | 'rotation'
  | 'shade'
  | 'spacing'
  | 'structure'
  | 'sun'
  | 'support';

export interface PlanWarningDecisionCategoryMeta {
  category: PlanWarningDecisionCategory;
  label: string;
  prompt: string;
}

export interface PlanWarning {
  acknowledgeable: boolean;
  groupKey?: string;
  fix: string;
  id: string;
  itemIds: string[];
  kind: PlanWarningKind;
  message: string;
  severity: PlanWarningSeverity;
  taxonomy?: PlanWarningTaxonomy;
  title: string;
  uncertainty?: PlanWarningUncertainty;
  visibility?: PlanWarningVisibility;
}

export interface PlanWarningContext {
  now?: Date;
  sunLayer?: SunShadeLayer;
  sunSeason?: SunSeason;
}

export function findPlanWarnings(
  garden: Garden,
  context: PlanWarningContext = {},
): PlanWarning[] {
  const now = context.now ?? new Date();
  const activePlantings = garden.plantings.filter(isActivePlanting);
  const plantingFootprints = activePlantings.map((planting) => ({
    footprint: getPlantingFootprint(planting),
    planting,
  }));
  const structureFootprints = garden.structures.map(getStructureFootprint);
  const warnings: PlanWarning[] = [];

  for (const footprint of [
    ...plantingFootprints.map((entry) => entry.footprint),
    ...structureFootprints,
  ]) {
    if (!isRectInsidePlot(footprint, garden.plot)) {
      warnings.push({
        acknowledgeable: false,
        fix: 'Move or resize the item until its full footprint sits inside the saved plot.',
        id: `bounds-${footprint.id}`,
        itemIds: [footprint.id],
        kind: 'bounds',
        message: `${footprint.label} is partly outside the saved plot. Move it back inside the boundary.`,
        severity: 'critical',
        title: 'Out of bounds',
      });
    }
  }

  addSpacingWarnings(plantingFootprints, warnings, now);
  addInternalSpacingWarnings(plantingFootprints, warnings);
  addStructureWarnings(garden, plantingFootprints, warnings);
  addStructureAccessWarnings(garden, warnings);
  addBedFitWarnings(garden, plantingFootprints, warnings);
  addSunWarnings(context, plantingFootprints, warnings);
  addEarlyShadeWarnings(plantingFootprints, warnings);
  addTrellisWarnings(garden, plantingFootprints, warnings);
  addRotationWarnings(garden, warnings, now);

  return dedupePlanWarnings(warnings);
}

export function hasWarningForItem(
  warnings: PlanWarning[],
  itemId: string | null | undefined,
) {
  return Boolean(
    itemId && warnings.some((warning) => warning.itemIds.includes(itemId)),
  );
}

export function getPlanWarningDecisionCategory(
  warning: PlanWarning,
): PlanWarningDecisionCategory {
  switch (warning.kind) {
    case 'bedFit':
    case 'container':
      return 'bedFit';
    case 'bounds':
      return 'boundary';
    case 'pathway':
      return 'pathway';
    case 'rotation':
      return 'rotation';
    case 'shade':
      return 'shade';
    case 'spacing':
      return 'spacing';
    case 'structure':
      return 'structure';
    case 'sun':
      return 'sun';
    case 'trellis':
      return 'support';
  }
}

export function getPlanWarningDecisionCategoryMeta(
  category: PlanWarningDecisionCategory,
): PlanWarningDecisionCategoryMeta {
  switch (category) {
    case 'bedFit':
      return {
        category,
        label: 'Bed fit',
        prompt: 'Resize, move, or confirm the bed/container.',
      };
    case 'boundary':
      return {
        category,
        label: 'Plot boundary',
        prompt: 'Move or resize items inside the plot.',
      };
    case 'care':
      return {
        category,
        label: 'Season care',
        prompt: 'Choose useful add-ons.',
      };
    case 'pathway':
      return {
        category,
        label: 'Pathway',
        prompt: 'Keep water and harvest routes usable.',
      };
    case 'rotation':
      return {
        category,
        label: 'Rotation',
        prompt: 'Use saved history to decide if crop families move.',
      };
    case 'shade':
      return {
        category,
        label: 'Shade conflict',
        prompt: 'Move tall crops up-sun or confirm intentional shade.',
      };
    case 'spacing':
      return {
        category,
        label: 'Spacing',
        prompt: 'Move, thin, or reschedule shared mature space.',
      };
    case 'structure':
      return {
        category,
        label: 'Structure conflict',
        prompt: 'Separate crop footprints from structures.',
      };
    case 'sun':
      return {
        category,
        label: 'Sun mismatch',
        prompt: 'Use sun context to decide if the crop moves.',
      };
    case 'support':
      return {
        category,
        label: 'Support',
        prompt: 'Add a cage, stake, or trellis before it is needed.',
      };
  }
}

export function formatPlanWarningDecisionSummary(warnings: PlanWarning[]) {
  const categories = new Map<PlanWarningDecisionCategory, number>();

  for (const warning of warnings) {
    const category = getPlanWarningDecisionCategory(warning);
    categories.set(category, (categories.get(category) ?? 0) + 1);
  }

  return [...categories.entries()].map(([category, count]) => {
    const meta = getPlanWarningDecisionCategoryMeta(category);

    return `${meta.label}: ${count} ${count === 1 ? 'decision' : 'decisions'}`;
  });
}

function isActivePlanting(planting: Planting) {
  return planting.status !== 'removed' && planting.status !== 'harvested';
}

export function getPlanWarningTaxonomy(
  warning: PlanWarning,
): PlanWarningTaxonomy {
  if (warning.taxonomy) {
    return warning.taxonomy;
  }

  if (warning.severity === 'critical') {
    return 'mustFix';
  }

  return warning.severity === 'warning'
    ? 'recommendedImprovement'
    : 'informationalCaution';
}

export function isCanvasPlanWarning(warning: PlanWarning) {
  return (
    warning.visibility === 'canvas' ||
    getPlanWarningTaxonomy(warning) === 'mustFix'
  );
}

export function isInspectorPlanWarning() {
  return true;
}

export function isActivePlanWarning(warning: PlanWarning) {
  const taxonomy = getPlanWarningTaxonomy(warning);

  return taxonomy === 'mustFix' || taxonomy === 'recommendedImprovement';
}

function dedupePlanWarnings(warnings: PlanWarning[]) {
  const byKey = new Map<string, PlanWarning>();

  for (const warning of warnings) {
    const key = warning.groupKey ?? warning.id;
    const existing = byKey.get(key);

    if (!existing || warningRank(warning) > warningRank(existing)) {
      byKey.set(key, warning);
    }
  }

  return [...byKey.values()];
}

function warningRank(warning: PlanWarning) {
  const taxonomy = getPlanWarningTaxonomy(warning);

  if (taxonomy === 'mustFix') {
    return 4;
  }

  if (taxonomy === 'recommendedImprovement') {
    return 3;
  }

  return 2;
}
