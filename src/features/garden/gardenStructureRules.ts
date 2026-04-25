import type {
  CropProfile,
  Garden,
  Planting,
  PlantSupportType,
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

export function getCropSupportNeed(crop: CropProfile): CropSupportNeed | null {
  if (isTomato(crop)) {
    return {
      kind: 'cage',
      reason: 'Tomatoes are tall, heavy fruiting crops.',
      required: false,
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

export function needsExplicitSupportSetup(crop: CropProfile) {
  const supportNeed = getCropSupportNeed(crop);

  return Boolean(
    supportNeed &&
    (supportNeed.kind === 'trellis' || supportNeed.required === true),
  );
}

export function hasNearbySupport(garden: Garden, planting: Planting) {
  if (planting.mode === 'trellisLine' || (planting.trellisLengthFt ?? 0) > 0) {
    return true;
  }

  return hasNearbySupportFootprint(garden, getPlantingFootprint(planting));
}

export function hasPlantLevelSupport(
  planting: Planting,
  kind: Exclude<CropSupportKind, 'trellis'>,
) {
  if (planting.support.type === 'none' || planting.support.quantity <= 0) {
    return false;
  }

  const assignedKind = getPlantSupportKind(planting.support.type);

  if (!assignedKind) {
    return false;
  }

  if (assignedKind === kind) {
    return true;
  }

  return isPlantLevelSupportCompatible(kind, assignedKind);
}

export function getPlantSupportKind(
  supportType: PlantSupportType,
): Exclude<CropSupportKind, 'trellis'> | null {
  switch (supportType) {
    case 'cage':
      return 'cage';
    case 'stake':
    case 'stakeAndWeave':
      return 'stake';
    case 'custom':
    case 'netting':
    case 'none':
    case 'rowCover':
      return null;
  }
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

function isPlantLevelSupportCompatible(
  neededKind: Exclude<CropSupportKind, 'trellis'>,
  assignedKind: Exclude<CropSupportKind, 'trellis'>,
) {
  return (
    (neededKind === 'cage' && assignedKind === 'stake') ||
    (neededKind === 'stake' && assignedKind === 'cage')
  );
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
