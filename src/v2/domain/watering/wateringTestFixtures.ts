import type { GardenStructure, PlantingGroup } from '../plan';
import type {
  ForecastWeatherInput,
  HistoricalWeatherInput,
  WaterApplication,
  WateringCalculationInput,
  WateringStage,
} from './types';
import {
  calculateWateringRecommendations,
  createCropGroupWateringTarget,
} from './wateringModel';

export const NOW = '2026-07-09T12:00:00.000Z';
export const BASELINE_AT = '2026-07-08T12:00:00.000Z';
export const TIMEZONE = 'America/New_York';

export function makePlanting(
  id: string,
  cropName: string,
  overrides: Partial<PlantingGroup> = {},
): PlantingGroup {
  return {
    arrangement: 'block',
    cropId: `${id}-crop`,
    cropName,
    depthFt: 2,
    growingAreaStructureId: 'shared-bed',
    id,
    instances: [{ id: `${id}-1`, label: cropName, xFt: 1, yFt: 1 }],
    irrigationZoneId: 'zone-1',
    lifecycle: 'growing',
    locked: false,
    mulched: false,
    notes: '',
    plannedFor: null,
    plantedOn: '2026-05-15',
    spacingInches: 12,
    sun: 'fullSun',
    waterProfile: {
      baseWeeklyInches: 1,
      confidence: 'high',
      depletionFraction: 0.5,
      rootDepthInches: 12,
      source: 'curated',
      sourceVersion: 'extension-2026.1',
      stageCoefficients: {
        establishing: 1.2,
        flowering: 1,
        fruiting: 1.1,
        mature: 0.8,
      },
    },
    wateringStage: 'mature',
    wateringStageSource: 'lifecycleFallback',
    widthFt: 2,
    xFt: 1,
    yFt: 1,
    ...overrides,
  };
}

export function makeStructure(
  overrides: Partial<GardenStructure> = {},
): GardenStructure {
  return {
    depthFt: 4,
    drainage: 'moderate',
    id: 'shared-bed',
    irrigationZoneId: 'zone-1',
    label: 'Shared bed',
    locked: false,
    mulched: false,
    notes: '',
    rotationDegrees: 0,
    soilDepthInches: 24,
    soilType: 'loam',
    type: 'raisedBed',
    widthFt: 8,
    xFt: 0,
    yFt: 0,
    ...overrides,
  };
}

export function makeHistoricalWeather(
  overrides: Partial<HistoricalWeatherInput> = {},
): HistoricalWeatherInput {
  return {
    observations: [
      {
        endIso: NOW,
        id: 'observed-day-1',
        observedRainInches: 0,
        referenceEtInches: 0.1,
        startIso: BASELINE_AT,
      },
    ],
    quality: 'fresh',
    source: 'test-weather',
    sourceUpdatedAtIso: NOW,
    ...overrides,
  };
}

export function makeForecastWeather(
  overrides: Partial<ForecastWeatherInput> = {},
): ForecastWeatherInput {
  return {
    generatedAtIso: NOW,
    periods: [
      {
        endIso: '2026-07-10T12:00:00.000Z',
        expectedRainInches: 0,
        id: 'forecast-day-1',
        precipitationProbabilityPercent: 100,
        referenceEtInches: 0,
        startIso: NOW,
      },
    ],
    quality: 'fresh',
    source: 'test-weather',
    ...overrides,
  };
}

export function target(
  planting: PlantingGroup,
  structure: GardenStructure | null = makeStructure(),
  stage: WateringStage = planting.wateringStage,
  areaReliability:
    | 'estimated'
    | 'geometry'
    | 'measured'
    | 'unknown' = 'geometry',
) {
  const stagedPlanting =
    stage === planting.wateringStage
      ? planting
      : {
          ...planting,
          wateringStage: stage,
          wateringStageSource: 'manual' as const,
        };
  return createCropGroupWateringTarget(stagedPlanting, {
    areaReliability,
    deepLink: `/app/today?focus=watering&cropGroupId=${planting.id}`,
    structure,
  });
}

export function calculate(options: {
  applications?: readonly WaterApplication[];
  balances?: WateringCalculationInput['priorBalances'];
  forecast?: ForecastWeatherInput;
  historical?: HistoricalWeatherInput;
  targets: WateringCalculationInput['targets'];
}) {
  return calculateWateringRecommendations({
    applications: options.applications ?? [],
    checkTimeLocal: '07:00',
    forecastWeather: options.forecast ?? makeForecastWeather(),
    gardenId: 'garden-1',
    historicalWeather: options.historical ?? makeHistoricalWeather(),
    nowIso: NOW,
    priorBalances: options.balances ?? [],
    targets: options.targets,
    timezone: TIMEZONE,
  });
}

export function depthApplication(
  id: string,
  depthInches: number,
  appliedAtIso: string,
  outcome: 'applied' | 'partial' = 'applied',
): WaterApplication {
  return {
    amount: { depthInches, unit: 'inches' },
    appliedAtIso,
    cropGroupId: 'tomato-group',
    efficiency: { confidence: 'high', fraction: 1, source: 'calibrated' },
    id,
    method: 'drip',
    outcome,
    recordedAtIso: '2026-07-09T11:30:00.000Z',
    recordedByUserId: 'user-1',
    revision: 1,
  };
}
