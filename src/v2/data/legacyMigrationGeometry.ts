import type { GardenStructure, PlantingGroup } from '../domain';
import { plantingCorners, structureContainsPoint } from './planGeometry';

const tolerance = 0.001;

export type LegacyMigrationBlockerCode =
  | 'ambiguous-growing-area'
  | 'instance-outside-plot'
  | 'instances-outside-planting'
  | 'invalid-growing-area'
  | 'invalid-plan'
  | 'migration-error'
  | 'missing-growing-area'
  | 'missing-legacy-source'
  | 'no-containing-growing-area'
  | 'planting-footprint-outside-plot';

export interface LegacyMigrationBlocker {
  code: LegacyMigrationBlockerCode;
  plantingNumber?: number;
}

interface LegacyPlantingGeometry {
  depthFt: number;
  instances: PlantingGroup['instances'];
  widthFt: number;
  xFt: number;
  yFt: number;
}

interface LegacyPlotGeometry {
  depthFt: number;
  widthFt: number;
}

export interface ResolvedLegacyPlantingGeometry extends LegacyPlantingGeometry {
  blockers: LegacyMigrationBlocker[];
  growingAreaStructureId: string | null;
  repairedInstanceFootprint: boolean;
}

export function resolveLegacyPlantingGeometry({
  explicitGrowingAreaStructureId,
  planting,
  plantingNumber,
  plot,
  structures,
}: {
  explicitGrowingAreaStructureId: string | null;
  planting: LegacyPlantingGeometry;
  plantingNumber: number;
  plot: LegacyPlotGeometry;
  structures: GardenStructure[];
}): ResolvedLegacyPlantingGeometry {
  const blockers: LegacyMigrationBlocker[] = [];
  const growingStructures = structures.filter(isGrowingStructure);
  const originalContainsInstances = instancesFitPlanting(planting);
  const expanded = originalContainsInstances
    ? planting
    : expandToPreserveInstances(planting);
  const expandedMatches = matchingGrowingAreas(expanded, growingStructures);
  const explicitExpandedMatch = explicitGrowingAreaStructureId
    ? expandedMatches.find(
        (structure) => structure.id === explicitGrowingAreaStructureId,
      )
    : undefined;
  const canRepairInstanceFootprint =
    !originalContainsInstances &&
    plantingFitsPlot(expanded, plot) &&
    (explicitGrowingAreaStructureId
      ? Boolean(explicitExpandedMatch)
      : expandedMatches.length === 1);
  const resolvedPlanting = canRepairInstanceFootprint ? expanded : planting;

  if (!originalContainsInstances && !canRepairInstanceFootprint) {
    addBlocker(blockers, 'instances-outside-planting', plantingNumber);
  }
  if (!plantingFitsPlot(resolvedPlanting, plot)) {
    addBlocker(blockers, 'planting-footprint-outside-plot', plantingNumber);
  }
  if (!instancesFitPlot(resolvedPlanting.instances, plot)) {
    addBlocker(blockers, 'instance-outside-plot', plantingNumber);
  }

  const matches = matchingGrowingAreas(resolvedPlanting, growingStructures);
  let growingAreaStructureId: string | null = null;
  if (explicitGrowingAreaStructureId) {
    if (
      matches.some(
        (structure) => structure.id === explicitGrowingAreaStructureId,
      )
    ) {
      growingAreaStructureId = explicitGrowingAreaStructureId;
    } else {
      addBlocker(blockers, 'invalid-growing-area', plantingNumber);
    }
  } else if (matches.length === 1) {
    growingAreaStructureId = matches[0]?.id ?? null;
  } else if (matches.length > 1) {
    addBlocker(blockers, 'ambiguous-growing-area', plantingNumber);
  } else if (growingStructures.length === 0) {
    addBlocker(blockers, 'missing-growing-area', plantingNumber);
  } else {
    addBlocker(blockers, 'no-containing-growing-area', plantingNumber);
  }

  return {
    ...resolvedPlanting,
    blockers,
    growingAreaStructureId,
    repairedInstanceFootprint: canRepairInstanceFootprint,
  };
}

function addBlocker(
  blockers: LegacyMigrationBlocker[],
  code: LegacyMigrationBlockerCode,
  plantingNumber: number,
) {
  if (
    !blockers.some(
      (blocker) =>
        blocker.code === code && blocker.plantingNumber === plantingNumber,
    )
  ) {
    blockers.push({ code, plantingNumber });
  }
}

function expandToPreserveInstances(
  planting: LegacyPlantingGeometry,
): LegacyPlantingGeometry {
  const points = [...plantingCorners(planting), ...planting.instances];
  const xValues = points.map((point) => point.xFt);
  const yValues = points.map((point) => point.yFt);
  const left = Math.min(...xValues);
  const right = Math.max(...xValues);
  const top = Math.min(...yValues);
  const bottom = Math.max(...yValues);
  return {
    ...planting,
    depthFt: bottom - top,
    widthFt: right - left,
    xFt: (left + right) / 2,
    yFt: (top + bottom) / 2,
  };
}

function instancesFitPlanting(planting: LegacyPlantingGeometry) {
  const halfWidth = planting.widthFt / 2;
  const halfDepth = planting.depthFt / 2;
  return planting.instances.every(
    (instance) =>
      instance.xFt >= planting.xFt - halfWidth - tolerance &&
      instance.xFt <= planting.xFt + halfWidth + tolerance &&
      instance.yFt >= planting.yFt - halfDepth - tolerance &&
      instance.yFt <= planting.yFt + halfDepth + tolerance,
  );
}

function instancesFitPlot(
  instances: PlantingGroup['instances'],
  plot: LegacyPlotGeometry,
) {
  return instances.every(
    (instance) =>
      instance.xFt >= -tolerance &&
      instance.xFt <= plot.widthFt + tolerance &&
      instance.yFt >= -tolerance &&
      instance.yFt <= plot.depthFt + tolerance,
  );
}

function isGrowingStructure(structure: GardenStructure) {
  return ['bed', 'container', 'raisedBed'].includes(structure.type);
}

function matchingGrowingAreas(
  planting: LegacyPlantingGeometry,
  structures: GardenStructure[],
) {
  return structures.filter(
    (structure) =>
      plantingCorners(planting).every((point) =>
        structureContainsPoint(structure, point),
      ) &&
      planting.instances.every((instance) =>
        structureContainsPoint(structure, instance),
      ),
  );
}

function plantingFitsPlot(
  planting: LegacyPlantingGeometry,
  plot: LegacyPlotGeometry,
) {
  return plantingCorners(planting).every(
    (point) =>
      point.xFt >= -tolerance &&
      point.xFt <= plot.widthFt + tolerance &&
      point.yFt >= -tolerance &&
      point.yFt <= plot.depthFt + tolerance,
  );
}
