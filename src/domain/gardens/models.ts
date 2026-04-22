import { CURRENT_GARDEN_SCHEMA_VERSION } from './schemaMigrations';

export type IsoDateString = string;
export type LocalDateString = string;
export type LocalTimeString = string;
export type MonthDayString = string;

export type PlantingMode =
  | 'block'
  | 'cluster'
  | 'row'
  | 'single'
  | 'trellisLine';

export type StructureType =
  | 'bed'
  | 'compost'
  | 'container'
  | 'fence'
  | 'fenceWall'
  | 'hoseBib'
  | 'inGroundBed'
  | 'path'
  | 'pathway'
  | 'raisedBed'
  | 'treeObstacle'
  | 'trellis'
  | 'waterSource'
  | 'other';
export type StructureMaterial =
  | 'gravel'
  | 'lumber'
  | 'metal'
  | 'mixed'
  | 'mulch'
  | 'none'
  | 'pavers'
  | 'soil'
  | 'stone'
  | 'wire'
  | 'woodChips';

export type TaskStatus = 'done' | 'open' | 'skipped';
export type TaskPriority = 'high' | 'low' | 'medium';
export type TaskSource =
  | 'generated'
  | 'manual'
  | 'succession'
  | 'waterRecommendation';
export type TaskType =
  | 'amend'
  | 'fertilize'
  | 'harvest'
  | 'inspect'
  | 'mulch'
  | 'plant'
  | 'prune'
  | 'sow'
  | 'thin'
  | 'transplant'
  | 'trellis'
  | 'water'
  | 'weed'
  | 'other';
export type NotificationChannel = 'inApp' | 'push';
export type NotificationAlertType =
  | 'frost'
  | 'heatStress'
  | 'severeWeather'
  | 'taskDue'
  | 'watering';
export type NotificationConsentStatus =
  | 'denied'
  | 'granted'
  | 'notRequested'
  | 'revoked';
export type NotificationPushPermission =
  | 'default'
  | 'denied'
  | 'granted'
  | 'unsupported'
  | 'unknown';
export type NotificationStatus = 'failed' | 'queued' | 'sent' | 'skipped';
export type NotificationType =
  | 'frost'
  | 'heatStress'
  | 'severeWeather'
  | 'task'
  | 'taskDue'
  | 'watering'
  | 'weather';
export type SunExposure = 'fullShade' | 'fullSun' | 'partShade' | 'partSun';
export type SunShadeSourceKind =
  | 'fenceWall'
  | 'structure'
  | 'tallCrop'
  | 'treeObstacle'
  | 'trellisedCrop'
  | 'trellis';
export type SunShadeMicroclimateKind =
  | 'coolShadePocket'
  | 'reflectedHeat'
  | 'westHeat'
  | 'windExposedEdge';
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
export type PlantingLifecycleStatus =
  | 'growing'
  | 'harvest-ready'
  | 'harvested'
  | 'planned'
  | 'planted'
  | 'removed';
export type SoilType = 'clay' | 'loam' | 'sandy' | 'unknown';
export type DrainageProfile = 'fast' | 'normal' | 'slow' | 'unknown';
export type GardenDataQuality = 'complete' | 'limited' | 'partial';
export type WaterRecommendationGeneratedBy =
  | 'backend'
  | 'client'
  | 'manualRefresh';
export type WaterRecommendationStatus =
  | 'accepted'
  | 'active'
  | 'completed'
  | 'dismissed'
  | 'new'
  | 'suppressed';
export type WaterRecommendationTargetType = 'bed' | 'planting';
export type WaterRecommendationUrgency = 'high' | 'low' | 'medium' | 'none';
export type JournalEntryType = 'issue' | 'note';
export type JournalIssueCategory =
  | 'disease'
  | 'general'
  | 'irrigation'
  | 'nutrient'
  | 'pest'
  | 'weatherDamage';
export type IssueSeverity = 'high' | 'low' | 'medium';
export type IssueStatus = 'inProgress' | 'open' | 'resolved';
export type JournalTargetType = 'garden' | 'planting' | 'structure';

export interface GardenLocation {
  latitude: number | null;
  locationName: string;
  locationQuery: string;
  longitude: number | null;
  timezone: string;
}

export interface ClimateProfile {
  averageFirstFrost: MonthDayString;
  averageLastFrost: MonthDayString;
  editableByUser: boolean;
  hardinessZone: string;
  locationName: string;
  source: 'demoDefault' | 'user';
  updatedAtIso: IsoDateString | null;
}

export interface NotificationPreference {
  alertTypes: Record<NotificationAlertType, boolean>;
  channelConsent: Partial<Record<NotificationChannel, NotificationConsent>>;
  channels: Record<NotificationChannel, boolean>;
  defaultWateringCheckTime: LocalTimeString;
  frostAlertThresholdF: number;
  pushPermission: NotificationPushPermission;
  pushTokenLastRegisteredAtIso: IsoDateString | null;
  quietHours: {
    endLocalTime: LocalTimeString;
    startLocalTime: LocalTimeString;
  };
  timezone: string;
  wateringAlertThresholdIn: number;
}

export interface NotificationConsent {
  consentCopyVersion: string;
  grantedAtIso: IsoDateString | null;
  revokedAtIso: IsoDateString | null;
  status: NotificationConsentStatus;
}

export interface UserProfile {
  alertLocationQuery: string;
  climateProfile: ClimateProfile;
  createdAtIso: IsoDateString | null;
  defaultGardenId: string;
  displayName: string;
  email: string;
  notificationPreference: NotificationPreference;
  timezone: string;
  uid: string;
  updatedAtIso: IsoDateString | null;
}

export interface Plot {
  depthFt: number;
  gridUnitFt: 1;
  location: GardenLocation;
  orientationDegrees: number;
  snapUnitFt: number;
  widthFt: number;
}

export interface Structure {
  accessiblePath: boolean;
  canopyRadiusFt: number | null;
  continuousPath: boolean;
  depthFt: number;
  drainageProfile?: DrainageProfile;
  heightFt: number | null;
  id: string;
  irrigationZone?: string | null;
  label: string;
  locked: boolean;
  material: StructureMaterial;
  mulched: boolean;
  notes: string;
  rotationDegrees: number;
  soilType?: SoilType;
  type: StructureType;
  widthFt: number;
  workingClearanceFt: number | null;
  xFt: number;
  yFt: number;
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
  rowSpacingInches: number | null;
  rootDepthInches: number | null;
  roles: string[];
  scientificName: string;
  spacingInches: number | null;
  sowMethod: CropSowMethod;
  source: string;
  sourceTags: string[];
  supportedPlantingModes: PlantingMode[];
  synonyms: string[];
  sunExposure: SunExposure;
  sunRequirement: SunExposure;
  trellisRecommended: boolean;
  trellisRequired: boolean;
  varietyGroup: string | null;
  weeklyWaterNeedInches: number | null;
  waterNeeds: CropWaterNeed;
}

export interface Planting {
  allowRelocation: boolean;
  blockDepthFt: number | null;
  blockWidthFt: number | null;
  clusterRadiusFt: number | null;
  cropId: string | null;
  id: string;
  instances: PlantingInstance[];
  irrigationZone?: string | null;
  label: string;
  locked: boolean;
  mode: PlantingMode;
  mulched: boolean;
  notes: string;
  plantCount: number | null;
  plantedOn: LocalDateString | null;
  plannedFor: LocalDateString | null;
  matureHeightInches: number | null;
  matureSpreadInches: number | null;
  rowCount: number | null;
  rowLengthFt: number | null;
  rowSpacingFt: number | null;
  rowSpacingInches: number | null;
  spacingInches: number | null;
  status: PlantingLifecycleStatus;
  sunRequirement: SunExposure | null;
  trellisLengthFt: number | null;
  weeklyWaterNeedInches: number | null;
  xFt: number;
  yFt: number;
}

export interface PlantingInstance {
  id: string;
  label: string;
  xFt: number;
  yFt: number;
}

export interface SeasonCropSelection {
  cropId: string;
  id: string;
  notes: string;
  plantingForm: PlantingMode;
  quantity: number;
  supportAllowed: boolean;
  varietyName: string;
}

export interface SeasonPlan {
  updatedAtIso: IsoDateString | null;
  wantedCrops: SeasonCropSelection[];
}

export interface SunShadeArea {
  id: string;
  depthFt: number;
  exposure: SunExposure;
  microclimateNotes?: SunShadeMicroclimateNote[];
  shadeSources?: SunShadeSource[];
  source: 'manual' | 'modeled';
  sunHours: number;
  widthFt: number;
  xFt: number;
  yFt: number;
}

export interface SunShadeSource {
  heightFt: number;
  itemId: string;
  itemType: 'planting' | 'structure';
  kind: SunShadeSourceKind;
  label: string;
}

export interface SunShadeMicroclimateNote {
  description: string;
  id: string;
  kind: SunShadeMicroclimateKind;
  label: string;
  source: 'manual' | 'modeled';
}

export interface SunShadeLayer {
  areas: SunShadeArea[];
  cellSizeFt: number;
  fullSunHours: number | null;
  gardenId: string;
  generatedAtIso: IsoDateString | null;
  id: string;
  label: string;
  modelVersion: string;
  observedOn: LocalDateString | null;
  representativeDate: MonthDayString;
  season: 'fall' | 'spring' | 'summer' | 'winter';
}

export interface WeatherSnapshot {
  alertSummaries: string[];
  capturedAtIso: IsoDateString;
  conditionSummary: string;
  dataQuality?: GardenDataQuality;
  evapotranspirationIn: number | null;
  forecastRainNext24In: number | null;
  forecastRainNext48In: number | null;
  frostRisk: 'none' | 'warning' | 'watch';
  gardenId: string;
  heatRisk: 'none' | 'warning' | 'watch';
  humidityPercent: number | null;
  id: string;
  nextRainIso: IsoDateString | null;
  observedForDate: LocalDateString;
  overnightLowF: number | null;
  precipitationIn: number | null;
  providerDecision?: string | null;
  providerLabel?: string;
  recentPrecipitation72hIn: number | null;
  source: 'manual' | 'nationalWeatherService' | 'tomorrowIo';
  temperatureF: number | null;
  windMph: number | null;
}

export interface WaterRecommendation {
  dataQuality?: GardenDataQuality;
  deficitInches: number;
  generatedAtIso: IsoDateString;
  generatedBy?: WaterRecommendationGeneratedBy;
  gardenId: string;
  id: string;
  inchesNeeded: number;
  plantingId: string | null;
  rationale: string[];
  reason: string;
  recommendationDate: LocalDateString;
  recommendedWaterInches: number;
  refreshedAtIso?: IsoDateString;
  status: WaterRecommendationStatus;
  suppressUntilIso: IsoDateString | null;
  targetId: string;
  targetLabel: string;
  targetType: WaterRecommendationTargetType;
  urgency: WaterRecommendationUrgency;
  weatherSnapshotId: string | null;
}

export interface Task {
  bedLabel: string | null;
  completedAtIso: IsoDateString | null;
  createdAtIso: IsoDateString;
  delayReason?: string | null;
  delaySetAtIso?: IsoDateString | null;
  deferredUntilDate: LocalDateString | null;
  dueDate: LocalDateString | null;
  gardenId: string;
  id: string;
  notes: string;
  plantingId: string | null;
  priority: TaskPriority;
  snoozedUntilDate: LocalDateString | null;
  source: TaskSource;
  sourceId: string | null;
  status: TaskStatus;
  structureId: string | null;
  title: string;
  type: TaskType;
}

export interface JournalEntry {
  body: string;
  createdAtIso: IsoDateString;
  gardenId: string;
  id: string;
  issueCategory: JournalIssueCategory | null;
  issueSeverity: IssueSeverity | null;
  issueStatus: IssueStatus | null;
  occurredOn: LocalDateString;
  plantingId: string | null;
  photos: PhotoAttachment[];
  structureId: string | null;
  targetLabel: string;
  targetType: JournalTargetType;
  title: string;
  type: JournalEntryType;
  weatherSnapshotId: string | null;
}

export interface PhotoAttachment {
  contentType: string;
  downloadUrl: string;
  fileName: string;
  id: string;
  sizeBytes: number;
  storagePath: string;
  uploadedAtIso: IsoDateString;
}

export interface HarvestEvent {
  amountText: string;
  cropId: string | null;
  gardenId: string;
  harvestedOn: LocalDateString;
  id: string;
  notes: string;
  plantingId: string | null;
  quantity: number | null;
  unit: 'bunch' | 'count' | 'freeform' | 'lb' | 'oz';
}

export interface NotificationLog {
  acknowledgedAtIso?: IsoDateString | null;
  attemptCount?: number;
  body: string;
  channel: NotificationChannel;
  createdAtIso: IsoDateString;
  decisionReason?: string | null;
  dedupeKey?: string | null;
  deepLink?: string | null;
  dismissedAtIso?: IsoDateString | null;
  dryRun: boolean;
  errorMessage: string | null;
  gardenId: string | null;
  id: string;
  messageSummary: string;
  provider: 'firebaseCloudMessaging' | 'inApp' | null;
  providerMessageId?: string | null;
  providerStatus?: string | null;
  recipientRedacted: string;
  retryPolicy?: string | null;
  sentAtIso: IsoDateString | null;
  snoozedUntilIso?: IsoDateString | null;
  status: NotificationStatus;
  taskId: string | null;
  type: NotificationType;
  userId: string;
}

export interface Garden {
  climateProfile: ClimateProfile;
  harvestEvents: HarvestEvent[];
  id: string;
  journalEntries: JournalEntry[];
  name: string;
  notificationLogs: NotificationLog[];
  plantings: Planting[];
  plot: Plot;
  schemaVersion: number;
  seasonPlan: SeasonPlan;
  structures: Structure[];
  sunShadeLayers: SunShadeLayer[];
  tasks: Task[];
  updatedAtIso: IsoDateString | null;
  userId: string;
  waterRecommendations: WaterRecommendation[];
  weatherSnapshots: WeatherSnapshot[];
}

export type GardenPlot = Plot;
export type GardenPlant = Planting;

export const annArborLocation: GardenLocation = {
  latitude: 42.3314,
  locationName: 'Detroit, MI',
  locationQuery: 'Detroit, MI',
  longitude: -83.0458,
  timezone: 'America/Detroit',
};

export const annArborClimateProfile: ClimateProfile = {
  averageFirstFrost: '10-05',
  averageLastFrost: '05-10',
  editableByUser: true,
  hardinessZone: '6a',
  locationName: 'Detroit, MI',
  source: 'demoDefault',
  updatedAtIso: null,
};

export const defaultNotificationPreference: NotificationPreference = {
  alertTypes: {
    frost: true,
    heatStress: true,
    severeWeather: true,
    taskDue: true,
    watering: true,
  },
  channelConsent: {
    push: {
      consentCopyVersion: '2026-04-20',
      grantedAtIso: null,
      revokedAtIso: null,
      status: 'notRequested',
    },
  },
  channels: {
    inApp: true,
    push: false,
  },
  defaultWateringCheckTime: '07:00',
  frostAlertThresholdF: 36,
  pushPermission: 'unknown',
  pushTokenLastRegisteredAtIso: null,
  quietHours: {
    endLocalTime: '07:00',
    startLocalTime: '21:00',
  },
  timezone: 'America/Detroit',
  wateringAlertThresholdIn: 0.25,
};

export const defaultGardenPlot: Plot = {
  depthFt: 8,
  gridUnitFt: 1,
  location: annArborLocation,
  orientationDegrees: 0,
  snapUnitFt: 0.125,
  widthFt: 12,
};

export function createDefaultGarden(userId: string): Garden {
  return {
    climateProfile: annArborClimateProfile,
    harvestEvents: [],
    id: userId,
    journalEntries: [],
    name: 'Home garden',
    notificationLogs: [],
    plantings: [],
    plot: defaultGardenPlot,
    schemaVersion: CURRENT_GARDEN_SCHEMA_VERSION,
    seasonPlan: {
      updatedAtIso: null,
      wantedCrops: [],
    },
    structures: [],
    sunShadeLayers: [],
    tasks: [],
    updatedAtIso: null,
    userId,
    waterRecommendations: [],
    weatherSnapshots: [],
  };
}

export function createDefaultPlanting({
  id,
  label,
  xFt,
  yFt,
}: {
  id: string;
  label: string;
  xFt: number;
  yFt: number;
}): Planting {
  return {
    allowRelocation: false,
    blockDepthFt: null,
    blockWidthFt: null,
    clusterRadiusFt: null,
    cropId: null,
    id,
    instances: [
      {
        id: `${id}-plant-1`,
        label: label,
        xFt,
        yFt,
      },
    ],
    irrigationZone: null,
    label,
    locked: false,
    mode: 'single',
    mulched: false,
    notes: '',
    plantCount: 1,
    plantedOn: null,
    plannedFor: null,
    matureHeightInches: null,
    matureSpreadInches: null,
    rowCount: null,
    rowLengthFt: null,
    rowSpacingFt: null,
    rowSpacingInches: null,
    spacingInches: null,
    status: 'planned',
    sunRequirement: null,
    trellisLengthFt: null,
    weeklyWaterNeedInches: null,
    xFt,
    yFt,
  };
}

export function createDefaultStructure({
  accessibleMode = false,
  id,
  type,
  xFt,
  yFt,
}: {
  accessibleMode?: boolean;
  id: string;
  type: StructureType;
  xFt: number;
  yFt: number;
}): Structure {
  const footprint = getDefaultStructureFootprint(type, accessibleMode);

  return {
    accessiblePath: footprint.accessiblePath,
    canopyRadiusFt: footprint.canopyRadiusFt,
    continuousPath: footprint.continuousPath,
    depthFt: footprint.depthFt,
    drainageProfile: 'normal',
    heightFt: footprint.heightFt,
    id,
    irrigationZone: null,
    label: footprint.label,
    locked: false,
    material: footprint.material,
    mulched: false,
    notes: '',
    rotationDegrees: 0,
    soilType: 'unknown',
    type,
    widthFt: footprint.widthFt,
    workingClearanceFt: footprint.workingClearanceFt,
    xFt,
    yFt,
  };
}

function getDefaultStructureFootprint(
  type: StructureType,
  accessibleMode = false,
) {
  switch (type) {
    case 'raisedBed':
    case 'bed':
      return {
        accessiblePath: false,
        canopyRadiusFt: null,
        continuousPath: false,
        depthFt: 4,
        heightFt: 1.5,
        label: 'Raised bed',
        material: 'lumber' as const,
        widthFt: 8,
        workingClearanceFt: 2,
      };
    case 'inGroundBed':
      return {
        accessiblePath: false,
        canopyRadiusFt: null,
        continuousPath: false,
        depthFt: 4,
        heightFt: null,
        label: 'In-ground bed',
        material: 'soil' as const,
        widthFt: 10,
        workingClearanceFt: 2,
      };
    case 'container':
      return {
        accessiblePath: false,
        canopyRadiusFt: null,
        continuousPath: false,
        depthFt: 2,
        heightFt: 1.5,
        label: 'Container',
        material: 'mixed' as const,
        widthFt: 2,
        workingClearanceFt: 2,
      };
    case 'pathway':
    case 'path':
      return {
        accessiblePath: accessibleMode,
        canopyRadiusFt: null,
        continuousPath: true,
        depthFt: 8,
        heightFt: null,
        label: 'Pathway',
        material: 'woodChips' as const,
        widthFt: accessibleMode ? 4 : 3,
        workingClearanceFt: null,
      };
    case 'trellis':
      return {
        accessiblePath: false,
        canopyRadiusFt: null,
        continuousPath: false,
        depthFt: 0.5,
        heightFt: 6,
        label: 'Trellis',
        material: 'wire' as const,
        widthFt: 8,
        workingClearanceFt: 1,
      };
    case 'fenceWall':
    case 'fence':
      return {
        accessiblePath: false,
        canopyRadiusFt: null,
        continuousPath: false,
        depthFt: 0.5,
        heightFt: 6,
        label: 'Fence/wall',
        material: 'lumber' as const,
        widthFt: 10,
        workingClearanceFt: 1,
      };
    case 'treeObstacle':
      return {
        accessiblePath: false,
        canopyRadiusFt: 6,
        continuousPath: false,
        depthFt: 3,
        heightFt: 18,
        label: 'Legacy shade source',
        material: 'none' as const,
        widthFt: 3,
        workingClearanceFt: 3,
      };
    case 'compost':
      return {
        accessiblePath: false,
        canopyRadiusFt: null,
        continuousPath: false,
        depthFt: 2,
        heightFt: 3,
        label: 'Compost',
        material: 'lumber' as const,
        widthFt: 2,
        workingClearanceFt: 2,
      };
    case 'hoseBib':
    case 'waterSource':
      return {
        accessiblePath: false,
        canopyRadiusFt: null,
        continuousPath: false,
        depthFt: 1,
        heightFt: 3,
        label: type === 'hoseBib' ? 'Hose bib' : 'Water source',
        material: 'none' as const,
        widthFt: 1,
        workingClearanceFt: 2,
      };
    case 'other':
      return {
        accessiblePath: false,
        canopyRadiusFt: null,
        continuousPath: false,
        depthFt: 2,
        heightFt: 3,
        label: 'Structure',
        material: 'mixed' as const,
        widthFt: 2,
        workingClearanceFt: 2,
      };
  }
}

export function createDefaultUserProfile(
  uid: string,
  email: string,
): UserProfile {
  return {
    alertLocationQuery: annArborLocation.locationQuery,
    climateProfile: annArborClimateProfile,
    createdAtIso: null,
    defaultGardenId: uid,
    displayName: '',
    email,
    notificationPreference: {
      ...defaultNotificationPreference,
    },
    timezone: annArborLocation.timezone,
    uid,
    updatedAtIso: null,
  };
}
