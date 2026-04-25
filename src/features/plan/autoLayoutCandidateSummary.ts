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
    (placement) =>
      (placement.crop.matureHeightInches ?? 0) >= 42 ||
      placement.crop.trellisRecommended ||
      placement.crop.trellisRequired,
  ).length;

  const trellisCount = structures.filter(
    (structure) => structure.type === 'trellis',
  ).length;
  const pathCount = structures.filter(isPathStructure).length;
  const plantSupportCount = countPlantLevelSupports(placements);

  return [
    `${getStrategyLabel(strategy)} placed ${placements.length} crop footprint${placements.length === 1 ? '' : 's'}.`,
    'Checked plot bounds, bed fit, saved structures, access, spacing, and support clearance.',
    tallCount > 0
      ? `${tallCount} tall or trellised crop${tallCount === 1 ? '' : 's'} kept where support stays straightforward.`
      : 'No tall crop drove support spacing.',
    plantSupportCount > 0
      ? `${plantSupportCount} extra cage or stake setup${plantSupportCount === 1 ? '' : 's'} added only where the crop truly needed it.`
      : 'No extra cage or stake setup was added just to make the layout work.',
    trellisCount > 0
      ? `${trellisCount} trellis structure${trellisCount === 1 ? '' : 's'} added where a saved support line helps.`
      : 'No new trellis structures needed.',
    pathCount > 0
      ? `${pathCount} clear walking edge${pathCount === 1 ? '' : 's'} reserved before placement.`
      : 'No new path was needed to keep the plan workable.',
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
      ? 'This keeps a clearer route open for weeding, harvest, and watering.'
      : strategy === 'supportFirst'
        ? 'This puts support-hungry crops where setup stays simple.'
        : 'This keeps similar watering needs together without crowding the work lanes.',
    breakdown.waterGrouping < 0.72
      ? 'Watering stays mixed where space was tight.'
      : 'Watering needs stay grouped where practical.',
    breakdown.spacingQuality < 0.82
      ? 'Spacing is legal but tight; inspect quantities.'
      : 'Mature spacing has legal clearance.',
    breakdown.accessQuality < 0.72
      ? 'Some groups are still workable, but the reach is tighter than ideal.'
      : 'Most groups keep a clear route from a path or working edge.',
    breakdown.structureCompatibility < 0.82
      ? 'At least one support-needing crop still needs a quick setup check.'
      : 'Existing trellises and easy support spots stay usable.',
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
