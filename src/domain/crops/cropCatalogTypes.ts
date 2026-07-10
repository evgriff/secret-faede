export type IsoDateString = string;

export type CropCategory =
  | 'brassica'
  | 'flower'
  | 'fruit'
  | 'grain'
  | 'herb'
  | 'leafyGreen'
  | 'legume'
  | 'root'
  | 'vegetable';

export type CropGrowthForm =
  | 'bulb'
  | 'bush'
  | 'climber'
  | 'clump'
  | 'groundcover'
  | 'rosette'
  | 'root'
  | 'upright'
  | 'vining';

export type CropLifecycle = 'annual' | 'biennial' | 'perennial';
export type CropProfileCompleteness = 'complete' | 'needsReview' | 'partial';
export type CropSowMethod = 'both' | 'directSow' | 'transplant';
export type CropWaterNeed = 'high' | 'low' | 'medium';
export type PlantingMode =
  | 'block'
  | 'cluster'
  | 'row'
  | 'single'
  | 'trellisLine';
export type SunExposure = 'fullShade' | 'fullSun' | 'partShade' | 'partSun';

export type CropSupportScope = 'none' | 'plant' | 'structure';
export type CropSupportKind =
  | 'cage'
  | 'custom'
  | 'netting'
  | 'none'
  | 'rowCover'
  | 'stake'
  | 'stakeAndWeave'
  | 'trellis';
export type PlantSupportType =
  | 'cage'
  | 'custom'
  | 'netting'
  | 'none'
  | 'rowCover'
  | 'stake'
  | 'stakeAndWeave';

export interface CropSupportProfile {
  kind: CropSupportKind;
  label: string;
  plantSupportType: PlantSupportType | null;
  reason: string;
  recommended: boolean;
  required: boolean;
  scope: CropSupportScope;
  sourceTags: string[];
}

export interface CropProfile {
  aliases: string[];
  category: CropCategory;
  caution: string | null;
  commonName: string;
  completenessScore: number;
  daysToMaturity: number | null;
  defaultIcon: string;
  family: string;
  frostSensitive: boolean;
  growthForm: CropGrowthForm;
  hardiness: string;
  id: string;
  lifecycle: CropLifecycle;
  lastRefreshedIso: IsoDateString | null;
  manualOverride: boolean;
  matureHeightInches: number | null;
  matureSpreadInches: number | null;
  name: string;
  notes: string;
  perennialSuitability: string;
  pollinatorRole: string | null;
  profileCompleteness: CropProfileCompleteness;
  rootDepthInches: number | null;
  roles: string[];
  rowSpacingInches: number | null;
  scientificName: string;
  source: string;
  sourceTags: string[];
  sowMethod: CropSowMethod;
  spacingInches: number | null;
  sunExposure: SunExposure;
  sunRequirement: SunExposure;
  supportedPlantingModes: PlantingMode[];
  supportProfile: CropSupportProfile;
  synonyms: string[];
  trellisRecommended: boolean;
  trellisRequired: boolean;
  varietyGroup: string | null;
  waterNeeds: CropWaterNeed;
  weeklyWaterNeedInches: number | null;
}

export type PlantDifficulty = 'demanding' | 'easy' | 'moderate';
export type PlantPlacementMode = 'block' | 'cluster' | 'row';
