import type {
  Garden,
  Planting,
  Structure,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import {
  findPlanWarnings,
  getPlantingFootprint,
  getStructureFootprint,
  isActivePlanWarning,
  type FootRect,
  type PlanWarning,
} from '../garden/gardenPlanning';
import type { SunSeason } from '../garden/sunShadeEngine';
import { isAutoLayoutItem } from './autoLayoutPlanner';
import {
  applyAutoLayoutCandidateToGarden,
  isReplaceableAutoLayoutPlanting,
  isReplaceableAutoLayoutStructure,
} from './autoLayoutCandidateGarden';
import type { AutoLayoutCandidate } from './autoLayoutTypes';

export { applyAutoLayoutCandidateToGarden } from './autoLayoutCandidateGarden';

export type AutoLayoutPreviewChangeKind =
  | 'added'
  | 'moved'
  | 'removed'
  | 'unchanged';

export interface AutoLayoutPreviewRect {
  id: string;
  itemType: 'planting' | 'structure';
  kind: AutoLayoutPreviewChangeKind;
  label: string;
  rect: FootRect;
}

export interface AutoLayoutProposalPreview {
  afterRects: AutoLayoutPreviewRect[];
  beforeRects: AutoLayoutPreviewRect[];
  summary: {
    addedCount: number;
    introducedWarnings: string[];
    movedCount: number;
    removedCount: number;
    supportAdditions: number;
    totalAfterWarnings: number;
    totalBeforeWarnings: number;
    avoidedWarnings: string[];
  };
}

export function buildAutoLayoutProposalPreview({
  candidate,
  currentWarnings,
  garden,
  sunLayer,
  sunSeason,
}: {
  candidate: AutoLayoutCandidate;
  currentWarnings: PlanWarning[];
  garden: Garden;
  sunLayer: SunShadeLayer | null;
  sunSeason: SunSeason;
}): AutoLayoutProposalPreview {
  const afterGarden = applyAutoLayoutCandidateToGarden(garden, candidate);
  const nextWarnings = findPlanWarnings(afterGarden, {
    ...(sunLayer ? { sunLayer } : {}),
    sunSeason,
  });
  const beforeRects = [
    ...garden.plantings.map((planting) =>
      toPlantingPreviewRect(
        planting,
        getBeforePlantingKind(planting, candidate),
      ),
    ),
    ...garden.structures.map((structure) =>
      toStructurePreviewRect(
        structure,
        getBeforeStructureKind(structure, candidate),
      ),
    ),
  ];
  const afterRects = [
    ...afterGarden.plantings.map((planting) =>
      toPlantingPreviewRect(planting, getAfterPlantingKind(garden, planting)),
    ),
    ...afterGarden.structures.map((structure) =>
      toStructurePreviewRect(
        structure,
        getAfterStructureKind(garden, structure),
      ),
    ),
  ];

  return {
    afterRects,
    beforeRects,
    summary: {
      addedCount: afterRects.filter((rect) => rect.kind === 'added').length,
      avoidedWarnings: diffWarnings(currentWarnings, nextWarnings),
      introducedWarnings: diffWarnings(nextWarnings, currentWarnings),
      movedCount: afterRects.filter((rect) => rect.kind === 'moved').length,
      removedCount: beforeRects.filter((rect) => rect.kind === 'removed')
        .length,
      supportAdditions:
        candidate.structures.filter(
          (structure) =>
            structure.type === 'trellis' &&
            !hasMatchingStructure(garden.structures, structure),
        ).length + countPlantLevelSupportAssignments(candidate.plantings),
      totalAfterWarnings: countActiveWarnings(nextWarnings),
      totalBeforeWarnings: countActiveWarnings(currentWarnings),
    },
  };
}

function countPlantLevelSupportAssignments(plantings: Planting[]) {
  return plantings.filter(
    (planting) =>
      planting.support.type !== 'none' && planting.support.quantity > 0,
  ).length;
}

function getBeforePlantingKind(
  planting: Planting,
  candidate: AutoLayoutCandidate,
): AutoLayoutPreviewChangeKind {
  if (!isReplaceableAutoLayoutPlanting(planting)) {
    return 'unchanged';
  }

  const match = candidate.plantings.find(
    (candidatePlanting) =>
      plantingKey(candidatePlanting) === plantingKey(planting),
  );

  if (!match) {
    return 'removed';
  }

  return samePlantingGeometry(planting, match) ? 'unchanged' : 'moved';
}

function getAfterPlantingKind(
  garden: Garden,
  planting: Planting,
): AutoLayoutPreviewChangeKind {
  const match = garden.plantings.find(
    (currentPlanting) =>
      isReplaceableAutoLayoutPlanting(currentPlanting) &&
      plantingKey(currentPlanting) === plantingKey(planting),
  );

  if (!isAutoLayoutItem(planting)) {
    return 'unchanged';
  }

  if (!match) {
    return 'added';
  }

  return samePlantingGeometry(match, planting) ? 'unchanged' : 'moved';
}

function getBeforeStructureKind(
  structure: Structure,
  candidate: AutoLayoutCandidate,
): AutoLayoutPreviewChangeKind {
  if (!isReplaceableAutoLayoutStructure(structure)) {
    return 'unchanged';
  }

  const match = candidate.structures.find(
    (candidateStructure) =>
      structureKey(candidateStructure) === structureKey(structure),
  );

  if (!match) {
    return 'removed';
  }

  return sameStructureGeometry(structure, match) ? 'unchanged' : 'moved';
}

function getAfterStructureKind(
  garden: Garden,
  structure: Structure,
): AutoLayoutPreviewChangeKind {
  const match = garden.structures.find(
    (currentStructure) =>
      isReplaceableAutoLayoutStructure(currentStructure) &&
      structureKey(currentStructure) === structureKey(structure),
  );

  if (!isAutoLayoutItem(structure)) {
    return 'unchanged';
  }

  if (!match) {
    return 'added';
  }

  return sameStructureGeometry(match, structure) ? 'unchanged' : 'moved';
}

function toPlantingPreviewRect(
  planting: Planting,
  kind: AutoLayoutPreviewChangeKind,
): AutoLayoutPreviewRect {
  return {
    id: planting.id,
    itemType: 'planting',
    kind,
    label: planting.label,
    rect: getPlantingFootprint(planting),
  };
}

function toStructurePreviewRect(
  structure: Structure,
  kind: AutoLayoutPreviewChangeKind,
): AutoLayoutPreviewRect {
  return {
    id: structure.id,
    itemType: 'structure',
    kind,
    label: structure.label,
    rect: getStructureFootprint(structure),
  };
}

function samePlantingGeometry(left: Planting, right: Planting) {
  return (
    sameNumber(left.xFt, right.xFt) &&
    sameNumber(left.yFt, right.yFt) &&
    sameNumber(left.blockWidthFt ?? 0, right.blockWidthFt ?? 0) &&
    sameNumber(left.blockDepthFt ?? 0, right.blockDepthFt ?? 0) &&
    sameNumber(left.rowLengthFt ?? 0, right.rowLengthFt ?? 0)
  );
}

function sameStructureGeometry(left: Structure, right: Structure) {
  return (
    sameNumber(left.xFt, right.xFt) &&
    sameNumber(left.yFt, right.yFt) &&
    sameNumber(left.widthFt, right.widthFt) &&
    sameNumber(left.depthFt, right.depthFt)
  );
}

function sameNumber(left: number, right: number) {
  return Math.abs(left - right) < 0.01;
}

function plantingKey(planting: Planting) {
  return [
    planting.cropId,
    planting.label.toLowerCase(),
    planting.mode,
    planting.plantCount ?? '',
  ].join(':');
}

function structureKey(structure: Structure) {
  return [
    structure.type,
    structure.label.toLowerCase().replace(/\s+support$/, ''),
  ].join(':');
}

function hasMatchingStructure(structures: Structure[], structure: Structure) {
  return structures.some(
    (currentStructure) =>
      isReplaceableAutoLayoutStructure(currentStructure) &&
      structureKey(currentStructure) === structureKey(structure),
  );
}

function diffWarnings(left: PlanWarning[], right: PlanWarning[]) {
  const rightKeys = new Set(right.filter(isActivePlanWarning).map(warningKey));

  return uniqueLabels(
    left.filter(isActivePlanWarning).filter((warning) => {
      return !rightKeys.has(warningKey(warning));
    }),
  );
}

function warningKey(warning: PlanWarning) {
  return `${warning.kind}:${warning.title}`;
}

function uniqueLabels(warnings: PlanWarning[]) {
  return [...new Set(warnings.map((warning) => warning.title))].slice(0, 4);
}

function countActiveWarnings(warnings: PlanWarning[]) {
  return warnings.filter(isActivePlanWarning).length;
}
