import type {
  Planting,
  PlantingLifecycleStatus,
  Structure,
} from '../../domain/gardens/GardenRepository';

export type RelocationImpact = 'none' | 'physicalMove' | 'plannedOnly';

const realWorldPlantingStatuses = new Set<PlantingLifecycleStatus>([
  'planted',
  'growing',
  'harvest-ready',
]);

export function isRealWorldPlantingStatus(status: PlantingLifecycleStatus) {
  return realWorldPlantingStatuses.has(status);
}

export function doesPlantingReserveSpace(planting: Planting) {
  return planting.status !== 'harvested' && planting.status !== 'removed';
}

export function isPlantingAnchoredByLifecycle(planting: Planting) {
  return (
    doesPlantingReserveSpace(planting) &&
    isRealWorldPlantingStatus(planting.status) &&
    !planting.allowRelocation
  );
}

export function canManuallyMovePlanting(planting: Planting) {
  return !planting.locked && !isPlantingAnchoredByLifecycle(planting);
}

export function canOptimizerMovePlanting(planting: Planting) {
  if (planting.locked || !doesPlantingReserveSpace(planting)) {
    return false;
  }

  return planting.status === 'planned' || Boolean(planting.allowRelocation);
}

export function isPlantingAnchoredForOptimizer(planting: Planting) {
  return (
    doesPlantingReserveSpace(planting) && !canOptimizerMovePlanting(planting)
  );
}

export function canManuallyMoveStructure(structure: Structure) {
  return !structure.locked;
}

export function getPlantingRelocationImpact(planting: Planting) {
  if (!doesPlantingReserveSpace(planting)) {
    return 'none';
  }

  return isRealWorldPlantingStatus(planting.status)
    ? 'physicalMove'
    : 'plannedOnly';
}

export function describePlantingMobility(planting: Planting) {
  if (planting.locked) {
    return 'Locked in place';
  }

  if (!doesPlantingReserveSpace(planting)) {
    return 'Space released';
  }

  if (isRealWorldPlantingStatus(planting.status)) {
    return planting.allowRelocation
      ? 'Relocation explicitly allowed'
      : 'Anchored in real garden';
  }

  return 'Movable plan';
}

export function describePlantingOptimizerMobility(planting: Planting) {
  if (!doesPlantingReserveSpace(planting)) {
    return 'Freed for planning';
  }

  if (canOptimizerMovePlanting(planting)) {
    return planting.status === 'planned'
      ? 'Optimizer may relocate'
      : 'Optimizer relocation allowed';
  }

  return isRealWorldPlantingStatus(planting.status)
    ? 'Optimizer keeps anchored'
    : 'Optimizer blocked';
}
