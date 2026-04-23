import type {
  CropLifecycle,
  CropProfile,
  CropWaterNeed,
  GardenLocation,
  MonthDayString,
  PlantDifficulty,
  PlantPlacementMode,
  PlantSupportType,
  SunExposure,
} from '../gardens/GardenRepository';

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
export type PlantLocationMatchBand = 'good' | 'poor' | 'strong' | 'watch';
export type PlantLocationMatchConfidence = 'high' | 'low' | 'medium';

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

export interface PlantLocationContext {
  averageFirstFrost: MonthDayString;
  averageLastFrost: MonthDayString;
  confidence: PlantLocationMatchConfidence;
  firstFallFrostWindow: MonthDayRange;
  hardinessZone: string;
  lastSpringFrostWindow: MonthDayRange;
  location: GardenLocation;
  regionName: string;
  seasonWindows: {
    coolFall: MonthDayRange;
    coolSpring: MonthDayRange;
    warmSeason: MonthDayRange;
  };
  source: 'annArborDefault' | 'gardenProfile';
}

export interface PlantLocationMatch {
  band: PlantLocationMatchBand;
  confidence: PlantLocationMatchConfidence;
  label: string;
  reasons: string[];
  score: number;
  warnings: string[];
}

export interface PlantLocationMatchRationale {
  basis: string;
  details: string[];
  headline: string;
}
