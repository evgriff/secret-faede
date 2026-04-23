import type {
  Garden,
  Planting,
  Structure,
} from '../../domain/gardens/GardenRepository';
import { canOptimizerMovePlanting } from '../garden/gardenImmutability';
import { isAutoLayoutItem } from './autoLayoutPlanner';
import type { AutoLayoutCandidate } from './autoLayoutTypes';

export function applyAutoLayoutCandidateToGarden(
  garden: Garden,
  candidate: AutoLayoutCandidate,
): Garden {
  return {
    ...garden,
    plantings: [
      ...garden.plantings.filter(
        (planting) => !isReplaceableAutoLayoutPlanting(planting),
      ),
      ...candidate.plantings,
    ],
    structures: [
      ...garden.structures.filter(
        (structure) => !isReplaceableAutoLayoutStructure(structure),
      ),
      ...candidate.structures,
    ],
  };
}

export function isReplaceableAutoLayoutPlanting(planting: Planting) {
  return isAutoLayoutItem(planting) && canOptimizerMovePlanting(planting);
}

export function isReplaceableAutoLayoutStructure(structure: Structure) {
  return isAutoLayoutItem(structure) && !structure.locked;
}
