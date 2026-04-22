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
  addStructureWarnings(garden, plantingFootprints, warnings);
  addBedFitWarnings(garden, plantingFootprints, warnings);
  addSunWarnings(context, plantingFootprints, warnings);
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
