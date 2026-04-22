import type {
  Garden,
  Planting,
  Structure,
} from '../../domain/gardens/GardenRepository';
import { isPlantingAnchoredForOptimizer } from '../garden/gardenImmutability';
import { getStrategyLabel, type LayoutUnit } from './autoLayoutPlanner';
import type { ScoredPlacement } from './autoLayoutScoring';
import type {
  AutoLayoutCandidate,
  AutoLayoutStrategy,
} from './autoLayoutTypes';

export function buildExplanations(
  strategy: AutoLayoutStrategy,
  placements: ScoredPlacement[],
  structures: Structure[],
) {
  const tallCount = placements.filter(
    (placement) => (placement.crop.matureHeightInches ?? 0) >= 42,
  ).length;

  return [
    `${getStrategyLabel(strategy)} placed ${placements.length} crop footprint${placements.length === 1 ? '' : 's'} using deterministic greedy placement plus local search.`,
    'Sun fit, seasonal suitability, crop height, access paths, saved beds, spacing, water grouping, and support needs all contribute to the score.',
    tallCount > 0
      ? `${tallCount} tall/support crop${tallCount === 1 ? '' : 's'} biased toward the north side to reduce shade penalties.`
      : 'No tall-crop shade risk dominated this candidate.',
    structures.length > 0
      ? `${structures.length} support structure${structures.length === 1 ? '' : 's'} proposed instead of leaving trellis needs implicit.`
      : 'Existing structures or selected crops did not require new support structures.',
  ];
}

export function buildTradeoffs(
  strategy: AutoLayoutStrategy,
  unplaced: AutoLayoutCandidate['unplaced'],
  breakdown: AutoLayoutCandidate['scoreBreakdown'],
  anchoredPlantings: Planting[],
) {
  return [
    strategy === 'accessFirst'
      ? 'Access-first may give up a little sun score for easier harvest and watering.'
      : strategy === 'supportFirst'
        ? 'Support-first keeps tall and trellised crops disciplined, even if some shorter crops move farther from paths.'
        : 'Sun-first maximizes light fit first, then resolves support and access.',
    breakdown.waterGrouping < 0.72
      ? 'Water grouping is mixed; similar water needs were kept together only where space allowed.'
      : 'Water needs are grouped where practical without forcing bad sun placement.',
    breakdown.spacingQuality < 0.82
      ? 'Spacing is legal but tight in places; inspect quantities before accepting.'
      : 'Mature spacing has legal clearance for the generated footprints.',
    breakdown.seasonalSuitability < 0.72
      ? 'At least one crop has season or climate caution carried through from Choose Plants.'
      : 'Season fit is strong enough for the selected crop list.',
    unplaced.length > 0
      ? `${unplaced.length} requested crop footprint${unplaced.length === 1 ? '' : 's'} could not be placed legally.`
      : 'All requested crop footprints found legal positions.',
    anchoredPlantings.length > 0
      ? `${anchoredPlantings.length} planted or growing crop${anchoredPlantings.length === 1 ? '' : 's'} stayed anchored, so the proposal works around real garden positions.`
      : 'No planted or growing crop constrained this proposal.',
    'This is a heuristic proposal, not a precision yield guarantee.',
  ];
}

export function buildMaterials(
  placements: ScoredPlacement[],
  structures: Structure[],
) {
  const supportMaterials = structures.map(
    (structure) =>
      `${structure.label}: ${structure.widthFt.toFixed(1)} ft trellis/support`,
  );
  const seeds = placements.map((placement) => {
    const method =
      placement.crop.sowMethod === 'transplant'
        ? 'starts'
        : placement.crop.sowMethod === 'directSow'
          ? 'seed'
          : 'seed or starts';

    return `${placement.planting.label}: ${Math.max(
      placement.planting.plantCount ?? 1,
      1,
    )} ${method}`;
  });

  return [...supportMaterials, ...seeds].slice(0, 8);
}

export function getAnchoredOptimizerPlantings(garden: Garden) {
  return garden.plantings.filter(isPlantingAnchoredForOptimizer);
}

export function getUnplacedReason(
  unit: LayoutUnit,
  anchoredPlantings: Planting[],
) {
  if (!unit.request.supportAllowed) {
    return 'Support was disabled for a crop that needs it.';
  }

  if (anchoredPlantings.length > 0) {
    return 'No legal open cell had enough space around already planted or growing crops.';
  }

  return 'No legal bed, container, or open cell had enough space.';
}
