import type {
  Garden,
  Planting,
  Plot,
  Structure,
} from '../../domain/gardens/GardenRepository';

export interface FootRect {
  depthFt: number;
  id: string;
  itemType: 'planting' | 'structure';
  label: string;
  widthFt: number;
  xFt: number;
  yFt: number;
}

export interface PlanWarning {
  id: string;
  itemIds: string[];
  message: string;
  severity: 'warning';
}

const minimumPlantingFootprintFt = 0.75;

export function getPlantingFootprint(planting: Planting): FootRect {
  const spacingFt = inchesToFeet(
    planting.matureSpreadInches ?? planting.spacingInches ?? 12,
  );
  const rowDepthFt = Math.max(
    inchesToFeet(planting.rowSpacingInches ?? planting.spacingInches ?? 12),
    minimumPlantingFootprintFt,
  );

  if (planting.mode === 'row' || planting.mode === 'trellisLine') {
    const widthFt = Math.max(
      planting.rowLengthFt ?? spacingFt * Math.max(planting.plantCount ?? 1, 1),
      minimumPlantingFootprintFt,
    );
    const depthFt =
      planting.mode === 'trellisLine'
        ? Math.max(rowDepthFt, 0.5)
        : Math.max(rowDepthFt, spacingFt);

    return centeredFootprint(planting, widthFt, depthFt);
  }

  if (planting.mode === 'block') {
    return centeredFootprint(
      planting,
      Math.max(planting.blockWidthFt ?? spacingFt, minimumPlantingFootprintFt),
      Math.max(planting.blockDepthFt ?? spacingFt, minimumPlantingFootprintFt),
    );
  }

  if (planting.mode === 'cluster') {
    const count = Math.max(planting.plantCount ?? 1, 1);
    const diameterFt = Math.max(
      planting.clusterRadiusFt
        ? planting.clusterRadiusFt * 2
        : Math.sqrt(count) * spacingFt,
      minimumPlantingFootprintFt,
    );

    return centeredFootprint(planting, diameterFt, diameterFt);
  }

  return centeredFootprint(
    planting,
    Math.max(spacingFt, minimumPlantingFootprintFt),
    Math.max(spacingFt, minimumPlantingFootprintFt),
  );
}

export function getStructureFootprint(structure: Structure): FootRect {
  return {
    depthFt: structure.depthFt,
    id: structure.id,
    itemType: 'structure',
    label: structure.label,
    widthFt: structure.widthFt,
    xFt: structure.xFt,
    yFt: structure.yFt,
  };
}

export function findPlanWarnings(garden: Garden): PlanWarning[] {
  const plantingFootprints = garden.plantings.map(getPlantingFootprint);
  const structureFootprints = garden.structures.map(getStructureFootprint);
  const warnings: PlanWarning[] = [];

  for (const footprint of [...plantingFootprints, ...structureFootprints]) {
    if (!isRectInsidePlot(footprint, garden.plot)) {
      warnings.push({
        id: `bounds-${footprint.id}`,
        itemIds: [footprint.id],
        message: `${footprint.label} footprint extends beyond the plot boundary.`,
        severity: 'warning',
      });
    }
  }

  for (
    let leftIndex = 0;
    leftIndex < plantingFootprints.length;
    leftIndex += 1
  ) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < plantingFootprints.length;
      rightIndex += 1
    ) {
      const left = plantingFootprints[leftIndex];
      const right = plantingFootprints[rightIndex];

      if (left && right && rectsOverlap(left, right)) {
        warnings.push({
          id: `spacing-${left.id}-${right.id}`,
          itemIds: [left.id, right.id],
          message: `${left.label} and ${right.label} mature spacing overlaps.`,
          severity: 'warning',
        });
      }
    }
  }

  for (const planting of plantingFootprints) {
    for (const structure of garden.structures) {
      if (!isBlockingStructure(structure)) {
        continue;
      }

      const structureFootprint = getStructureFootprint(structure);

      if (rectsOverlap(planting, structureFootprint)) {
        warnings.push({
          id: `structure-${planting.id}-${structure.id}`,
          itemIds: [planting.id, structure.id],
          message: `${planting.label} conflicts with ${structure.label}.`,
          severity: 'warning',
        });
      }
    }
  }

  return warnings;
}

export function hasWarningForItem(
  warnings: PlanWarning[],
  itemId: string | null | undefined,
) {
  return Boolean(
    itemId && warnings.some((warning) => warning.itemIds.includes(itemId)),
  );
}

export function describeFootprint(rect: FootRect) {
  return `${formatMeasure(rect.widthFt)} ft by ${formatMeasure(rect.depthFt)} ft`;
}

export function rectsOverlap(left: FootRect, right: FootRect) {
  return (
    left.xFt < right.xFt + right.widthFt &&
    left.xFt + left.widthFt > right.xFt &&
    left.yFt < right.yFt + right.depthFt &&
    left.yFt + left.depthFt > right.yFt
  );
}

function centeredFootprint(
  planting: Planting,
  widthFt: number,
  depthFt: number,
): FootRect {
  return {
    depthFt,
    id: planting.id,
    itemType: 'planting',
    label: planting.label,
    widthFt,
    xFt: planting.xFt - widthFt / 2,
    yFt: planting.yFt - depthFt / 2,
  };
}

function isRectInsidePlot(rect: FootRect, plot: Plot) {
  return (
    rect.xFt >= 0 &&
    rect.yFt >= 0 &&
    rect.xFt + rect.widthFt <= plot.widthFt &&
    rect.yFt + rect.depthFt <= plot.depthFt
  );
}

function isBlockingStructure(structure: Structure) {
  return [
    'compost',
    'fence',
    'fenceWall',
    'path',
    'pathway',
    'treeObstacle',
    'waterSource',
  ].includes(structure.type);
}

function inchesToFeet(inches: number) {
  return Math.max(inches / 12, minimumPlantingFootprintFt);
}

function formatMeasure(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
