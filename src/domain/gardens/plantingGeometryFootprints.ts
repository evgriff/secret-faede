import type {
  PlantingGeometryDimensions,
  PlantingGeometryDot,
  PlantingGeometryFootprint,
  PlantingGeometryMode,
} from './plantingGeometry';
import { roundFeet } from './plantingGeometryOffsets';

const minimumFootprintDimensionFt = 0.75;

export function getMinimumModeFootprint({
  center,
  dimensions,
  mode,
  plantDiameterFt,
  rowSpacingFt,
}: {
  center: { xFt: number; yFt: number };
  dimensions: PlantingGeometryDimensions;
  mode: PlantingGeometryMode;
  plantDiameterFt: number;
  rowSpacingFt: number;
}): PlantingGeometryFootprint {
  if (mode === 'row') {
    return centeredFootprint({
      center,
      depthFt: Math.max(rowSpacingFt, plantDiameterFt),
      widthFt: dimensions.rowLengthFt ?? 0,
    });
  }

  if (mode === 'block') {
    return centeredFootprint({
      center,
      depthFt: dimensions.blockDepthFt ?? 0,
      widthFt: dimensions.blockWidthFt ?? 0,
    });
  }

  const diameterFt = (dimensions.clusterRadiusFt ?? 0) * 2;

  return centeredFootprint({
    center,
    depthFt: diameterFt,
    widthFt: diameterFt,
  });
}

export function getFootprintFromDots(
  dots: PlantingGeometryDot[],
  plantDiameterFt: number,
): PlantingGeometryFootprint {
  const radiusFt = plantDiameterFt / 2;
  const left = Math.min(...dots.map((dot) => dot.xFt - radiusFt));
  const right = Math.max(...dots.map((dot) => dot.xFt + radiusFt));
  const top = Math.min(...dots.map((dot) => dot.yFt - radiusFt));
  const bottom = Math.max(...dots.map((dot) => dot.yFt + radiusFt));

  return {
    depthFt: roundFeet(Math.max(bottom - top, minimumFootprintDimensionFt)),
    widthFt: roundFeet(Math.max(right - left, minimumFootprintDimensionFt)),
    xFt: roundFeet(left),
    yFt: roundFeet(top),
  };
}

export function unionFootprints(
  left: PlantingGeometryFootprint,
  right: PlantingGeometryFootprint,
): PlantingGeometryFootprint {
  const xFt = Math.min(left.xFt, right.xFt);
  const yFt = Math.min(left.yFt, right.yFt);
  const rightEdgeFt = Math.max(
    left.xFt + left.widthFt,
    right.xFt + right.widthFt,
  );
  const bottomEdgeFt = Math.max(
    left.yFt + left.depthFt,
    right.yFt + right.depthFt,
  );

  return {
    depthFt: roundFeet(bottomEdgeFt - yFt),
    widthFt: roundFeet(rightEdgeFt - xFt),
    xFt: roundFeet(xFt),
    yFt: roundFeet(yFt),
  };
}

function centeredFootprint({
  center,
  depthFt,
  widthFt,
}: {
  center: { xFt: number; yFt: number };
  depthFt: number;
  widthFt: number;
}): PlantingGeometryFootprint {
  const normalizedWidthFt = Math.max(widthFt, minimumFootprintDimensionFt);
  const normalizedDepthFt = Math.max(depthFt, minimumFootprintDimensionFt);

  return {
    depthFt: roundFeet(normalizedDepthFt),
    widthFt: roundFeet(normalizedWidthFt),
    xFt: roundFeet(center.xFt - normalizedWidthFt / 2),
    yFt: roundFeet(center.yFt - normalizedDepthFt / 2),
  };
}
