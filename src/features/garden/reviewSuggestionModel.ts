import type {
  Garden,
  Planting,
  Structure,
  SunExposure,
} from '../../domain/gardens/GardenRepository';
import type { PlanWarning } from './gardenPlanning';
import {
  canOptimizerMovePlanting,
  getPlantingRelocationImpact,
  type RelocationImpact,
} from './gardenImmutability';

export type ReviewSuggestionType =
  | 'addStakeCage'
  | 'addSupportMaterial'
  | 'addTrellis'
  | 'convertToTrellisedLayout'
  | 'flagRotationConcern'
  | 'flagSunMismatch'
  | 'flagWaterZoneMismatch'
  | 'moveShadeTolerantCrop'
  | 'moveTallCropNorth'
  | 'optimizerProposal'
  | 'reassignCropToBed'
  | 'splitOvercrowdedPlanting'
  | 'widenPath';

export type ReviewSuggestionConfidence = 'high' | 'low' | 'medium';

export interface ReviewSuggestionPreview {
  after: string;
  before: string;
}

export type ReviewSuggestionAction =
  | {
      kind: 'addStructure';
      structure: Structure;
    }
  | {
      kind: 'replaceAutoLayoutProposal';
      plantings: Planting[];
      structures: Structure[];
    }
  | {
      kind: 'updatePlanting';
      id: string;
      values: Partial<Planting>;
    }
  | {
      kind: 'updateStructure';
      id: string;
      values: Partial<Structure>;
    };

export interface ReviewSuggestion {
  actions: ReviewSuggestionAction[];
  canBatchAccept: boolean;
  confidence: ReviewSuggestionConfidence;
  id: string;
  itemIds: string[];
  preview: ReviewSuggestionPreview | null;
  relocationImpact?: RelocationImpact;
  rationale: string;
  severity: PlanWarning['severity'];
  source: 'optimizer' | 'planHealth' | 'selfFix';
  sourceWarningId: string | null;
  title: string;
  type: ReviewSuggestionType;
}

export const reviewMarker = '[review]';
const autoLayoutProposalMarker = '[auto-layout]';

export function applyReviewSuggestionActions(
  garden: Garden,
  actions: ReviewSuggestionAction[],
): Garden {
  return actions.reduce((nextGarden, action) => {
    switch (action.kind) {
      case 'addStructure':
        if (
          nextGarden.structures.some(
            (structure) => structure.id === action.structure.id,
          )
        ) {
          return nextGarden;
        }

        return {
          ...nextGarden,
          structures: [...nextGarden.structures, action.structure],
        };
      case 'replaceAutoLayoutProposal':
        return {
          ...nextGarden,
          plantings: [
            ...nextGarden.plantings.filter(
              (planting) =>
                !isAutoLayoutItem(planting) ||
                !canOptimizerMovePlanting(planting),
            ),
            ...action.plantings,
          ],
          structures: [
            ...nextGarden.structures.filter(
              (structure) => !isAutoLayoutItem(structure) || structure.locked,
            ),
            ...action.structures,
          ],
        };
      case 'updatePlanting':
        return {
          ...nextGarden,
          plantings: nextGarden.plantings.map((planting) =>
            planting.id === action.id
              ? {
                  ...planting,
                  ...action.values,
                  id: planting.id,
                }
              : planting,
          ),
        };
      case 'updateStructure':
        return {
          ...nextGarden,
          structures: nextGarden.structures.map((structure) =>
            structure.id === action.id
              ? {
                  ...structure,
                  ...action.values,
                  id: structure.id,
                }
              : structure,
          ),
        };
    }
  }, garden);
}

export function describeSuggestionDecision(suggestion: ReviewSuggestion) {
  return {
    id: suggestion.id,
    label: suggestion.title,
    note: suggestion.rationale,
  };
}

export function hasDraftProposalAction(suggestion: ReviewSuggestion) {
  return suggestion.actions.some((action) => {
    switch (action.kind) {
      case 'addStructure':
      case 'replaceAutoLayoutProposal':
        return true;
      case 'updatePlanting':
      case 'updateStructure':
        return Object.keys(action.values).some((key) => key !== 'notes');
    }
  });
}

export function appendNote(existingNotes: string, note: string) {
  if (existingNotes.includes(note)) {
    return existingNotes;
  }

  return existingNotes.trim() ? `${existingNotes.trim()}\n${note}` : note;
}

export function compact<T>(values: Array<T | null>): T[] {
  return values.filter((value): value is T => value !== null);
}

export function compareSuggestions(
  left: ReviewSuggestion,
  right: ReviewSuggestion,
) {
  return (
    severityRank(right.severity) - severityRank(left.severity) ||
    sourceRank(left.source) - sourceRank(right.source) ||
    left.title.localeCompare(right.title)
  );
}

export function getSuggestionRelocationImpact(
  garden: Garden,
  suggestion: ReviewSuggestion,
): RelocationImpact {
  return suggestion.actions.reduce<RelocationImpact>((impact, action) => {
    if (impact === 'physicalMove' || action.kind !== 'updatePlanting') {
      return impact;
    }

    const movesPlanting =
      action.values.xFt !== undefined || action.values.yFt !== undefined;

    if (!movesPlanting) {
      return impact;
    }

    const planting = garden.plantings.find(
      (candidate) => candidate.id === action.id,
    );
    const nextImpact = planting
      ? getPlantingRelocationImpact(planting)
      : 'none';

    return relocationImpactRank(nextImpact) > relocationImpactRank(impact)
      ? nextImpact
      : impact;
  }, suggestion.relocationImpact ?? 'none');
}

export function formatPlantingMode(mode: Planting['mode']) {
  return mode.replace(/([A-Z])/g, ' $1').toLowerCase();
}

export function formatPoint(point: { xFt: number; yFt: number }) {
  return `${formatMeasure(point.xFt)}, ${formatMeasure(point.yFt)} ft`;
}

export function formatSun(value: SunExposure | null) {
  return value ? value.replace(/([A-Z])/g, ' $1').toLowerCase() : 'unknown sun';
}

export function formatMeasure(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function isAutoLayoutItem(item: { id: string; notes?: string }) {
  return (
    item.id.includes(autoLayoutProposalMarker) ||
    item.notes?.includes(autoLayoutProposalMarker)
  );
}

function severityRank(severity: PlanWarning['severity']) {
  if (severity === 'critical') {
    return 3;
  }

  return severity === 'warning' ? 2 : 1;
}

function sourceRank(source: ReviewSuggestion['source']) {
  if (source === 'optimizer') {
    return 0;
  }

  return source === 'selfFix' ? 1 : 2;
}

function relocationImpactRank(impact: RelocationImpact) {
  if (impact === 'physicalMove') {
    return 2;
  }

  return impact === 'plannedOnly' ? 1 : 0;
}
