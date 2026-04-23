import { getCropById } from '../../domain/crops/cropCatalog';
import type {
  Garden,
  Planting,
  Structure,
  SunExposure,
} from '../../domain/gardens/GardenRepository';
import { getPlantingInstances } from '../../domain/gardens/plantingInstances';
import {
  getStructureFootprint,
  rectsOverlap,
  type FootRect,
} from './gardenPlanningGeometry';
import type { PlanWarning } from './gardenPlanning';
import {
  getWalkablePathWidthFt,
  isBedLikeStructure,
  isMeaningfulAccessPath,
  isPathStructure,
} from './gardenStructureRules';

type PlantingFootprint = { footprint: FootRect; planting: Planting };

const spacingTolerance = 0.85;
const tallCropHeightFt = 3.5;
const shadeHeightDeltaFt = 1.5;
const shadeAlignmentBufferFt = 0.75;
const maxEstimatedShadeReachFt = 5;

export function addInternalSpacingWarnings(
  plantings: PlantingFootprint[],
  warnings: PlanWarning[],
) {
  for (const { planting } of plantings) {
    const instances = getPlantingInstances(planting);

    if (instances.length < 2) {
      continue;
    }

    const crop = getCropById(planting.cropId);
    const spacingInches = planting.spacingInches ?? crop?.spacingInches;

    if (!spacingInches || spacingInches <= 0) {
      continue;
    }

    const closest = getClosestInstanceDistanceFt(instances);
    const requiredFt = spacingInches / 12;

    if (!closest || closest.distanceFt >= requiredFt * spacingTolerance) {
      continue;
    }

    warnings.push({
      acknowledgeable: false,
      fix: 'Increase spacing, reduce quantity, switch the planting form, or mark plants as thinned in the editor.',
      id: `spacing-internal-${planting.id}`,
      itemIds: [planting.id],
      kind: 'spacing',
      message: `${planting.label} has saved plant centers about ${formatInches(
        closest.distanceFt * 12,
      )} in apart inside the group. The current spacing target is ${formatInches(
        spacingInches,
      )} in.`,
      severity: 'warning',
      title: 'Internal spacing too tight',
      uncertainty: 'estimated',
    });
  }
}

export function addStructureAccessWarnings(
  garden: Garden,
  warnings: PlanWarning[],
) {
  const paths = garden.structures.filter(isPathStructure);
  const beds = garden.structures.filter(isBedLikeStructure);

  for (const path of paths) {
    const pathFootprint = getStructureFootprint(path);
    const primaryPath = isMeaningfulAccessPath(path, beds);

    for (const structure of garden.structures) {
      if (structure.id === path.id || isPathStructure(structure)) {
        continue;
      }

      const structureFootprint = getStructureFootprint(structure);

      if (!rectsOverlap(pathFootprint, structureFootprint)) {
        continue;
      }

      warnings.push({
        acknowledgeable: false,
        fix: 'Move or resize the path or structure so the saved walking surface stays open.',
        id: `pathway-structure-${structure.id}-${path.id}`,
        itemIds: [structure.id, path.id],
        kind: 'pathway',
        message: `${structure.label} overlaps ${path.label}. Keep ${formatPathWidth(
          path,
        )} of saved walking surface clear for watering, harvest, and maintenance access.`,
        severity: primaryPath ? 'critical' : 'warning',
        title:
          structure.type === 'trellis'
            ? 'Trellis blocks access'
            : primaryPath
              ? 'Primary path blocked'
              : 'Pathway conflict',
      });
    }
  }
}

export function addEarlyShadeWarnings(
  plantings: PlantingFootprint[],
  warnings: PlanWarning[],
) {
  const shadeConflicts = new Map<string, PlantingFootprint[]>();

  for (let leftIndex = 0; leftIndex < plantings.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < plantings.length;
      rightIndex += 1
    ) {
      const left = plantings[leftIndex];
      const right = plantings[rightIndex];

      if (!left || !right) {
        continue;
      }

      const conflict = getEstimatedShadeConflict(left, right);

      if (!conflict) {
        continue;
      }

      shadeConflicts.set(conflict.caster.planting.id, [
        ...(shadeConflicts.get(conflict.caster.planting.id) ?? []),
        conflict.receiver,
      ]);
    }
  }

  for (const [casterId, receivers] of shadeConflicts) {
    const caster = plantings.find((entry) => entry.planting.id === casterId);

    if (!caster || receivers.length === 0) {
      continue;
    }

    const sortedReceivers = [...receivers].sort((left, right) =>
      left.planting.label.localeCompare(right.planting.label),
    );
    const receiverLabels = sortedReceivers.map((entry) => entry.planting.label);
    const receiverIds = sortedReceivers.map((entry) => entry.planting.id);
    const casterHeightFt = getMatureHeightFt(caster.planting);
    const worstSeverity = sortedReceivers.some((entry) =>
      isSunHungry(entry.planting.sunRequirement),
    )
      ? 'warning'
      : 'info';

    warnings.push({
      acknowledgeable: worstSeverity === 'info',
      fix: 'Move the taller group north/up-sun, move the shorter group south, or keep the shade only if it is intentional.',
      id: `shade-order-${caster.planting.id}-${receiverIds.join('-')}`,
      itemIds: [caster.planting.id, ...receiverIds],
      kind: 'shade',
      message:
        receiverLabels.length === 1
          ? `${caster.planting.label} is about ${formatFeet(
              casterHeightFt ?? tallCropHeightFt,
            )} ft tall at maturity and sits south/down-sun of ${receiverLabels[0]}. It can shade that group during mid-summer afternoon hours.`
          : `${caster.planting.label} is taller and sits south/down-sun of ${receiverLabels[0]}, ${receiverLabels[1]}, and ${
              receiverLabels.length - 2
            } more crops. It can create avoidable mid-summer afternoon shade.`,
      severity: worstSeverity,
      title: 'Height-order shade risk',
      uncertainty: 'estimated',
      visibility: worstSeverity === 'warning' ? 'planHealth' : 'internal',
    });
  }
}

function getClosestInstanceDistanceFt(
  instances: Array<{ xFt: number; yFt: number }>,
) {
  let closest: { distanceFt: number } | null = null;

  for (let leftIndex = 0; leftIndex < instances.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < instances.length;
      rightIndex += 1
    ) {
      const left = instances[leftIndex];
      const right = instances[rightIndex];

      if (!left || !right) {
        continue;
      }

      const distanceFt = Math.hypot(left.xFt - right.xFt, left.yFt - right.yFt);

      if (!closest || distanceFt < closest.distanceFt) {
        closest = { distanceFt };
      }
    }
  }

  return closest;
}

function getEstimatedShadeConflict(
  left: PlantingFootprint,
  right: PlantingFootprint,
) {
  const leftHeightFt = getMatureHeightFt(left.planting);
  const rightHeightFt = getMatureHeightFt(right.planting);

  if (leftHeightFt === null || rightHeightFt === null) {
    return null;
  }

  const caster =
    leftHeightFt >= rightHeightFt
      ? { entry: left, heightFt: leftHeightFt }
      : { entry: right, heightFt: rightHeightFt };
  const receiver =
    caster.entry.planting.id === left.planting.id
      ? { entry: right, heightFt: rightHeightFt }
      : { entry: left, heightFt: leftHeightFt };

  if (
    caster.heightFt < tallCropHeightFt ||
    caster.heightFt - receiver.heightFt < shadeHeightDeltaFt ||
    !shouldProtectFromEstimatedShade(receiver.entry.planting.sunRequirement)
  ) {
    return null;
  }

  const casterCenter = center(caster.entry.footprint);
  const receiverCenter = center(receiver.entry.footprint);
  const southOfReceiver = casterCenter.yFt > receiverCenter.yFt + 0.5;
  const verticalGapFt = Math.max(
    caster.entry.footprint.yFt -
      (receiver.entry.footprint.yFt + receiver.entry.footprint.depthFt),
    0,
  );
  const horizontalDistanceFt = axisDistance(
    caster.entry.footprint.xFt,
    caster.entry.footprint.xFt + caster.entry.footprint.widthFt,
    receiver.entry.footprint.xFt,
    receiver.entry.footprint.xFt + receiver.entry.footprint.widthFt,
  );
  const shadeReachFt = Math.min(
    Math.max(caster.heightFt * 0.75, 2),
    maxEstimatedShadeReachFt,
  );

  if (
    !southOfReceiver ||
    verticalGapFt > shadeReachFt ||
    horizontalDistanceFt > shadeAlignmentBufferFt
  ) {
    return null;
  }

  return { caster: caster.entry, receiver: receiver.entry };
}

function getMatureHeightFt(planting: Planting) {
  const crop = getCropById(planting.cropId);
  const heightInches = planting.matureHeightInches ?? crop?.matureHeightInches;

  if (!heightInches || heightInches <= 0) {
    return null;
  }

  const trellised =
    planting.mode === 'trellisLine' || (planting.trellisLengthFt ?? 0) > 0;

  return Math.max(heightInches / 12, trellised ? 6 : 0);
}

function shouldProtectFromEstimatedShade(requirement: SunExposure | null) {
  if (!requirement) {
    return true;
  }

  return isSunHungry(requirement);
}

function isSunHungry(requirement: SunExposure | null) {
  return requirement === 'fullSun' || requirement === 'partSun';
}

function center(rect: FootRect) {
  return {
    xFt: rect.xFt + rect.widthFt / 2,
    yFt: rect.yFt + rect.depthFt / 2,
  };
}

function axisDistance(
  leftMin: number,
  leftMax: number,
  rightMin: number,
  rightMax: number,
) {
  if (leftMax < rightMin) {
    return rightMin - leftMax;
  }

  if (rightMax < leftMin) {
    return leftMin - rightMax;
  }

  return 0;
}

function formatPathWidth(path: Structure) {
  return `${formatFeet(getWalkablePathWidthFt(path))} ft`;
}

function formatFeet(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatInches(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(0);
}
