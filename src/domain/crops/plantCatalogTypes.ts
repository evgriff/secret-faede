import type {
  CropLifecycle,
  CropProfile,
  CropWaterNeed,
  PlantDifficulty,
  PlantPlacementMode,
  PlantSupportType,
  SunExposure,
} from './cropCatalogTypes';

type MonthDayString = string;

export type PlantPreferredSeason =
  | 'coolSeason'
  | 'flexible'
  | 'perennial'
  | 'warmSeason';
export type PlantHarvestCycle =
  | 'continuous'
  | 'cutAndComeAgain'
  | 'single'
  | 'successive';

export interface MonthDayRange {
  end: MonthDayString;
  start: MonthDayString;
}

export interface PlantSeasonWindow {
  fallPlanting: MonthDayRange | null;
  springPlanting: MonthDayRange | null;
}

export interface PlantCatalogSupportNeed {
  kind: 'none' | 'perPlant' | 'trellis';
  label: string;
  perPlant: boolean;
  recommended: boolean;
  required: boolean;
  type: PlantSupportType;
}

export interface PlantLifecycleTiming {
  daysToMaturity: number | null;
  directSowCompatible: boolean;
  minimumSoilTempF: number | null;
  preferredSeason: PlantPreferredSeason;
  transplantCompatible: boolean;
  transplantLeadWeeks: number | null;
}

export interface PlantHarvestCycleInfo {
  cycle: PlantHarvestCycle;
  daysToFirstHarvest: number | null;
  harvestWindowDays: number | null;
  notes: string;
}

export interface PlantClimateInputs {
  frostSensitive: boolean;
  hardiness: string;
  locationNotes: string[];
  perennialSuitability: string;
  preferredSeason: PlantPreferredSeason;
  southeastMichiganWindow: PlantSeasonWindow;
}

export interface PlantCatalogEntry {
  climate: PlantClimateInputs;
  commonName: string;
  compatiblePlacementModes: PlantPlacementMode[];
  crop: CropProfile;
  defaultSpacingInches: number;
  defaultSupport: PlantCatalogSupportNeed;
  description: string;
  difficulty: PlantDifficulty;
  harvest: PlantHarvestCycleInfo;
  id: string;
  lifecycle: CropLifecycle;
  matureHeightInches: number | null;
  matureSpreadInches: number | null;
  rowSpacingInches: number | null;
  scientificName: string;
  sunPreference: SunExposure;
  timing: PlantLifecycleTiming;
  waterNeed: CropWaterNeed;
}
