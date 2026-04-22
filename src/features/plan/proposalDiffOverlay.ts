import type {
  Garden,
  Planting,
  Structure,
  SunShadeLayer,
} from '../../domain/gardens/GardenRepository';
import {
  applyReviewSuggestionActions,
  type ReviewSuggestion,
} from '../garden/reviewSuggestionModel';
import {
  getPlantingFootprint,
  getStructureFootprint,
  type FootRect,
  type PlanWarning,
} from '../garden/gardenPlanning';
import type { SunSeason } from '../garden/sunShadeEngine';
import {
  buildAutoLayoutProposalPreview,
  type AutoLayoutPreviewChangeKind,
  type AutoLayoutPreviewRect,
} from './autoLayoutProposalDiff';
import type { AutoLayoutCandidate } from './autoLayoutTypes';

export interface ProposalDiffConnector {
  from: { xFt: number; yFt: number };
  id: string;
  to: { xFt: number; yFt: number };
}

export interface ProposalDiffOverlayModel {
  afterRects: AutoLayoutPreviewRect[];
  beforeRects: AutoLayoutPreviewRect[];
  connectors: ProposalDiffConnector[];
  summary: {
    addedCount: number;
    movedCount: number;
    removedCount: number;
  };
  title: string;
}

export function buildAutoLayoutProposalDiffOverlay({
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
}): ProposalDiffOverlayModel {
  const preview = buildAutoLayoutProposalPreview({
    candidate,
    currentWarnings,
    garden,
    sunLayer,
    sunSeason,
  });

  return toOverlayModel(`${candidate.label} proposal`, preview);
}

export function buildReviewSuggestionDiffOverlay({
  garden,
  suggestion,
}: {
  garden: Garden;
  suggestion: ReviewSuggestion;
}): ProposalDiffOverlayModel {
  const afterGarden = applyReviewSuggestionActions(garden, suggestion.actions);
  const beforeRects = [
    ...garden.plantings.map((planting) =>
      toPlantingRect(
        planting,
        getBeforeKind(planting, afterGarden.plantings, getPlantingFootprint),
      ),
    ),
    ...garden.structures.map((structure) =>
      toStructureRect(
        structure,
        getBeforeKind(structure, afterGarden.structures, getStructureFootprint),
      ),
    ),
  ];
  const afterRects = [
    ...afterGarden.plantings.map((planting) =>
      toPlantingRect(
        planting,
        getAfterKind(planting, garden.plantings, getPlantingFootprint),
      ),
    ),
    ...afterGarden.structures.map((structure) =>
      toStructureRect(
        structure,
        getAfterKind(structure, garden.structures, getStructureFootprint),
      ),
    ),
  ];

  return toOverlayModel(suggestion.title, {
    afterRects,
    beforeRects,
    summary: {
      addedCount: afterRects.filter((rect) => rect.kind === 'added').length,
      movedCount: afterRects.filter((rect) => rect.kind === 'moved').length,
      removedCount: beforeRects.filter((rect) => rect.kind === 'removed')
        .length,
    },
  });
}

function toOverlayModel(
  title: string,
  preview: {
    afterRects: AutoLayoutPreviewRect[];
    beforeRects: AutoLayoutPreviewRect[];
    summary: {
      addedCount: number;
      movedCount: number;
      removedCount: number;
    };
  },
): ProposalDiffOverlayModel {
  return {
    afterRects: preview.afterRects.filter((rect) => rect.kind !== 'unchanged'),
    beforeRects: preview.beforeRects.filter(
      (rect) => rect.kind !== 'unchanged',
    ),
    connectors: buildConnectors(preview.beforeRects, preview.afterRects),
    summary: {
      addedCount: preview.summary.addedCount,
      movedCount: preview.summary.movedCount,
      removedCount: preview.summary.removedCount,
    },
    title,
  };
}

function buildConnectors(
  beforeRects: AutoLayoutPreviewRect[],
  afterRects: AutoLayoutPreviewRect[],
): ProposalDiffConnector[] {
  const beforeById = new Map(beforeRects.map((rect) => [rect.id, rect]));

  return afterRects
    .filter((rect) => rect.kind === 'moved')
    .flatMap((afterRect) => {
      const beforeRect = beforeById.get(afterRect.id);

      return beforeRect
        ? [
            {
              from: rectCenter(beforeRect.rect),
              id: afterRect.id,
              to: rectCenter(afterRect.rect),
            },
          ]
        : [];
    });
}

function getBeforeKind<T extends { id: string }>(
  item: T,
  nextItems: T[],
  getRect: (item: T) => FootRect,
): AutoLayoutPreviewChangeKind {
  const match = nextItems.find((nextItem) => nextItem.id === item.id);

  if (!match) {
    return 'removed';
  }

  return sameRect(getRect(item), getRect(match)) ? 'unchanged' : 'moved';
}

function getAfterKind<T extends { id: string }>(
  item: T,
  currentItems: T[],
  getRect: (item: T) => FootRect,
): AutoLayoutPreviewChangeKind {
  const match = currentItems.find((currentItem) => currentItem.id === item.id);

  if (!match) {
    return 'added';
  }

  return sameRect(getRect(match), getRect(item)) ? 'unchanged' : 'moved';
}

function toPlantingRect(
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

function toStructureRect(
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

function rectCenter(rect: FootRect) {
  return {
    xFt: rect.xFt + rect.widthFt / 2,
    yFt: rect.yFt + rect.depthFt / 2,
  };
}

function sameRect(left: FootRect, right: FootRect) {
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
