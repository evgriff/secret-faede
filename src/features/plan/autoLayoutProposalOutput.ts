import {
  normalizePlantSupportPlanForQuantity,
  type Garden,
  type Planting,
  type PlantSupportPlan,
  type Structure,
} from '../../domain/gardens/GardenRepository';
import {
  getPlantingFootprint,
  getStructureFootprint,
  rectsOverlap,
  type FootRect,
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

export function applySupportPlansAndBuildStructures(
  garden: Garden,
  placements: Placement[],
  strategy: AutoLayoutStrategy,
  referenceDate: Date,
): { placements: Placement[]; structures: Structure[] } {
  const structures: Structure[] = [];
  const supportedPlacements = placements.map((placement): Placement => {
    const crop = placement.unit.crop;
    const supportNeed = getCropSupportNeed(crop);

    if (!supportNeed || !cropNeedsSupport(crop)) {
      return placement;
    }

    if (!placement.unit.request.supportAllowed) {
      return placement;
    }

    const footprint = getPlantingFootprint(placement.planting);
    const supportKind: CropSupportKind = supportNeed.kind;

    if (supportKind !== 'trellis') {
      return {
        ...placement,
        planting: assignPlantLevelSupport(
          placement.planting,
          supportKind,
          supportNeed.required,
        ),
      };
    }

    const blockedRects = getSupportBlockedRects(
      garden,
      placement,
      placements,
      structures,
      referenceDate,
    );
    const supportFootprint = getLegalSupportFootprint(
      garden,
      crop,
      footprint,
      supportKind,
      blockedRects,
    );

    if (hasExistingSupport(garden, footprint) || !supportFootprint) {
      return placement;
    }

    const supportLabel = getSupportLabel(supportKind);
    structures.push({
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
      material: 'wire',
      mulched: false,
      notes: `${autoLayoutProposalMarker} ${capitalize(supportLabel)} support proposed for ${crop.commonName}.`,
      rotationDegrees: 0,
      soilType: 'unknown',
      type: 'trellis',
      widthFt: supportFootprint.widthFt,
      workingClearanceFt: 1,
      xFt: supportFootprint.xFt,
      yFt: supportFootprint.yFt,
    });
    return placement;
  });

  return { placements: supportedPlacements, structures };
}

export function buildSupportStructures(
  garden: Garden,
  placements: Placement[],
  strategy: AutoLayoutStrategy,
  referenceDate: Date,
): Structure[] {
  return applySupportPlansAndBuildStructures(
    garden,
    placements,
    strategy,
    referenceDate,
  ).structures;
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
        `${footprint.label} overlaps a saved path, trellis, or crop.`,
      );
    }

    if (
      cropNeedsSupport(placement.unit.crop) &&
      !canSupportFootprint(garden, placement.unit.crop, footprint, [
        ...reservedRects,
        ...footprints.filter((candidate) => candidate.id !== footprint.id),
      ]) &&
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
      blockingStructureRects.some(
        (blockedRect) =>
          blockedRect.id !== footprint.id &&
          rectsOverlap(footprint, blockedRect),
      )
    ) {
      violations.push(`${structure.label} blocks saved access.`);
    }
  }

  return violations;
}

function getSupportBlockedRects(
  garden: Garden,
  placement: Placement,
  placements: Placement[],
  structures: Structure[],
  referenceDate: Date,
): FootRect[] {
  return [
    ...buildReservedRects(garden, placement.planting, referenceDate),
    ...placements
      .filter((candidate) => candidate !== placement)
      .map((candidate) => getPlantingFootprint(candidate.planting)),
    ...structures.map(getStructureFootprint),
  ];
}

function assignPlantLevelSupport(
  planting: Planting,
  supportKind: Exclude<CropSupportKind, 'trellis'>,
  required: boolean,
): Planting {
  const support = createPlantSupportPlan(
    supportKind,
    Math.max(planting.plantCount ?? 1, 1),
    required,
  );

  return {
    ...planting,
    support,
  };
}

function createPlantSupportPlan(
  supportKind: Exclude<CropSupportKind, 'trellis'>,
  quantity: number,
  required: boolean,
): PlantSupportPlan {
  return normalizePlantSupportPlanForQuantity(
    {
      installedAtIso: null,
      notes: `${autoLayoutProposalMarker} ${capitalize(getSupportLabel(supportKind))} assigned as a plant-level support.`,
      perPlant: true,
      quantity,
      required,
      type: supportKind,
    },
    quantity,
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
