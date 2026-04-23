import type {
  Planting,
  PlantingInstance,
  Plot,
  Structure,
} from '../../domain/gardens/GardenRepository';
import { derivePlantingGeometryFromPlanting } from '../../domain/gardens/plantingGeometry';

export interface FootRect {
  depthFt: number;
  id: string;
  itemType: 'planting' | 'structure';
  label: string;
  widthFt: number;
  xFt: number;
  yFt: number;
}

export function getPlantingFootprint(planting: Planting): FootRect {
  const footprint = derivePlantingGeometryFromPlanting(planting).footprint;

  return {
    ...footprint,
    id: planting.id,
    itemType: 'planting',
    label: planting.label,
  };
}

export function getPlantingInstanceFootprint(
  planting: Planting,
  instance: PlantingInstance,
): FootRect {
  const sizeFt = getPlantingInstanceSizeFt(planting);

  return {
    depthFt: sizeFt,
    id: instance.id,
    itemType: 'planting',
    label: instance.label,
    widthFt: sizeFt,
    xFt: instance.xFt - sizeFt / 2,
    yFt: instance.yFt - sizeFt / 2,
  };
}

function getPlantingInstanceSizeFt(planting: Planting) {
  return derivePlantingGeometryFromPlanting(planting).plantDiameterFt;
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

function formatMeasure(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
