import type { Garden, Structure } from '../../domain/gardens/GardenRepository';
import {
  getPlantingFootprint,
  getStructureFootprint,
  rectsOverlap,
} from '../garden/gardenPlanning';
import {
  isRectInsidePlot,
  rectDistanceFt,
} from '../garden/gardenPlanningGeometry';
import {
  buildReservedRects,
  canSupportFootprint,
  cropNeedsSupport,
  getLegalSupportFootprint,
  hasExistingSupport,
  isBlockingStructure,
} from './autoLayoutConstraints';
import {
  type CropSupportKind,
  getCropSupportNeed,
  getSupportLabel,
} from '../garden/gardenStructureRules';
import type { AutoLayoutStrategy } from './autoLayoutTypes';
import { autoLayoutProposalMarker, type Placement } from './autoLayoutPlanner';

export function buildSupportStructures(
  garden: Garden,
  placements: Placement[],
  strategy: AutoLayoutStrategy,
): Structure[] {
  return placements.flatMap((placement): Structure[] => {
    const crop = placement.unit.crop;
    const supportNeed = getCropSupportNeed(crop);

    if (
      !supportNeed ||
      !cropNeedsSupport(crop) ||
      !placement.unit.request.supportAllowed
    ) {
      return [];
    }

    const footprint = getPlantingFootprint(placement.planting);
    const supportKind: CropSupportKind =
      placement.planting.mode === 'trellisLine' ? 'trellis' : supportNeed.kind;
    const supportFootprint = getLegalSupportFootprint(
      garden,
      crop,
      footprint,
      supportKind,
    );

    if (hasExistingSupport(garden, footprint) || !supportFootprint) {
      return [];
    }

    const supportLabel = getSupportLabel(supportKind);
    return [
      {
        accessiblePath: false,
        canopyRadiusFt: null,
        continuousPath: false,
        depthFt: supportFootprint.depthFt,
        drainageProfile: 'normal',
        heightFt: Math.max((crop.matureHeightInches ?? 72) / 12, 5),
        id: `${autoLayoutProposalMarker}-${strategy}-${supportKind}-${placement.unit.id}`,
        irrigationZone: null,
        label: `${crop.commonName} ${supportLabel}`,
        locked: false,
        material: supportKind === 'stake' ? 'lumber' : 'wire',
        mulched: false,
        notes: `${autoLayoutProposalMarker} ${capitalize(supportLabel)} support proposed for ${crop.commonName}.`,
        rotationDegrees: 0,
        soilType: 'unknown',
        type: 'trellis',
        widthFt: supportFootprint.widthFt,
        workingClearanceFt: 1,
        xFt: supportFootprint.xFt,
        yFt: supportFootprint.yFt,
      },
    ];
  });
}

export function findHardConstraintViolations(
  garden: Garden,
  placements: Placement[],
  structures: Structure[],
  referenceDate: Date,
) {
  const violations: string[] = [];
  const plantings = placements.map((placement) => placement.planting);
  const footprints = plantings.map(getPlantingFootprint);

  for (const placement of placements) {
    const footprint = getPlantingFootprint(placement.planting);

    if (!isRectInsidePlot(footprint, garden.plot)) {
      violations.push(`${footprint.label} is outside the plot.`);
    }

    const reservedRects = buildReservedRects(
      garden,
      placement.planting,
      referenceDate,
    );

    if (reservedRects.some((reserved) => rectsOverlap(footprint, reserved))) {
      violations.push(
        `${footprint.label} overlaps a saved path, obstacle, or crop.`,
      );
    }

    if (
      cropNeedsSupport(placement.unit.crop) &&
      !canSupportFootprint(garden, placement.unit.crop, footprint) &&
      !structures.some(
        (structure) =>
          structure.type === 'trellis' &&
          rectDistanceFt(footprint, getStructureFootprint(structure)) <= 1.25,
      )
    ) {
      violations.push(`${footprint.label} needs a legal support location.`);
    }
  }

  for (let leftIndex = 0; leftIndex < footprints.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < footprints.length;
      rightIndex += 1
    ) {
      const left = footprints[leftIndex];
      const right = footprints[rightIndex];

      if (left && right && rectsOverlap(left, right)) {
        violations.push(`${left.label} overlaps ${right.label}.`);
      }
    }
  }

  const blockingStructureRects = garden.structures
    .filter(isBlockingStructure)
    .map(getStructureFootprint);

  for (const structure of structures) {
    const footprint = getStructureFootprint(structure);

    if (!isRectInsidePlot(footprint, garden.plot)) {
      violations.push(`${structure.label} support is outside the plot.`);
    }

    if (
      blockingStructureRects.some((blockedRect) =>
        rectsOverlap(footprint, blockedRect),
      )
    ) {
      violations.push(`${structure.label} support blocks saved access.`);
    }
  }

  return violations;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
