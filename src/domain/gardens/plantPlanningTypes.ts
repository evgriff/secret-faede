import type {
  CropCategory,
  CropGrowthForm,
  CropLifecycle,
  PlantCanopyDensity,
  PlantPlanningGrowthStage,
  CropWaterNeed,
  IsoDateString,
  LocalDateString,
  SunTimeWindow,
  PlantingLifecycleStatus,
  Structure,
  SunExposure,
} from './models';

export type PlantLifecycle = CropLifecycle;
export type PlantDifficulty = 'demanding' | 'easy' | 'moderate';
export type PlantPlacementMode = 'block' | 'cluster' | 'row';
export type PlantSupportType =
  | 'cage'
  | 'custom'
  | 'netting'
  | 'none'
  | 'rowCover'
  | 'stake'
  | 'stakeAndWeave';

export interface PlantSpecies {
  aliases: string[];
  catalogCropId: string | null;
  category: CropCategory;
  commonName: string;
  difficulty: PlantDifficulty;
  growthForm: CropGrowthForm;
  id: string;
  lifecycle: PlantLifecycle;
  matureHeightInches: number | null;
  matureSpreadInches: number | null;
  planningCanopyDensity: PlantCanopyDensity;
  planningGrowthStage: PlantPlanningGrowthStage;
  rowSpacingInches: number | null;
  scientificName: string;
  source: 'catalog' | 'legacyCustom';
  spacingInches: number | null;
  supportHeightFt: number | null;
  sunRequirement: SunExposure;
  supportedPlacementModes: PlantPlacementMode[];
  trellisRecommended: boolean;
  trellisRequired: boolean;
  waterNeeds: CropWaterNeed;
  weeklyWaterNeedInches: number | null;
}

export interface PlantStatusPhoto {
  contentType: string;
  downloadUrl: string | null;
  fileName: string;
  id: string;
  sizeBytes: number | null;
  storagePath: string | null;
  uploadedAtIso: IsoDateString | null;
}

export interface PlantDotStatus {
  lifecycle: PlantingLifecycleStatus | null;
  notes: string;
  photoIds: string[];
  thinned: boolean;
  thinnedAtIso: IsoDateString | null;
  watered: boolean;
  wateredAtIso: IsoDateString | null;
}

export interface PlantStatus {
  dotStatus: Record<string, PlantDotStatus>;
  lifecycle: PlantingLifecycleStatus;
  notes: string;
  photos: PlantStatusPhoto[];
  thinned: boolean;
  thinnedAtIso: IsoDateString | null;
  watered: boolean;
  wateredAtIso: IsoDateString | null;
}

export interface PlantDot {
  id: string;
  index: number;
  label: string;
  plantGroupId: string;
  xFt: number;
  yFt: number;
}

export interface PlantSupportPlan {
  installedAtIso: IsoDateString | null;
  notes: string;
  perPlant: boolean;
  quantity: number;
  required: boolean;
  type: PlantSupportType;
}

export interface PlantGroup {
  allowRelocation: boolean;
  bedStructureId: string | null;
  id: string;
  label: string;
  locked: boolean;
  placementMode: PlantPlacementMode;
  plannedFor: LocalDateString | null;
  plantedOn: LocalDateString | null;
  quantity: number;
  planningCanopyDensity: PlantCanopyDensity;
  planningGrowthStage: PlantPlanningGrowthStage;
  rowSpacingInches: number | null;
  spacingInches: number;
  species: PlantSpecies;
  status: PlantStatus;
  support: PlantSupportPlan;
  supportHeightFt: number | null;
  trellisLengthFt: number | null;
  trellisStructureId: string | null;
  xFt: number;
  yFt: number;
}

export interface PlantMaturityProfile {
  canopyDensity: PlantCanopyDensity;
  canopyOpacity: number;
  canopyRadiusFt: number;
  effectiveHeightFt: number;
  growthStage: PlantPlanningGrowthStage;
  matureHeightFt: number;
  matureSpreadFt: number;
  sourceNotes: string[];
  supportHeightFt: number | null;
}

export interface SunPlanningWindow {
  endHour: number;
  latitude: number;
  longitude: number;
  representativeDate: LocalDateString;
  sampleMinutes: number;
  startHour: number;
  timeWindow: SunTimeWindow;
  timezone: string;
}

export interface PlantGroupFootprint {
  depthFt: number;
  id: string;
  label: string;
  plantGroupId: string;
  widthFt: number;
  xFt: number;
  yFt: number;
}

export type LayoutProblemKind =
  | 'bedFit'
  | 'bounds'
  | 'pathAccess'
  | 'rotationRisk'
  | 'shadeCompetition'
  | 'spacingConflict'
  | 'structureConflict'
  | 'sunMismatch'
  | 'supportMissing'
  | 'waterAccess';
export type LayoutProblemCategory =
  | 'access'
  | 'boundary'
  | 'care'
  | 'placement'
  | 'rotation'
  | 'shade'
  | 'spacing'
  | 'structure'
  | 'sun'
  | 'support'
  | 'water';
export type LayoutProblemSeverity = 'caution' | 'mustFix' | 'recommended';
export type LayoutProblemSource =
  | 'optimizer'
  | 'planHealth'
  | 'sunModel'
  | 'userReview';
export type LayoutProblemStatus = 'applied' | 'ignored' | 'open';
export type LayoutResolutionOptionStatus =
  | 'applied'
  | 'available'
  | 'ignored'
  | 'rejected';
export type LayoutValidationStatus =
  | 'failed'
  | 'notRun'
  | 'passed'
  | 'stale'
  | 'warning';

export interface LayoutDownstreamValidation {
  checkedAtIso: IsoDateString | null;
  message: string | null;
  remainingProblemIds: string[];
  status: LayoutValidationStatus;
}

export interface LayoutProblemTarget {
  id: string;
  plantGroupId: string | null;
  type: 'plantDot' | 'plantGroup' | 'structure' | 'sunCell';
}

export interface LayoutProblemEvidence {
  label: string;
  sourceId: string | null;
  type: 'distanceFt' | 'overlapSqFt' | 'shadeHours' | 'spacingInches' | 'text';
  unit: 'ft' | 'hours' | 'in' | 'sqFt' | null;
  value: number | string;
}

export interface LayoutProblem {
  appliedResolutionId: string | null;
  category: LayoutProblemCategory;
  description: string;
  downstreamValidation: LayoutDownstreamValidation;
  evidence: LayoutProblemEvidence[];
  id: string;
  ignoredAtIso: IsoDateString | null;
  kind: LayoutProblemKind;
  severity: LayoutProblemSeverity;
  source: LayoutProblemSource;
  status: LayoutProblemStatus;
  targets: LayoutProblemTarget[];
  title: string;
  variantGroupId: string | null;
}

export type LayoutResolutionAction =
  | {
      plantGroupId: string;
      type: 'assignPlantSupport';
      support: PlantSupportPlan;
    }
  | {
      plantGroupId: string;
      quantity: number;
      type: 'changePlantQuantity';
    }
  | {
      placementMode: PlantPlacementMode;
      plantGroupId: string;
      type: 'changePlacementMode';
    }
  | {
      reason: string;
      type: 'dismissProblem';
    }
  | {
      structure: Structure;
      type: 'addStructure';
    }
  | {
      plantGroupId: string;
      structureId: string;
      trellisLengthFt: number | null;
      type: 'linkTrellisStructure';
    }
  | {
      plantGroupId: string;
      type: 'movePlantGroup';
      xFt: number;
      yFt: number;
    }
  | {
      structureId: string;
      type: 'updateStructure';
      values: Partial<Structure>;
    }
  | {
      type: 'useLayoutVariant';
      variantId: string;
    };

export interface LayoutResolutionOption {
  actions: LayoutResolutionAction[];
  description: string;
  downstreamValidation: LayoutDownstreamValidation;
  estimatedImpact: {
    affectedPlantCount: number;
    keepsExistingPlantCenters: boolean;
    needsPhysicalMove: boolean;
  };
  id: string;
  label: string;
  problemId: string;
  sourceId: string;
  status: LayoutResolutionOptionStatus;
  variantGroupId: string | null;
}

export interface LayoutResolution {
  appliedAtIso: IsoDateString | null;
  downstreamValidation: LayoutDownstreamValidation;
  id: string;
  ignoredAtIso: IsoDateString | null;
  optionId: string;
  problemId: string;
  status: 'applied' | 'dismissed' | 'ignored' | 'pending' | 'rejected';
  variantGroupId: string | null;
}

export interface LayoutVariant {
  assumptions: string[];
  downstreamValidation: LayoutDownstreamValidation;
  id: string;
  label: string;
  plantGroups: PlantGroup[];
  problemIds: string[];
  problems: LayoutProblem[];
  resolutionOptionIds: string[];
  resolutionOptions: LayoutResolutionOption[];
  score: {
    components: Record<'access' | 'spacing' | 'structures' | 'water', number>;
    total: number;
  };
  structures: Structure[];
  summary: string;
  variantGroupId: string;
}

export type PlantEditorEntryPoint =
  | 'addPlants'
  | 'cropFocus'
  | 'detailedView'
  | 'problemResolution'
  | 'wrench';
export type PlantEditorTab =
  | 'care'
  | 'photos'
  | 'placement'
  | 'problems'
  | 'summary';

export type PlantEditorModalState =
  | {
      dotId: null;
      groupId: null;
      isOpen: false;
      problemId: null;
      source: null;
      tab: PlantEditorTab;
    }
  | {
      dotId: string | null;
      groupId: string;
      isOpen: true;
      problemId: string | null;
      source: PlantEditorEntryPoint;
      tab: PlantEditorTab;
    };

export type DetailedViewSubject =
  | {
      dotId: string | null;
      groupId: string;
      type: 'plantGroup';
    }
  | {
      problemId: string;
      type: 'layoutProblem';
    }
  | {
      structureId: string;
      type: 'structure';
    }
  | {
      type: 'layoutVariant';
      variantId: string;
    };

export interface DetailedViewState {
  isOpen: boolean;
  presentation: 'modal' | 'sidePanel';
  subject: DetailedViewSubject | null;
}
