import type {
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

export function isRectInsidePlot(rect: FootRect, plot: Plot) {
  return (
    rect.xFt >= 0 &&
    rect.yFt >= 0 &&
    rect.xFt + rect.widthFt <= plot.widthFt &&
    rect.yFt + rect.depthFt <= plot.depthFt
  );
}

export function isRectInsideStructure(rect: FootRect, structure: Structure) {
  return (
    rect.xFt >= structure.xFt &&
    rect.yFt >= structure.yFt &&
    rect.xFt + rect.widthFt <= structure.xFt + structure.widthFt &&
    rect.yFt + rect.depthFt <= structure.yFt + structure.depthFt
  );
}

export function rectDistanceFt(left: FootRect, right: FootRect) {
  const dx = Math.max(
    right.xFt - (left.xFt + left.widthFt),
    left.xFt - (right.xFt + right.widthFt),
    0,
  );
  const dy = Math.max(
    right.yFt - (left.yFt + left.depthFt),
    left.yFt - (right.yFt + right.depthFt),
    0,
  );

  return Math.sqrt(dx * dx + dy * dy);
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

function inchesToFeet(inches: number) {
  return Math.max(inches / 12, minimumPlantingFootprintFt);
}

function formatMeasure(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
