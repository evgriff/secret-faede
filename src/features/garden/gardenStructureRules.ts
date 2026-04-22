import type {
  CropProfile,
  Garden,
  Planting,
  Structure,
} from '../../domain/gardens/GardenRepository';
import {
  getPlantingFootprint,
  getStructureFootprint,
  rectDistanceFt,
  rectsOverlap,
  type FootRect,
} from './gardenPlanningGeometry';

export type CropSupportKind = 'cage' | 'stake' | 'trellis';

export interface CropSupportNeed {
  kind: CropSupportKind;
  required: boolean;
  reason: string;
}

const minimumStandardPathWidthFt = 3;
const minimumAccessiblePathWidthFt = 4;
const minimumWorkingAisleWidthFt = 2;
const nearbySupportDistanceFt = 1.25;

export function isBedLikeStructure(structure: Structure) {
  return ['bed', 'container', 'inGroundBed', 'raisedBed'].includes(
    structure.type,
  );
}

export function isPathStructure(structure: Structure) {
  return structure.type === 'path' || structure.type === 'pathway';
}

export function isWaterSourceStructure(structure: Structure) {
  return structure.type === 'hoseBib' || structure.type === 'waterSource';
}

export function isCompostStructure(structure: Structure) {
  return structure.type === 'compost';
}

export function isBlockingStructure(structure: { type: string }) {
  return [
    'compost',
    'fence',
    'fenceWall',
    'hoseBib',
    'path',
    'pathway',
    'treeObstacle',
    'waterSource',
  ].includes(structure.type);
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

export function findCompostPlacementConflicts(garden: Garden) {
  const beds = garden.structures.filter(isBedLikeStructure);
  const paths = garden.structures.filter(isPathStructure);

  return garden.structures.filter(isCompostStructure).flatMap((compost) => {
    const compostFootprint = getStructureFootprint(compost);

    return [...beds, ...paths].flatMap((structure) => {
      if (!rectsOverlap(compostFootprint, getStructureFootprint(structure))) {
        return [];
      }

      return [{ compost, structure }];
    });
  });
}

export function findNearestWaterDistanceFt(
  garden: Garden,
  structure: Structure,
) {
  const waterMarkers = garden.structures.filter(isWaterSourceStructure);

  if (waterMarkers.length === 0) {
    return null;
  }

  const footprint = getStructureFootprint(structure);

  return Math.min(
    ...waterMarkers.map((water) =>
      rectDistanceFt(footprint, getStructureFootprint(water)),
    ),
  );
}

export function getCropSupportNeed(crop: CropProfile): CropSupportNeed | null {
  if (isTomato(crop)) {
    return {
      kind: 'cage',
      reason: 'Tomatoes are tall, heavy fruiting crops.',
      required: crop.trellisRequired,
    };
  }

  if (
    crop.trellisRequired ||
    crop.trellisRecommended ||
    crop.growthForm === 'climber' ||
    crop.growthForm === 'vining'
  ) {
    return {
      kind: 'trellis',
      reason: `${crop.commonName} climbs or vines.`,
      required: crop.trellisRequired || crop.growthForm === 'climber',
    };
  }

  if (crop.growthForm === 'bush' && (crop.matureHeightInches ?? 0) >= 24) {
    return {
      kind: 'cage',
      reason: `${crop.commonName} benefits from a cage.`,
      required: false,
    };
  }

  if (crop.growthForm === 'upright' && (crop.matureHeightInches ?? 0) >= 36) {
    return {
      kind: 'stake',
      reason: `${crop.commonName} is tall enough for staking.`,
      required: false,
    };
  }

  return null;
}

export function cropNeedsSupport(crop: CropProfile) {
  return Boolean(getCropSupportNeed(crop));
}

export function hasNearbySupport(garden: Garden, planting: Planting) {
  if (planting.mode === 'trellisLine' || (planting.trellisLengthFt ?? 0) > 0) {
    return true;
  }

  return hasNearbySupportFootprint(garden, getPlantingFootprint(planting));
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

export function getSupportLabel(kind: CropSupportKind) {
  if (kind === 'trellis') {
    return 'trellis';
  }

  return kind === 'cage' ? 'cage' : 'stake';
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

function isTomato(crop: CropProfile) {
  return crop.id.includes('tomato') || /tomato/i.test(crop.commonName);
}
