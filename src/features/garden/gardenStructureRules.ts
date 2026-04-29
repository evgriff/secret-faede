import type {
  CropProfile,
  Garden,
  Planting,
  Structure,
} from '../../domain/gardens/GardenRepository';
import {
  cropNeedsSupport,
  getCropSupportNeed,
  getPlantSupportKind,
  getSupportLabel,
  hasPlantLevelSupport,
  needsExplicitSupportSetup,
  type CropSupportKind,
  type CropSupportNeed,
  type PlantLevelSupportKind,
} from '../../domain/gardens/GardenRepository';
import {
  getPlantingFootprint,
  getStructureFootprint,
  rectDistanceFt,
  rectsOverlap,
  type FootRect,
} from './gardenPlanningGeometry';

export {
  cropNeedsSupport,
  getCropSupportNeed,
  getPlantSupportKind,
  getSupportLabel,
  hasPlantLevelSupport,
  needsExplicitSupportSetup,
};
export type { CropSupportKind, CropSupportNeed, PlantLevelSupportKind };

export const minimumStandardPathWidthFt = 1.5;
export const minimumAccessiblePathWidthFt = 4;
export const minimumWorkingAisleWidthFt = minimumStandardPathWidthFt;
const nearbySupportDistanceFt = 1.25;

export function isBedLikeStructure(structure: Structure) {
  return ['bed', 'container', 'inGroundBed', 'raisedBed'].includes(
    structure.type,
  );
}

export function isPathStructure(structure: Structure) {
  return structure.type === 'path' || structure.type === 'pathway';
}

export function isBlockingStructure(structure: { type: string }) {
  return ['path', 'pathway'].includes(structure.type);
}

export function getPathRequiredWidthFt(path: Structure) {
  return path.accessiblePath
    ? minimumAccessiblePathWidthFt
    : minimumStandardPathWidthFt;
}

export function getWalkablePathWidthFt(path: Structure) {
  return Math.min(path.widthFt, path.depthFt);
}

export function getPathNarrowDimension(path: Structure) {
  return path.widthFt <= path.depthFt ? 'widthFt' : 'depthFt';
}

export function getPathLengthDimension(path: Structure) {
  return getPathNarrowDimension(path) === 'widthFt' ? 'depthFt' : 'widthFt';
}

export function resizePathWalkableWidth(
  path: Structure,
  walkableWidthFt: number,
): Pick<Structure, 'depthFt' | 'widthFt'> {
  const widthDimension = getPathNarrowDimension(path);

  return {
    depthFt: widthDimension === 'depthFt' ? walkableWidthFt : path.depthFt,
    widthFt: widthDimension === 'widthFt' ? walkableWidthFt : path.widthFt,
  };
}

export function resizePathLength(
  path: Structure,
  lengthFt: number,
): Pick<Structure, 'depthFt' | 'widthFt'> {
  const lengthDimension = getPathLengthDimension(path);

  return {
    depthFt: lengthDimension === 'depthFt' ? lengthFt : path.depthFt,
    widthFt: lengthDimension === 'widthFt' ? lengthFt : path.widthFt,
  };
}

export function isMeaningfulAccessPath(path: Structure, beds: Structure[]) {
  if (!isPathStructure(path)) {
    return false;
  }

  if (path.accessiblePath || path.continuousPath) {
    return true;
  }

  const pathFootprint = getStructureFootprint(path);

  return beds.some((bed) => {
    const clearanceFt = bed.workingClearanceFt ?? 2;

    return (
      rectsOverlap(
        expandRect(getStructureFootprint(bed), clearanceFt),
        pathFootprint,
      ) ||
      rectDistanceFt(getStructureFootprint(bed), pathFootprint) <= clearanceFt
    );
  });
}

export function hasWalkablePathAccess(
  bed: Structure,
  paths: Structure[],
  clearanceFt: number,
) {
  const bedFootprint = getStructureFootprint(bed);

  return paths.some((path) => {
    if (getWalkablePathWidthFt(path) < minimumWorkingAisleWidthFt) {
      return false;
    }

    const pathFootprint = getStructureFootprint(path);

    return (
      rectsOverlap(expandRect(bedFootprint, clearanceFt), pathFootprint) ||
      rectDistanceFt(bedFootprint, pathFootprint) <= clearanceFt
    );
  });
}

export function hasNearbySupport(garden: Garden, planting: Planting) {
  if (hasLinkedSupportStructure(garden, planting)) {
    return true;
  }

  return hasNearbySupportFootprint(garden, getPlantingFootprint(planting));
}

export function hasLinkedSupportStructure(garden: Garden, planting: Planting) {
  return getLinkedSupportStructures(garden, planting).length > 0;
}

export function getLinkedSupportStructures(garden: Garden, planting: Planting) {
  if (planting.supportStructureIds.length === 0) {
    return [];
  }

  const linkedIds = new Set(planting.supportStructureIds);

  return garden.structures.filter(
    (structure) => structure.type === 'trellis' && linkedIds.has(structure.id),
  );
}

export function hasNearbySupportFootprint(garden: Garden, footprint: FootRect) {
  return garden.structures
    .filter((structure) => structure.type === 'trellis')
    .some(
      (structure) =>
        rectDistanceFt(footprint, getStructureFootprint(structure)) <=
        nearbySupportDistanceFt,
    );
}

export function estimateSupportLengthFt(
  planting: Planting,
  crop: CropProfile | null,
) {
  const plantCount = Math.max(planting.plantCount ?? 1, 1);
  const spacingFt = Math.max(
    (planting.spacingInches ?? crop?.spacingInches ?? 12) / 12,
    0.75,
  );

  return Math.max(plantCount * spacingFt, 2);
}

export function expandRect(rect: FootRect, amountFt: number): FootRect {
  return {
    ...rect,
    depthFt: rect.depthFt + amountFt * 2,
    widthFt: rect.widthFt + amountFt * 2,
    xFt: rect.xFt - amountFt,
    yFt: rect.yFt - amountFt,
  };
}
