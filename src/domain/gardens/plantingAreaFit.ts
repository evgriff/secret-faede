import type { Planting, PlantingInstance } from './models';

export interface PlantingAreaRect {
  depthFt: number;
  widthFt: number;
  xFt: number;
  yFt: number;
}

export interface PlantingAreaFitResult {
  columns: number;
  details: string;
  planting: Planting;
  rows: number;
}

const fallbackSpacingInches = 12;
const maxAutoFitPlantCount = 500;
const minimumDimensionFt = 0.25;

export function fitPlantingToAreaRect(
  planting: Planting,
  rect: PlantingAreaRect,
): PlantingAreaFitResult {
  const spacingFt = getSpacingFt(planting);
  const rowSpacingFt = getRowSpacingFt(planting, spacingFt);
  const plantDiameterFt = getPlantDiameterFt(planting);
  const normalizedRect = normalizeRect(rect);
  const usableWidthFt = Math.max(normalizedRect.widthFt - plantDiameterFt, 0);
  const usableDepthFt = Math.max(normalizedRect.depthFt - plantDiameterFt, 0);
  const fittedColumns = Math.max(Math.floor(usableWidthFt / spacingFt) + 1, 1);
  const fittedRows = Math.max(Math.floor(usableDepthFt / rowSpacingFt) + 1, 1);
  const { columns, plantCount, rows } = capGrid({
    columns: fittedColumns,
    rows: fittedRows,
  });
  const center = {
    xFt: roundFeet(normalizedRect.xFt + normalizedRect.widthFt / 2),
    yFt: roundFeet(normalizedRect.yFt + normalizedRect.depthFt / 2),
  };
  const fittedPlanting: Planting = {
    ...planting,
    blockDepthFt:
      rows > 1
        ? roundFeet(Math.max(normalizedRect.depthFt - plantDiameterFt, 0))
        : normalizedRect.depthFt,
    blockWidthFt:
      columns > 1
        ? roundFeet(Math.max(normalizedRect.widthFt - plantDiameterFt, 0))
        : normalizedRect.widthFt,
    clusterRadiusFt: null,
    instances: createAreaInstances({
      columns,
      plantDiameterFt,
      planting,
      rect: normalizedRect,
      rows,
    }),
    mode: 'block',
    plantCount,
    rowCount: rows,
    rowLengthFt: null,
    trellisLengthFt: null,
    xFt: center.xFt,
    yFt: center.yFt,
  };

  return {
    columns,
    details: `${plantCount} ${plantCount === 1 ? 'plant' : 'plants'} fit at ${formatInches(
      spacingFt * 12,
    )} in spacing.`,
    planting: fittedPlanting,
    rows,
  };
}

function createAreaInstances({
  columns,
  plantDiameterFt,
  planting,
  rect,
  rows,
}: {
  columns: number;
  plantDiameterFt: number;
  planting: Planting;
  rect: PlantingAreaRect;
  rows: number;
}): PlantingInstance[] {
  const plantCount = columns * rows;
  const leftCenter = rect.xFt + Math.min(plantDiameterFt / 2, rect.widthFt / 2);
  const rightCenter =
    rect.xFt + rect.widthFt - Math.min(plantDiameterFt / 2, rect.widthFt / 2);
  const topCenter = rect.yFt + Math.min(plantDiameterFt / 2, rect.depthFt / 2);
  const bottomCenter =
    rect.yFt + rect.depthFt - Math.min(plantDiameterFt / 2, rect.depthFt / 2);
  const xStep = columns > 1 ? (rightCenter - leftCenter) / (columns - 1) : 0;
  const yStep = rows > 1 ? (bottomCenter - topCenter) / (rows - 1) : 0;
  const singleX = rect.xFt + rect.widthFt / 2;
  const singleY = rect.yFt + rect.depthFt / 2;

  return Array.from({ length: plantCount }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    return {
      id: `${planting.id}-plant-${index + 1}`,
      label:
        plantCount === 1 ? planting.label : `${planting.label} ${index + 1}`,
      xFt: roundFeet(columns === 1 ? singleX : leftCenter + column * xStep),
      yFt: roundFeet(rows === 1 ? singleY : topCenter + row * yStep),
    };
  });
}

function capGrid({ columns, rows }: { columns: number; rows: number }) {
  if (columns * rows <= maxAutoFitPlantCount) {
    return { columns, plantCount: columns * rows, rows };
  }

  const cappedColumns = Math.min(columns, maxAutoFitPlantCount);
  const cappedRows = Math.max(
    Math.floor(maxAutoFitPlantCount / cappedColumns),
    1,
  );

  return {
    columns: cappedColumns,
    plantCount: cappedColumns * cappedRows,
    rows: cappedRows,
  };
}

function getSpacingFt(planting: Planting) {
  return Math.max(
    normalizeInches(
      planting.spacingInches ??
        planting.matureSpreadInches ??
        fallbackSpacingInches,
    ) / 12,
    0.125,
  );
}

function getRowSpacingFt(planting: Planting, fallbackSpacingFt: number) {
  if (planting.rowSpacingInches && planting.rowSpacingInches > 0) {
    return Math.max(planting.rowSpacingInches / 12, 0.125);
  }

  if (planting.rowSpacingFt && planting.rowSpacingFt > 0) {
    return Math.max(planting.rowSpacingFt, 0.125);
  }

  return fallbackSpacingFt;
}

function getPlantDiameterFt(planting: Planting) {
  return Math.max(
    normalizeInches(
      planting.spacingInches ??
        planting.matureSpreadInches ??
        fallbackSpacingInches,
    ) / 12,
    0.75,
  );
}

function normalizeRect(rect: PlantingAreaRect): PlantingAreaRect {
  return {
    depthFt: roundFeet(Math.max(rect.depthFt, minimumDimensionFt)),
    widthFt: roundFeet(Math.max(rect.widthFt, minimumDimensionFt)),
    xFt: roundFeet(rect.xFt),
    yFt: roundFeet(rect.yFt),
  };
}

function normalizeInches(inches: number | null | undefined) {
  return Number.isFinite(inches) && inches && inches > 0
    ? inches
    : fallbackSpacingInches;
}

function formatInches(inches: number) {
  return Number.isInteger(inches) ? String(inches) : inches.toFixed(1);
}

function roundFeet(value: number) {
  return Number(value.toFixed(3));
}
