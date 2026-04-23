import type {
  Garden,
  Planting,
  PlantSupportPlan,
  Structure,
} from '../../domain/gardens/GardenRepository';
import { isPlantingAnchoredForOptimizer } from '../garden/gardenImmutability';
import {
  getSupportLabel,
  getWalkablePathWidthFt,
  isPathStructure,
} from '../garden/gardenStructureRules';
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

  const trellisCount = structures.filter(
    (structure) => structure.type === 'trellis',
  ).length;
  const pathCount = structures.filter(isPathStructure).length;
  const plantSupportCount = countPlantLevelSupports(placements);

  return [
    `${getStrategyLabel(strategy)} placed ${placements.length} crop footprint${placements.length === 1 ? '' : 's'}.`,
    'Checked plot bounds, saved structures, anchors, spacing, sun, and support clearance.',
    tallCount > 0
      ? `${tallCount} tall or trellised crop${tallCount === 1 ? '' : 's'} kept north where possible.`
      : 'No tall crop drove the layout.',
    plantSupportCount > 0
      ? `${plantSupportCount} plant-level support assignment${plantSupportCount === 1 ? '' : 's'} proposed as crop attributes.`
      : 'No plant-level cage or stake assignment needed.',
    trellisCount > 0
      ? `${trellisCount} trellis structure${trellisCount === 1 ? '' : 's'} proposed on the grid.`
      : 'No new trellis structures needed.',
    pathCount > 0
      ? `${pathCount} access path${pathCount === 1 ? '' : 's'} proposed before placement.`
      : 'No new access path structure needed.',
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
      ? 'This favors open paths and reachable edges over perfect sun.'
      : strategy === 'supportFirst'
        ? 'This favors crops with support needs before filling remaining space.'
        : 'This favors the sunniest legal cells, then checks support and access.',
    breakdown.waterGrouping < 0.72
      ? 'Water grouping is mixed where space was tight.'
      : 'Water needs are grouped where practical.',
    breakdown.spacingQuality < 0.82
      ? 'Spacing is legal but tight; inspect quantities.'
      : 'Mature spacing has legal clearance.',
    breakdown.seasonalSuitability < 0.72
      ? 'At least one crop keeps a season or climate caution.'
      : 'Season fit is strong enough.',
    unplaced.length > 0
      ? `${unplaced.length} crop footprint${unplaced.length === 1 ? '' : 's'} could not be placed.`
      : 'All crop footprints found legal positions.',
    anchoredPlantings.length > 0
      ? `${anchoredPlantings.length} planted/growing crop${anchoredPlantings.length === 1 ? '' : 's'} stayed anchored.`
      : 'No planted or growing crop constrained this proposal.',
    'Review the plot before applying; this is a practical layout proposal, not a yield promise.',
  ];
}

export function buildMaterials(
  placements: ScoredPlacement[],
  structures: Structure[],
) {
  const supportMaterials = structures
    .filter((structure) => structure.type === 'trellis')
    .map(
      (structure) =>
        `${structure.label}: ${structure.widthFt.toFixed(1)} ft trellis`,
    );
  const pathMaterials = structures
    .filter(isPathStructure)
    .map(
      (structure) =>
        `${structure.label}: ${getWalkablePathWidthFt(structure).toFixed(1)} ft walkable path`,
    );
  const plantSupports = placements.flatMap((placement) => {
    const support = summarizePlantLevelSupport(placement.planting.support);

    return support ? [`${placement.planting.label}: ${support}`] : [];
  });
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

  return [
    ...supportMaterials,
    ...plantSupports,
    ...pathMaterials,
    ...seeds,
  ].slice(0, 8);
}

function countPlantLevelSupports(placements: ScoredPlacement[]) {
  return placements.filter(
    (placement) =>
      summarizePlantLevelSupport(placement.planting.support) !== null,
  ).length;
}

function summarizePlantLevelSupport(support: PlantSupportPlan) {
  if (support.type === 'none' || support.quantity <= 0) {
    return null;
  }

  if (support.type !== 'cage' && support.type !== 'stake') {
    return null;
  }

  const label = getSupportLabel(support.type);

  return `${support.quantity} ${label}${support.quantity === 1 ? '' : 's'}`;
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
    return 'No legal open cell fit around anchored crops.';
  }

  return 'No legal bed, container, or open cell had space.';
}
