import type {
  GardenPlant,
  GardenPlot,
  Structure,
} from '../../domain/gardens/GardenRepository';

export const pixelsPerFoot = 32;
export const minPlotFeet = 1;
export const maxPlotFeet = 100;
const feetPrecision = 3;

export interface PlotPoint {
  xFt: number;
  yFt: number;
}

export interface PlotClientRect {
  left: number;
  top: number;
  width?: number;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function clampPlotDimension(value: number) {
  return Math.round(clamp(value, minPlotFeet, maxPlotFeet));
}

export function snapFeet(value: number, snapUnitFt: number) {
  return Math.round(value / snapUnitFt) * snapUnitFt;
}

export function normalizePointToPlot(
  point: PlotPoint,
  plot: GardenPlot,
  snap = false,
): PlotPoint {
  const xFt = snap ? snapFeet(point.xFt, plot.snapUnitFt) : point.xFt;
  const yFt = snap ? snapFeet(point.yFt, plot.snapUnitFt) : point.yFt;

  return {
    xFt: clamp(roundFeetForStorage(xFt), 0, plot.widthFt),
    yFt: clamp(roundFeetForStorage(yFt), 0, plot.depthFt),
  };
}

export function clampPlantToPlot(
  plant: GardenPlant,
  plot: GardenPlot,
): GardenPlant {
  const point = normalizePointToPlot(plant, plot, true);

  return {
    ...plant,
    xFt: point.xFt,
    yFt: point.yFt,
  };
}

export function clampStructureToPlot(
  structure: Structure,
  plot: GardenPlot,
  snap = true,
): Structure {
  const widthFt = clamp(structure.widthFt, 0.25, plot.widthFt);
  const depthFt = clamp(structure.depthFt, 0.25, plot.depthFt);
  const rawXFt = clamp(structure.xFt, 0, Math.max(plot.widthFt - widthFt, 0));
  const rawYFt = clamp(structure.yFt, 0, Math.max(plot.depthFt - depthFt, 0));
  const xFt = snap ? snapFeet(rawXFt, plot.snapUnitFt) : rawXFt;
  const yFt = snap ? snapFeet(rawYFt, plot.snapUnitFt) : rawYFt;

  return {
    ...structure,
    depthFt,
    widthFt,
    xFt: clamp(
      roundFeetForStorage(xFt),
      0,
      Math.max(plot.widthFt - widthFt, 0),
    ),
    yFt: clamp(
      roundFeetForStorage(yFt),
      0,
      Math.max(plot.depthFt - depthFt, 0),
    ),
  };
}

export function clientPointToPlotFeet(
  clientPoint: { clientX: number; clientY: number },
  rect: PlotClientRect,
  plot: GardenPlot,
): PlotPoint {
  const effectivePixelsPerFoot =
    rect.width && rect.width > 0 ? rect.width / plot.widthFt : pixelsPerFoot;

  return normalizePointToPlot(
    {
      xFt: (clientPoint.clientX - rect.left) / effectivePixelsPerFoot,
      yFt: (clientPoint.clientY - rect.top) / effectivePixelsPerFoot,
    },
    plot,
  );
}

export function plotFeetToPixels(point: PlotPoint): {
  left: number;
  top: number;
} {
  return {
    left: point.xFt * pixelsPerFoot,
    top: point.yFt * pixelsPerFoot,
  };
}

export function formatFeet(value: number) {
  return value.toFixed(1);
}

function roundFeetForStorage(value: number) {
  return Number(value.toFixed(feetPrecision));
}
