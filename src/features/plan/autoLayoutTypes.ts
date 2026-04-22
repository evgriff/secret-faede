import type {
  Planting,
  Structure,
} from '../../domain/gardens/GardenRepository';

export type AutoLayoutStrategy = 'accessFirst' | 'sunFirst' | 'supportFirst';
export type AutoLayoutRunStatus =
  | 'applied'
  | 'empty'
  | 'error'
  | 'idle'
  | 'ready'
  | 'running';

export interface AutoLayoutScoreBreakdown {
  access: number;
  feasibility: number;
  seasonalSuitability: number;
  shadeManagement: number;
  spacingQuality: number;
  spaceEfficiency: number;
  sunFit: number;
  support: number;
  waterGrouping: number;
}

export interface AutoLayoutCandidate {
  explanations: string[];
  hardConstraintViolations: string[];
  id: string;
  label: string;
  materials: string[];
  plantings: Planting[];
  score: number;
  scoreBreakdown: AutoLayoutScoreBreakdown;
  strategy: AutoLayoutStrategy;
  structures: Structure[];
  tradeoffs: string[];
  unplaced: Array<{
    cropName: string;
    reason: string;
    required: boolean;
  }>;
}
