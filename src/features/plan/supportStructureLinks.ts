import type { Garden } from '../../domain/gardens/GardenRepository';
import {
  canManuallyMovePlanting,
  canManuallyMoveStructure,
} from '../garden/gardenImmutability';
import { getPlanItemKey, type PlanItemRef } from './planInteractionGeometry';

export function canMoveLinkedPlanting(garden: Garden, plantingId: string) {
  const planting = garden.plantings.find(
    (candidate) => candidate.id === plantingId,
  );

  if (!planting || !canManuallyMovePlanting(planting)) {
    return false;
  }

  return planting.supportStructureIds.every((structureId) => {
    const structure = garden.structures.find(
      (candidate) => candidate.id === structureId,
    );

    return structure ? canManuallyMoveStructure(structure) : true;
  });
}

export function canMoveLinkedStructure(garden: Garden, structureId: string) {
  const structure = garden.structures.find(
    (candidate) => candidate.id === structureId,
  );

  if (!structure || !canManuallyMoveStructure(structure)) {
    return false;
  }

  return garden.plantings
    .filter((planting) => planting.supportStructureIds.includes(structureId))
    .every(canManuallyMovePlanting);
}

export function expandLinkedSupportSelection(
  garden: Garden,
  selection: PlanItemRef[],
) {
  const expanded: PlanItemRef[] = [];
  const queued = [...selection];
  const seen = new Set<string>();

  while (queued.length > 0) {
    const item = queued.shift();

    if (!item) {
      continue;
    }

    const key = getPlanItemKey(item);

    if (seen.has(key) || isLinkedItemLocked(garden, item)) {
      continue;
    }

    seen.add(key);
    expanded.push(item);

    if (item.type === 'planting' && !item.instanceId) {
      const planting = garden.plantings.find(
        (candidate) => candidate.id === item.id,
      );

      for (const structureId of planting?.supportStructureIds ?? []) {
        queued.push({ id: structureId, type: 'structure' });
      }
    }

    if (item.type === 'structure') {
      for (const planting of garden.plantings) {
        if (planting.supportStructureIds.includes(item.id)) {
          queued.push({ id: planting.id, type: 'planting' });
        }
      }
    }
  }

  return expanded;
}

function isLinkedItemLocked(garden: Garden, item: PlanItemRef) {
  return item.type === 'planting'
    ? !canMoveLinkedPlanting(garden, item.id)
    : !canMoveLinkedStructure(garden, item.id);
}
