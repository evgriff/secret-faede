export const PLAN_SCHEMA_VERSION = 9 as const;

export type IsoDateString = string;
export type LocalDateString = string;
export type SoilType = 'clay' | 'loam' | 'sandy' | 'unknown';
export type DrainageProfile = 'fast' | 'moderate' | 'slow' | 'unknown';
export type SunExposure = 'fullSun' | 'partShade' | 'shade';
export type PlantingLifecycle =
  | 'planned'
  | 'planted'
  | 'growing'
  | 'harvestReady'
  | 'harvested'
  | 'removed';
export const PLANTING_WATERING_STAGES = [
  'establishing',
  'flowering',
  'fruiting',
  'mature',
] as const;
export type PlantingWateringStage = (typeof PLANTING_WATERING_STAGES)[number];
export const PLANTING_WATERING_STAGE_SOURCES = [
  'manual',
  'plantingEvent',
  'lifecycleFallback',
] as const;
export type PlantingWateringStageSource =
  (typeof PLANTING_WATERING_STAGE_SOURCES)[number];
export type PlantingArrangement =
  | 'block'
  | 'cluster'
  | 'row'
  | 'single'
  | 'trellisLine';
export type StructureType =
  | 'bed'
  | 'container'
  | 'path'
  | 'raisedBed'
  | 'trellis';

export interface GardenCoordinates {
  latitude: number;
  longitude: number;
}

export interface GardenLocation {
  coordinates: GardenCoordinates | null;
  label: string;
  query: string;
  timezone: string;
}

export function hasOperationalGardenLocation(
  location: GardenLocation,
): location is GardenLocation & { coordinates: GardenCoordinates } {
  const coordinates = location.coordinates;
  if (
    !coordinates ||
    !Number.isFinite(coordinates.latitude) ||
    !Number.isFinite(coordinates.longitude) ||
    coordinates.latitude < -90 ||
    coordinates.latitude > 90 ||
    coordinates.longitude < -180 ||
    coordinates.longitude > 180
  ) {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-US', {
      timeZone: location.timezone,
    }).format(new Date(0));
    return Boolean(location.timezone.trim());
  } catch {
    return false;
  }
}

export interface ClimateDefaults {
  firstFrost: `${number}-${number}`;
  hardinessZone: string;
  lastFrost: `${number}-${number}`;
}

export interface GardenPlot {
  climate: ClimateDefaults;
  depthFt: number;
  location: GardenLocation;
  northDegrees: number;
  snapFt: number;
  widthFt: number;
}

export interface GardenStructure {
  depthFt: number;
  drainage: DrainageProfile;
  id: string;
  irrigationZoneId: string | null;
  label: string;
  locked: boolean;
  mulched: boolean;
  notes: string;
  rotationDegrees: number;
  soilDepthInches: number | null;
  soilType: SoilType;
  type: StructureType;
  widthFt: number;
  xFt: number;
  yFt: number;
}

export interface PlantInstance {
  id: string;
  label: string;
  xFt: number;
  yFt: number;
}

export interface PlantingWaterProfileSnapshot {
  baseWeeklyInches: number;
  confidence: 'high' | 'low' | 'medium';
  depletionFraction: number;
  rootDepthInches: number;
  source: 'catalog' | 'curated' | 'estimated' | 'manual';
  sourceVersion: string;
  stageCoefficients: {
    establishing: number;
    flowering: number;
    fruiting: number;
    mature: number;
  };
}

export interface PlantingGroup {
  arrangement: PlantingArrangement;
  cropId: string;
  cropName: string;
  depthFt: number;
  growingAreaStructureId: string | null;
  id: string;
  instances: PlantInstance[];
  irrigationZoneId: string | null;
  lifecycle: PlantingLifecycle;
  locked: boolean;
  mulched: boolean;
  notes: string;
  plantedOn: LocalDateString | null;
  plannedFor: LocalDateString | null;
  spacingInches: number;
  sun: SunExposure;
  waterProfile: PlantingWaterProfileSnapshot;
  wateringStage: PlantingWateringStage;
  wateringStageSource: PlantingWateringStageSource;
  widthFt: number;
  xFt: number;
  yFt: number;
}

export function isValidLocalDate(value: string): value is LocalDateString {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function wateringStageForLifecycle(
  lifecycle: PlantingLifecycle,
): PlantingWateringStage {
  if (lifecycle === 'planned' || lifecycle === 'planted') {
    return 'establishing';
  }
  if (lifecycle === 'harvestReady') return 'fruiting';
  return 'mature';
}

export function transitionPlantingLifecycle(
  planting: PlantingGroup,
  lifecycle: PlantingLifecycle,
): PlantingGroup {
  return {
    ...planting,
    lifecycle,
    wateringStage:
      planting.wateringStageSource === 'lifecycleFallback'
        ? wateringStageForLifecycle(lifecycle)
        : planting.wateringStage,
  };
}

export function resetPlantingWateringStage(
  planting: PlantingGroup,
): PlantingGroup {
  return {
    ...planting,
    wateringStage: wateringStageForLifecycle(planting.lifecycle),
    wateringStageSource: 'lifecycleFallback',
  };
}

export interface PlanReviewDecision {
  decision: 'accepted' | 'ignored' | 'snoozed';
  issueId: string;
  updatedAtIso: IsoDateString;
}

export interface GardenPlan {
  createdAtIso: IsoDateString;
  id: string;
  name: string;
  plantings: PlantingGroup[];
  plot: GardenPlot;
  reviewDecisions: PlanReviewDecision[];
  schemaVersion: typeof PLAN_SCHEMA_VERSION;
  setupCompleted: boolean;
  structures: GardenStructure[];
  updatedAtIso: IsoDateString;
}

export function isGrowingStructure(structure: GardenStructure) {
  return (
    structure.type === 'bed' ||
    structure.type === 'container' ||
    structure.type === 'raisedBed'
  );
}

export function getPlantingGroupLabel(
  plan: GardenPlan,
  planting: PlantingGroup,
) {
  const peers = plan.plantings.filter(
    (candidate) => candidate.cropId === planting.cropId,
  );
  const ordinal = peers.findIndex((candidate) => candidate.id === planting.id);
  const cropLabel =
    peers.length > 1 && ordinal >= 0
      ? `${planting.cropName} group ${ordinal + 1}`
      : planting.cropName;
  const structure = plan.structures.find(
    (candidate) => candidate.id === planting.growingAreaStructureId,
  );

  return structure?.label ? `${cropLabel} in ${structure.label}` : cropLabel;
}
