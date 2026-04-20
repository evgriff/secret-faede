import type {
  GardenPlant,
  GardenPlot,
} from '../../domain/gardens/GardenRepository';

export const pixelsPerFoot = 32;
export const minPlotFeet = 1;
export const maxPlotFeet = 100;

export interface PlotPoint {
  xFt: number;
  yFt: number;
}

export interface PlotClientRect {
  left: number;
  top: number;
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
    xFt: clamp(Number(xFt.toFixed(2)), 0, plot.widthFt),
    yFt: clamp(Number(yFt.toFixed(2)), 0, plot.depthFt),
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

export function clientPointToPlotFeet(
  clientPoint: { clientX: number; clientY: number },
  rect: PlotClientRect,
  plot: GardenPlot,
): PlotPoint {
  return normalizePointToPlot(
    {
      xFt: (clientPoint.clientX - rect.left) / pixelsPerFoot,
      yFt: (clientPoint.clientY - rect.top) / pixelsPerFoot,
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
