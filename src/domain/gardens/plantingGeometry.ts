import type { Planting, PlantingMode } from './models';
import {
  getGeometryDimensions,
  getGeometryOffsets,
  roundFeet,
} from './plantingGeometryOffsets';
import {
  getFootprintFromDots,
  getMinimumModeFootprint,
  unionFootprints,
} from './plantingGeometryFootprints';

export type PlantingGeometryMode = 'block' | 'cluster' | 'row';

export interface PlantingGeometryInput {
  blockDepthFt?: number | null;
  blockWidthFt?: number | null;
  clusterRadiusFt?: number | null;
  id?: string;
  label?: string;
  matureSpreadInches?: number | null;
  mode: PlantingGeometryMode | PlantingMode;
  quantity?: number | null;
  rowLengthFt?: number | null;
  rowSpacingFt?: number | null;
  rowSpacingInches?: number | null;
  spacingInches?: number | null;
  xFt: number;
  yFt: number;
}

export interface PlantingGeometryDot {
  id: string | null;
  index: number;
  offsetXFt: number;
  offsetYFt: number;
  xFt: number;
  yFt: number;
}

export interface PlantingGeometryFootprint {
  depthFt: number;
  widthFt: number;
  xFt: number;
  yFt: number;
}

export interface PlantingGeometryDimensions {
  blockDepthFt: number | null;
  blockWidthFt: number | null;
  clusterRadiusFt: number | null;
  rowLengthFt: number | null;
}

export interface PlantingGeometry {
  dimensions: PlantingGeometryDimensions;
  dots: PlantingGeometryDot[];
  footprint: PlantingGeometryFootprint;
  mode: PlantingGeometryMode;
  plantDiameterFt: number;
  quantity: number;
  rowSpacingFt: number;
  spacingFt: number;
}

const fallbackSpacingInches = 12;
const minimumCenterSpacingFt = 0.125;
const minimumFootprintDimensionFt = 0.75;

export function derivePlantingGeometry(
  input: PlantingGeometryInput,
): PlantingGeometry {
  const mode = toPlantingGeometryMode(input.mode);
  const quantity = normalizeQuantity(input.quantity);
  const spacingFt = getSpacingFt(input);
  const rowSpacingFt = getRowSpacingFt(input, spacingFt);
  const plantDiameterFt = getPlantDiameterFt(input);
  const dots = getGeometryOffsets({
    input,
    mode,
    quantity,
    rowSpacingFt,
    spacingFt,
  }).map((offset, index) => ({
    id: input.id ? `${input.id}-dot-${index + 1}` : null,
    index,
    offsetXFt: roundFeet(offset.xFt),
    offsetYFt: roundFeet(offset.yFt),
    xFt: roundFeet(input.xFt + offset.xFt),
    yFt: roundFeet(input.yFt + offset.yFt),
  }));
  const dimensions = getGeometryDimensions(mode, dots, input);
  const dotFootprint = getFootprintFromDots(dots, plantDiameterFt);

  return {
    dimensions,
    dots,
    footprint: unionFootprints(
      dotFootprint,
      getMinimumModeFootprint({
        center: input,
        dimensions,
        mode,
        plantDiameterFt,
        rowSpacingFt,
      }),
    ),
    mode,
    plantDiameterFt,
    quantity,
    rowSpacingFt,
    spacingFt,
  };
}

export function derivePlantingGeometryFromPlanting(planting: Planting) {
  return derivePlantingGeometry({
    blockDepthFt: planting.blockDepthFt,
    blockWidthFt: planting.blockWidthFt,
    clusterRadiusFt: planting.clusterRadiusFt,
    id: planting.id,
    label: planting.label,
    matureSpreadInches: planting.matureSpreadInches,
    mode: planting.mode,
    quantity: planting.plantCount,
    rowLengthFt: planting.rowLengthFt,
    rowSpacingFt: planting.rowSpacingFt,
    rowSpacingInches: planting.rowSpacingInches,
    spacingInches: planting.spacingInches,
    xFt: planting.xFt,
    yFt: planting.yFt,
  });
}

export function getDerivedPlantingDimensions(input: PlantingGeometryInput) {
  return derivePlantingGeometry({
    ...input,
    blockDepthFt: null,
    blockWidthFt: null,
    clusterRadiusFt: null,
    rowLengthFt: null,
  }).dimensions;
}

export function toPlantingGeometryMode(
  mode: PlantingGeometryMode | PlantingMode,
): PlantingGeometryMode {
  if (mode === 'block') {
    return 'block';
  }

  if (mode === 'row' || mode === 'trellisLine') {
    return 'row';
  }

  return 'cluster';
}

function getSpacingFt(input: PlantingGeometryInput) {
  return Math.max(
    normalizeInches(input.spacingInches ?? fallbackSpacingInches) / 12,
    minimumCenterSpacingFt,
  );
}

function getRowSpacingFt(
  input: PlantingGeometryInput,
  fallbackSpacingFt: number,
) {
  const rowSpacingInches = input.rowSpacingInches;

  if (rowSpacingInches && rowSpacingInches > 0) {
    return Math.max(rowSpacingInches / 12, minimumCenterSpacingFt);
  }

  if (input.rowSpacingFt && input.rowSpacingFt > 0) {
    return Math.max(input.rowSpacingFt, minimumCenterSpacingFt);
  }

  return fallbackSpacingFt;
}

function getPlantDiameterFt(input: PlantingGeometryInput) {
  return Math.max(
    normalizeInches(
      input.matureSpreadInches ?? input.spacingInches ?? fallbackSpacingInches,
    ) / 12,
    minimumFootprintDimensionFt,
  );
}

function normalizeQuantity(quantity: number | null | undefined) {
  return Math.max(Math.round(quantity ?? 1), 1);
}

function normalizeInches(inches: number | null | undefined) {
  return Number.isFinite(inches) && inches && inches > 0
    ? inches
    : fallbackSpacingInches;
}
