import type { Garden, Structure } from '../../domain/gardens/GardenRepository';
import {
  getStructureFootprint,
  rectsOverlap,
  type FootRect,
} from '../garden/gardenPlanning';
import {
  getWalkablePathWidthFt,
  isBedLikeStructure,
  isMeaningfulAccessPath,
  isPathStructure,
  minimumStandardPathWidthFt,
  minimumWorkingAisleWidthFt,
} from '../garden/gardenStructureRules';
import { autoLayoutProposalMarker, type Placement } from './autoLayoutPlanner';
import type {
  AutoLayoutStrategy,
  AutoLayoutWholePlotPlan,
} from './autoLayoutTypes';

const preferredBedWidthFt = 4;
const compactPathWidthFt = 2;

export interface WholePlotPlanningContext {
  garden: Garden;
  proposedStructures: Structure[];
}

export function buildWholePlotPlanningContext(
  garden: Garden,
  strategy: AutoLayoutStrategy,
): WholePlotPlanningContext {
  const proposedStructures = buildAccessPathStructures(garden, strategy);

  return {
    garden:
      proposedStructures.length > 0
        ? {
            ...garden,
            structures: [...garden.structures, ...proposedStructures],
          }
        : garden,
    proposedStructures,
  };
}

export function buildWholePlotPlan({
  placements,
  proposedStructures,
}: {
  placements: Placement[];
  proposedStructures: Structure[];
}): AutoLayoutWholePlotPlan {
  return {
    accessPathIds: proposedStructures
      .filter(isPathStructure)
      .map((structure) => structure.id),
    heuristics: [
      ...summarizeAccessHeuristics(proposedStructures),
      ...summarizeTallCropHeuristics(placements),
      ...summarizeWaterHeuristics(placements),
    ],
    plantZones: buildPlantZones(placements),
  };
}

function buildAccessPathStructures(
  garden: Garden,
  strategy: AutoLayoutStrategy,
): Structure[] {
  const beds = garden.structures.filter(isBedLikeStructure);
  const meaningfulPaths = garden.structures.filter((structure) =>
    isMeaningfulAccessPath(structure, beds),
  );
  const usablePath = meaningfulPaths.some(
    (structure) =>
      getWalkablePathWidthFt(structure) >= minimumWorkingAisleWidthFt,
  );

  if (usablePath || meaningfulPaths.length > 0) {
    return [];
  }

  const pathWidthFt = getPlannedPathWidth(garden);

  if (!pathWidthFt) {
    return [];
  }

  return [
    createPathStructure(
      garden,
      chooseAccessPathRect(garden, pathWidthFt),
      strategy,
    ),
  ];
}

function getPlannedPathWidth(garden: Garden) {
  const narrowSide = Math.min(garden.plot.widthFt, garden.plot.depthFt);

  if (narrowSide >= minimumStandardPathWidthFt + preferredBedWidthFt) {
    return minimumStandardPathWidthFt;
  }

  return narrowSide >= compactPathWidthFt + preferredBedWidthFt
    ? compactPathWidthFt
    : null;
}

function chooseAccessPathRect(garden: Garden, widthFt: number): FootRect {
  const candidates = [
    {
      depthFt: garden.plot.depthFt,
      id: 'path-east',
      itemType: 'structure' as const,
      label: 'East access path',
      widthFt,
      xFt: garden.plot.widthFt - widthFt,
      yFt: 0,
    },
    {
      depthFt: garden.plot.depthFt,
      id: 'path-west',
      itemType: 'structure' as const,
      label: 'West access path',
      widthFt,
      xFt: 0,
      yFt: 0,
    },
    {
      depthFt: widthFt,
      id: 'path-south',
      itemType: 'structure' as const,
      label: 'South access path',
      widthFt: garden.plot.widthFt,
      xFt: 0,
      yFt: garden.plot.depthFt - widthFt,
    },
    {
      depthFt: widthFt,
      id: 'path-north',
      itemType: 'structure' as const,
      label: 'North access path',
      widthFt: garden.plot.widthFt,
      xFt: 0,
      yFt: 0,
    },
  ];
  const occupiedRects = garden.structures.map(getStructureFootprint);

  return [...candidates].sort(
    (left, right) =>
      scorePathCandidate(garden, right, occupiedRects) -
        scorePathCandidate(garden, left, occupiedRects) ||
      left.id.localeCompare(right.id),
  )[0] as FootRect;
}

function scorePathCandidate(
  garden: Garden,
  candidate: FootRect,
  occupiedRects: FootRect[],
) {
  const beds = garden.structures.filter(isBedLikeStructure);
  const bedAdjacency = beds.filter((bed) =>
    rectsOverlap(expandRect(getStructureFootprint(bed), 2), candidate),
  ).length;
  const overlapPenalty = occupiedRects.filter((rect) =>
    rectsOverlap(rect, candidate),
  ).length;

  return bedAdjacency * 8 - overlapPenalty * 20 + edgePathBias(candidate);
}

function createPathStructure(
  garden: Garden,
  rect: FootRect,
  strategy: AutoLayoutStrategy,
): Structure {
  return {
    accessiblePath: false,
    canopyRadiusFt: null,
    continuousPath: true,
    depthFt: rect.depthFt,
    drainageProfile: 'normal',
    heightFt: null,
    id: `${autoLayoutProposalMarker}-${strategy}-main-access-path`,
    irrigationZone: null,
    label: 'Main access path',
    locked: false,
    material: 'woodChips',
    mulched: true,
    notes: `${autoLayoutProposalMarker} Access path proposed so beds and dense plant zones stay reachable without stepping into planting areas.`,
    rotationDegrees: 0,
    soilType: 'unknown',
    type: 'pathway',
    widthFt: rect.widthFt,
    workingClearanceFt: null,
    xFt: Math.max(0, Math.min(rect.xFt, garden.plot.widthFt - rect.widthFt)),
    yFt: Math.max(0, Math.min(rect.yFt, garden.plot.depthFt - rect.depthFt)),
  };
}

function buildPlantZones(placements: Placement[]) {
  const byZone = new Map<string, Placement[]>();

  for (const placement of placements) {
    const zoneId = getZoneId(placement);
    byZone.set(zoneId, [...(byZone.get(zoneId) ?? []), placement]);
  }

  return [...byZone.entries()].map(([zoneId, zonePlacements]) => ({
    id: zoneId,
    label: getZoneLabel(zoneId),
    plantingIds: zonePlacements.map((placement) => placement.planting.id),
    rationale: summarizeZoneRationale(zonePlacements),
  }));
}

function getZoneId(placement: Placement) {
  const crop = placement.unit.crop;
  const light = crop.sunRequirement === 'fullSun' ? 'full-sun' : 'flex-sun';
  const water = crop.waterNeeds;
  const height =
    (crop.matureHeightInches ?? 0) >= 42 || crop.trellisRecommended
      ? 'tall'
      : 'low';

  return `${light}-${water}-${height}`;
}

function getZoneLabel(zoneId: string) {
  const parts = zoneId.split('-');
  const light = zoneId.startsWith('full-sun') ? 'Full-sun' : 'Flexible-sun';
  const water = parts.includes('high')
    ? 'high-water'
    : parts.includes('low')
      ? 'low-water'
      : 'medium-water';
  const height = zoneId.endsWith('tall') ? 'tall crops' : 'lower crops';

  return `${light} ${water} ${height}`;
}

function summarizeZoneRationale(placements: Placement[]) {
  const cropNames = placements.map(
    (placement) => placement.unit.crop.commonName,
  );
  const waterNeeds = [
    ...new Set(placements.map((placement) => placement.unit.crop.waterNeeds)),
  ];
  const sunNeeds = [
    ...new Set(
      placements.map((placement) => placement.unit.crop.sunRequirement),
    ),
  ];

  return `${cropNames.join(', ')} grouped by ${sunNeeds.join('/')} light and ${waterNeeds.join('/')} water needs.`;
}

function summarizeAccessHeuristics(structures: Structure[]) {
  const paths = structures.filter(isPathStructure);

  return paths.length > 0
    ? [
        `${paths.length} access path${paths.length === 1 ? '' : 's'} reserved before crop placement.`,
      ]
    : ['Existing paths or bed edges are used for access.'];
}

function summarizeTallCropHeuristics(placements: Placement[]) {
  const tallCount = placements.filter(
    (placement) =>
      (placement.unit.crop.matureHeightInches ?? 0) >= 42 ||
      placement.unit.crop.trellisRecommended,
  ).length;

  return tallCount > 0
    ? [
        `${tallCount} tall or trellised crop group${tallCount === 1 ? '' : 's'} biased north/up-sun.`,
      ]
    : ['No tall crop zone needed.'];
}

function summarizeWaterHeuristics(placements: Placement[]) {
  const waterZones = new Set(
    placements.map((placement) => placement.unit.crop.waterNeeds),
  );

  return [
    `${waterZones.size} water-need zone${waterZones.size === 1 ? '' : 's'} kept legible for maintenance.`,
  ];
}

function edgePathBias(rect: FootRect) {
  if (rect.id === 'path-east') {
    return 3;
  }

  if (rect.id === 'path-west') {
    return 2;
  }

  return rect.id === 'path-south' ? 1 : 0;
}

function expandRect(rect: FootRect, amountFt: number): FootRect {
  return {
    ...rect,
    depthFt: rect.depthFt + amountFt * 2,
    widthFt: rect.widthFt + amountFt * 2,
    xFt: rect.xFt - amountFt,
    yFt: rect.yFt - amountFt,
  };
}
