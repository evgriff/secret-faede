import type {
  GardenStructure,
  PlantingGroup,
  PlantingWateringStage,
  PlantingWateringStageSource,
} from '../plan';

export const WATERING_MODEL_VERSION = 'crop-water-balance-v2' as const;
export const WATERING_CALCULATION_REVISION = 1 as const;

export type WaterDataQuality = 'fresh' | 'cached' | 'stale' | 'insufficient';
export type WateringStage = PlantingWateringStage;
export type WateringStageSource = PlantingWateringStageSource;
export type WateringRecommendationStatus =
  | 'due'
  | 'scheduled'
  | 'suppressed'
  | 'checkSoil';
export type WateringConfidence = 'high' | 'medium' | 'low';
export type WateringAreaReliability =
  | 'measured'
  | 'geometry'
  | 'estimated'
  | 'unknown';

export interface WateringArea {
  reliability: WateringAreaReliability;
  squareFeet: number | null;
}

export interface CropGroupWateringTarget {
  area: WateringArea;
  deepLink: string;
  kind: 'cropGroup';
  label: string;
  planting: PlantingGroup;
  stage: WateringStage;
  stageSource: WateringStageSource;
  structure: GardenStructure | null;
}

export interface CropGroupTargetOptions {
  areaReliability: WateringAreaReliability;
  deepLink: string;
  label?: string;
  structure: GardenStructure | null;
}

export interface WaterApplicationEfficiency {
  confidence: WateringConfidence;
  fraction: number;
  source: 'calibrated' | 'manufacturer' | 'manual' | 'estimated';
}

export type AppliedWaterAmount =
  | {
      depthInches: number;
      unit: 'inches';
    }
  | {
      area: WateringArea;
      gallons: number;
      unit: 'gallons';
    }
  | {
      unit: 'unknown';
    };

interface WaterApplicationBase {
  appliedAtIso: string;
  cropGroupId: string;
  id: string;
  method: 'drip' | 'hose' | 'hand' | 'sprinkler' | 'other';
  recordedAtIso: string;
  recordedByUserId: string;
  revision: number;
}

export interface CreditedWaterApplication extends WaterApplicationBase {
  amount: AppliedWaterAmount;
  efficiency: WaterApplicationEfficiency;
  outcome: 'applied' | 'partial';
}

export interface AppliedWaterApplication extends CreditedWaterApplication {
  outcome: 'applied';
}

export interface PartialWaterApplication extends CreditedWaterApplication {
  outcome: 'partial';
}

export interface SkippedWaterApplication extends WaterApplicationBase {
  outcome: 'skipped';
  skipReason: string;
}

export type WaterApplication =
  | AppliedWaterApplication
  | PartialWaterApplication
  | SkippedWaterApplication;

export interface HistoricalWeatherObservation {
  endIso: string;
  id: string;
  observedRainInches: number | null;
  referenceEtInches: number | null;
  startIso: string;
}

export interface HistoricalWeatherInput {
  observations: readonly HistoricalWeatherObservation[];
  quality: WaterDataQuality;
  source: string;
  sourceUpdatedAtIso: string | null;
}

export interface ForecastWeatherPeriod {
  endIso: string;
  expectedRainInches: number | null;
  id: string;
  precipitationProbabilityPercent: number | null;
  referenceEtInches: number | null;
  startIso: string;
}

export interface ForecastWeatherInput {
  generatedAtIso: string | null;
  periods: readonly ForecastWeatherPeriod[];
  quality: WaterDataQuality;
  source: string;
}

export interface WaterApplicationLedgerEntry {
  applicationId: string;
  creditedDepthInches: number;
  outcome: WaterApplication['outcome'];
  revision: number;
}

export interface WaterBalanceBaseline {
  applicationLedger: readonly WaterApplicationLedgerEntry[];
  asOfIso: string;
  calculationRevision: typeof WATERING_CALCULATION_REVISION;
  cropGroupId: string;
  depletionInches: number;
  modelVersion: typeof WATERING_MODEL_VERSION;
  profileFingerprint: string;
}

export type WateringReasonCode =
  | 'AREA_UNRELIABLE_NO_GALLONS'
  | 'BACKDATED_APPLICATION_CREDITED'
  | 'BALANCE_AT_OR_ABOVE_TRIGGER'
  | 'BALANCE_BELOW_TRIGGER'
  | 'BALANCE_ROLLED_FORWARD'
  | 'CACHED_WEATHER_USED'
  | 'CONTAINER_DEMAND_ADJUSTED'
  | 'EXCESS_WATER_DRAINED'
  | 'FORECAST_DEPLETION_EXPECTED'
  | 'FORECAST_ET_ESTIMATED'
  | 'FORECAST_RAIN_SUPPRESSION'
  | 'FORECAST_WEATHER_INSUFFICIENT'
  | 'FORECAST_WEATHER_STALE'
  | 'HISTORICAL_ET_ACCRUED'
  | 'HISTORICAL_ET_ESTIMATED'
  | 'HISTORICAL_WEATHER_GAP'
  | 'HISTORICAL_WEATHER_INSUFFICIENT'
  | 'HISTORICAL_WEATHER_STALE'
  | 'LOW_CONFIDENCE_CROP_PROFILE'
  | 'LIFECYCLE_STAGE_FALLBACK'
  | 'MISSING_BALANCE_BASELINE'
  | 'MISSING_RAIN_OBSERVATION'
  | 'MISSING_STRUCTURE_CONTEXT'
  | 'MULCH_DEMAND_ADJUSTED'
  | 'OBSERVED_RAIN_CREDITED'
  | 'PROFILE_REVISION_APPLIED'
  | 'ROOT_ZONE_LIMITED_BY_SOIL_DEPTH'
  | 'SKIPPED_APPLICATION_ZERO_CREDIT'
  | 'UNKNOWN_APPLICATION_AMOUNT'
  | 'WATER_APPLICATION_CREDITED';

export interface WateringReasonDetail {
  amountInches: number | null;
  code: WateringReasonCode;
  message: string;
  sourceIds: readonly string[];
}

export type WateringAction =
  | 'waterNow'
  | 'planWatering'
  | 'waitForForecast'
  | 'checkSoil';

export interface WateringRecommendationTarget {
  cropGroupId: string;
  cropGroupLabel?: string;
  cropId: string;
  cropName: string;
  deepLink: string;
  kind: 'cropGroup';
  plantingIds: readonly [string];
  structureId: string | null;
}

export interface WateringRecommendationBasis {
  area: WateringArea;
  cropProfile: {
    baseWeeklyInches: number;
    confidence: PlantingGroup['waterProfile']['confidence'];
    depletionFraction: number;
    rootDepthInches: number;
    source: PlantingGroup['waterProfile']['source'];
    sourceVersion: string;
    stage: WateringStage;
    stageCoefficient: number;
    stageSource: WateringStageSource;
  };
  structure: {
    drainage: GardenStructure['drainage'];
    id: string;
    isContainer: boolean;
    mulched: boolean;
    soilDepthInches: number | null;
    soilType: GardenStructure['soilType'];
    type: GardenStructure['type'];
  } | null;
}

export interface WateringRecommendation {
  action: WateringAction;
  actionable: boolean;
  balance: WaterBalanceBaseline;
  basis: WateringRecommendationBasis;
  calculatedAtIso: string;
  calculationRevision: typeof WATERING_CALCULATION_REVISION;
  confidence: WateringConfidence;
  dataQuality: WaterDataQuality;
  /** Effective expected rain credited by the model during the next 24 hours. */
  forecastRainCreditInches: number;
  id: string;
  modelVersion: typeof WATERING_MODEL_VERSION;
  projectedDepletionInches: number;
  reasonCodes: readonly WateringReasonCode[];
  reasonDetails: readonly WateringReasonDetail[];
  recommendedDepthInches: number | null;
  recommendedGallons: number | null;
  recheckAtIso: string;
  rootZoneCapacityInches: number;
  scheduledForIso: string | null;
  status: WateringRecommendationStatus;
  suppressedUntilIso: string | null;
  target: WateringRecommendationTarget;
  triggerDepletionInches: number;
  workspaceRevisionId?: string;
}

export interface WateringCalculationInput {
  applications: readonly WaterApplication[];
  checkTimeLocal: string;
  forecastWeather: ForecastWeatherInput;
  gardenId: string;
  historicalWeather: HistoricalWeatherInput;
  nowIso: string;
  priorBalances: readonly WaterBalanceBaseline[];
  targets: readonly CropGroupWateringTarget[];
  timezone: string;
}

export interface WateringCalculationResult {
  calculatedAtIso: string;
  calculationRevision: typeof WATERING_CALCULATION_REVISION;
  gardenId: string;
  modelVersion: typeof WATERING_MODEL_VERSION;
  recommendations: readonly WateringRecommendation[];
  timezone: string;
}
