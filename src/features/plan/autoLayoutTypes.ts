import type {
  Planting,
  Structure,
} from '../../domain/gardens/GardenRepository';

export type AutoLayoutStrategy = 'accessFirst' | 'sunFirst' | 'supportFirst';
export type AutoLayoutRunStatus =
  | 'applied'
  | 'collectingConstraints'
  | 'error'
  | 'generatingSuggestion'
  | 'idle'
  | 'noBetterLayout'
  | 'preparingPreview'
  | 'ready'
  | 'savingDraft'
  | 'validatingSuggestion';
export type AutoLayoutSearchStatus = 'blocked' | 'partial' | 'resolved';

export interface AutoLayoutScoreBreakdown {
  accessQuality: number;
  spacingQuality: number;
  structureCompatibility: number;
  waterGrouping: number;
}

export interface AutoLayoutSearchReport {
  activeWarningCount: number;
  evaluatedStates: number;
  maxDepth: number;
  maxStates: number;
  prunedStates: number;
  rankingScore: number;
  reachedDepth: number;
  repeatedStates: number;
  status: AutoLayoutSearchStatus;
  unresolvedIssues: string[];
}

export interface AutoLayoutPlantZone {
  id: string;
  label: string;
  plantingIds: string[];
  rationale: string;
}

export interface AutoLayoutWholePlotPlan {
  accessPathIds: string[];
  heuristics: string[];
  plantZones: AutoLayoutPlantZone[];
}

export interface AutoLayoutCandidate {
  explanations: string[];
  hardConstraintViolations: string[];
  id: string;
  label: string;
  materials: string[];
  plantings: Planting[];
  scoreBreakdown: AutoLayoutScoreBreakdown;
  search: AutoLayoutSearchReport;
  strategy: AutoLayoutStrategy;
  structures: Structure[];
  tradeoffs: string[];
  unplaced: Array<{
    cropName: string;
    reason: string;
  }>;
  wholePlot: AutoLayoutWholePlotPlan;
}
