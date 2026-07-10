import type { GardenPlan, GardenStructure, PlantingGroup } from '../domain';

export interface PlanPoint {
  xFt: number;
  yFt: number;
}

const tolerance = 0.001;

export function plantingCorners(
  planting: Pick<PlantingGroup, 'depthFt' | 'widthFt' | 'xFt' | 'yFt'>,
): PlanPoint[] {
  const halfWidth = planting.widthFt / 2;
  const halfDepth = planting.depthFt / 2;
  return [
    { xFt: planting.xFt - halfWidth, yFt: planting.yFt - halfDepth },
    { xFt: planting.xFt + halfWidth, yFt: planting.yFt - halfDepth },
    { xFt: planting.xFt - halfWidth, yFt: planting.yFt + halfDepth },
    { xFt: planting.xFt + halfWidth, yFt: planting.yFt + halfDepth },
  ];
}

export function rotatedStructureCorners(
  structure: Pick<
    GardenStructure,
    'depthFt' | 'rotationDegrees' | 'widthFt' | 'xFt' | 'yFt'
  >,
): PlanPoint[] {
  const centerX = structure.xFt + structure.widthFt / 2;
  const centerY = structure.yFt + structure.depthFt / 2;
  const radians = (structure.rotationDegrees * Math.PI) / 180;
  return [
    [-structure.widthFt / 2, -structure.depthFt / 2],
    [structure.widthFt / 2, -structure.depthFt / 2],
    [-structure.widthFt / 2, structure.depthFt / 2],
    [structure.widthFt / 2, structure.depthFt / 2],
  ].map(([x = 0, y = 0]) => ({
    xFt: centerX + x * Math.cos(radians) - y * Math.sin(radians),
    yFt: centerY + x * Math.sin(radians) + y * Math.cos(radians),
  }));
}

export function structureFitsPlot(
  structure: GardenStructure,
  plot: Pick<GardenPlan['plot'], 'depthFt' | 'widthFt'>,
) {
  return rotatedStructureCorners(structure).every(
    (point) =>
      point.xFt >= -tolerance &&
      point.yFt >= -tolerance &&
      point.xFt <= plot.widthFt + tolerance &&
      point.yFt <= plot.depthFt + tolerance,
  );
}

export function structureContainsPlanting(
  structure: GardenStructure,
  planting: PlantingGroup,
) {
  return plantingCorners(planting).every((point) =>
    structureContainsPoint(structure, point),
  );
}

export function structureContainsPoint(
  structure: GardenStructure,
  point: PlanPoint,
) {
  const centerX = structure.xFt + structure.widthFt / 2;
  const centerY = structure.yFt + structure.depthFt / 2;
  const radians = (-structure.rotationDegrees * Math.PI) / 180;
  const deltaX = point.xFt - centerX;
  const deltaY = point.yFt - centerY;
  const localX = deltaX * Math.cos(radians) - deltaY * Math.sin(radians);
  const localY = deltaX * Math.sin(radians) + deltaY * Math.cos(radians);
  return (
    Math.abs(localX) <= structure.widthFt / 2 + tolerance &&
    Math.abs(localY) <= structure.depthFt / 2 + tolerance
  );
}
