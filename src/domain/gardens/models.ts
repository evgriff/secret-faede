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
  | 'inGroundBed'
  | 'path'
  | 'pathway'
  | 'raisedBed'
  | 'treeObstacle'
  | 'trellis'
  | 'waterSource'
  | 'other';

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
export type NotificationChannel = 'email' | 'inApp' | 'push' | 'carrier messaging';
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
export type CropSowMethod = 'both' | 'directSow' | 'transplant';
export type CropWaterNeed = 'high' | 'low' | 'medium';
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
export type IssueStatus = 'monitoring' | 'resolved' | 'todo';
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
  email: string | null;
  frostAlertThresholdF: number;
  phoneE164: string | null;
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
  snapUnitFt: 0.5;
  widthFt: number;
}

export interface Structure {
  canopyRadiusFt: number | null;
  depthFt: number;
  heightFt: number | null;
  id: string;
  label: string;
  mulched: boolean;
  notes: string;
  rotationDegrees: number;
  type: StructureType;
  widthFt: number;
  xFt: number;
  yFt: number;
}

export interface CropProfile {
  category: CropCategory;
  commonName: string;
  daysToMaturity: number | null;
  defaultIcon: string;
  family: string;
  frostSensitive: boolean;
  growthForm: CropGrowthForm;
  hardiness: string;
  id: string;
  lifecycle: CropLifecycle;
  matureHeightInches: number | null;
  matureSpreadInches: number | null;
  name: string;
  notes: string;
  perennialSuitability: string;
  rowSpacingInches: number | null;
  scientificName: string;
  spacingInches: number | null;
  sowMethod: CropSowMethod;
  supportedPlantingModes: PlantingMode[];
  sunExposure: SunExposure;
  sunRequirement: SunExposure;
  trellisRecommended: boolean;
  trellisRequired: boolean;
  weeklyWaterNeedInches: number | null;
  waterNeeds: CropWaterNeed;
}

export interface Planting {
  blockDepthFt: number | null;
  blockWidthFt: number | null;
  clusterRadiusFt: number | null;
  cropId: string | null;
  id: string;
  label: string;
  mode: PlantingMode;
  mulched: boolean;
  notes: string;
  plantCount: number | null;
  plantedOn: LocalDateString | null;
  matureHeightInches: number | null;
  matureSpreadInches: number | null;
  rowCount: number | null;
  rowLengthFt: number | null;
  rowSpacingFt: number | null;
  rowSpacingInches: number | null;
  spacingInches: number | null;
  status: 'growing' | 'harvested' | 'planned' | 'removed';
  sunRequirement: SunExposure | null;
  trellisLengthFt: number | null;
  weeklyWaterNeedInches: number | null;
  xFt: number;
  yFt: number;
}

export interface SunShadeArea {
  id: string;
  depthFt: number;
  exposure: SunExposure;
  source: 'manual' | 'modeled';
  sunHours: number;
  widthFt: number;
  xFt: number;
  yFt: number;
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
  recentPrecipitation72hIn: number | null;
  source: 'manual' | 'nationalWeatherService' | 'tomorrowIo';
  temperatureF: number | null;
  windMph: number | null;
}

export interface WaterRecommendation {
  deficitInches: number;
  generatedAtIso: IsoDateString;
  gardenId: string;
  id: string;
  inchesNeeded: number;
  plantingId: string | null;
  rationale: string[];
  reason: string;
  recommendationDate: LocalDateString;
  recommendedWaterInches: number;
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
  body: string;
  channel: NotificationChannel;
  createdAtIso: IsoDateString;
  dryRun: boolean;
  errorMessage: string | null;
  gardenId: string | null;
  id: string;
  messageSummary: string;
  provider: 'firebaseCloudMessaging' | 'inApp' | 'twilio' | null;
  recipientRedacted: string;
  sentAtIso: IsoDateString | null;
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
    email: {
      consentCopyVersion: '2026-04-20',
      grantedAtIso: null,
      revokedAtIso: null,
      status: 'notRequested',
    },
    push: {
      consentCopyVersion: '2026-04-20',
      grantedAtIso: null,
      revokedAtIso: null,
      status: 'notRequested',
    },
    carrier messaging: {
      consentCopyVersion: '2026-04-20',
      grantedAtIso: null,
      revokedAtIso: null,
      status: 'notRequested',
    },
  },
  channels: {
    email: false,
    inApp: true,
    push: false,
    carrier messaging: false,
  },
  defaultWateringCheckTime: '07:00',
  email: null,
  frostAlertThresholdF: 36,
  phoneE164: null,
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
  snapUnitFt: 0.5,
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
    blockDepthFt: null,
    blockWidthFt: null,
    clusterRadiusFt: null,
    cropId: null,
    id,
    label,
    mode: 'single',
    mulched: false,
    notes: '',
    plantCount: 1,
    plantedOn: null,
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
  id,
  type,
  xFt,
  yFt,
}: {
  id: string;
  type: StructureType;
  xFt: number;
  yFt: number;
}): Structure {
  const footprint = getDefaultStructureFootprint(type);

  return {
    canopyRadiusFt: footprint.canopyRadiusFt,
    depthFt: footprint.depthFt,
    heightFt: footprint.heightFt,
    id,
    label: footprint.label,
    mulched: false,
    notes: '',
    rotationDegrees: 0,
    type,
    widthFt: footprint.widthFt,
    xFt,
    yFt,
  };
}

function getDefaultStructureFootprint(type: StructureType) {
  switch (type) {
    case 'raisedBed':
    case 'bed':
      return {
        canopyRadiusFt: null,
        depthFt: 4,
        heightFt: 1.5,
        label: 'Raised bed',
        widthFt: 8,
      };
    case 'inGroundBed':
      return {
        canopyRadiusFt: null,
        depthFt: 4,
        heightFt: null,
        label: 'In-ground bed',
        widthFt: 10,
      };
    case 'container':
      return {
        canopyRadiusFt: null,
        depthFt: 2,
        heightFt: 1.5,
        label: 'Container',
        widthFt: 2,
      };
    case 'pathway':
    case 'path':
      return {
        canopyRadiusFt: null,
        depthFt: 8,
        heightFt: null,
        label: 'Pathway',
        widthFt: 3,
      };
    case 'trellis':
      return {
        canopyRadiusFt: null,
        depthFt: 0.5,
        heightFt: 6,
        label: 'Trellis',
        widthFt: 8,
      };
    case 'fenceWall':
    case 'fence':
      return {
        canopyRadiusFt: null,
        depthFt: 0.5,
        heightFt: 6,
        label: 'Fence/wall',
        widthFt: 10,
      };
    case 'treeObstacle':
      return {
        canopyRadiusFt: 6,
        depthFt: 3,
        heightFt: 18,
        label: 'Tree/obstacle',
        widthFt: 3,
      };
    case 'compost':
      return {
        canopyRadiusFt: null,
        depthFt: 2,
        heightFt: 3,
        label: 'Compost',
        widthFt: 2,
      };
    case 'waterSource':
      return {
        canopyRadiusFt: null,
        depthFt: 1,
        heightFt: 3,
        label: 'Water source',
        widthFt: 1,
      };
    case 'other':
      return {
        canopyRadiusFt: null,
        depthFt: 2,
        heightFt: 3,
        label: 'Structure',
        widthFt: 2,
      };
  }
}

export function createDefaultUserProfile(
  uid: string,
  email: string,
  phoneE164: string | null = null,
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
      email,
      phoneE164,
    },
    timezone: annArborLocation.timezone,
    uid,
    updatedAtIso: null,
  };
}
