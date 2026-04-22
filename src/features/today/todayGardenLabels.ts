import type {
  Garden,
  Planting,
  Structure,
} from '../../domain/gardens/GardenRepository';

export function getBedLabelForPlanting(garden: Garden, planting: Planting) {
  const bed = garden.structures.find(
    (structure) =>
      isBedLike(structure) && containsPlanting(structure, planting),
  );

  return bed?.label ?? 'Open plot';
}

function isBedLike(structure: Structure) {
  return (
    structure.type === 'bed' ||
    structure.type === 'container' ||
    structure.type === 'inGroundBed' ||
    structure.type === 'raisedBed'
  );
}

function containsPlanting(structure: Structure, planting: Planting) {
  return (
    planting.xFt >= structure.xFt &&
    planting.xFt <= structure.xFt + structure.widthFt &&
    planting.yFt >= structure.yFt &&
    planting.yFt <= structure.yFt + structure.depthFt
  );
}
