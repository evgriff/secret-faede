import {
  annArborClimateProfile,
  annArborLocation,
  defaultGardenPlot,
  defaultNotificationPreference,
  type ClimateProfile,
  type CropProfile,
  type Garden,
  type GardenLocation,
  type HarvestEvent,
  type JournalEntry,
  type NotificationAlertType,
  type NotificationChannel,
  type NotificationConsent,
  type NotificationLog,
  type PhotoAttachment,
  type NotificationPreference,
  type Planting,
  type PlantingMode,
  type Plot,
  type SeasonCropCommitment,
  type SeasonCropPriority,
  type SeasonCropSelection,
  type SeasonCropSowPreference,
  type SeasonPlan,
  type Structure,
  type SunShadeLayer,
  type Task,
  type UserProfile,
  type WaterRecommendation,
  type WeatherSnapshot,
} from './models';
import {
  CURRENT_GARDEN_SCHEMA_VERSION,
  migrateGardenRecord,
} from './schemaMigrations';

const plantingModes = [
  'block',
  'cluster',
  'row',
  'single',
  'trellisLine',
] as const satisfies PlantingMode[];
const notificationChannels = [
  'email',
  'inApp',
  'push',
  'carrier messaging',
] as const satisfies NotificationChannel[];
const notificationAlertTypes = [
  'frost',
  'heatStress',
  'severeWeather',
  'taskDue',
  'watering',
] as const satisfies NotificationAlertType[];
const seasonCropCommitments = [
  'mustGrow',
  'niceToHave',
] as const satisfies SeasonCropCommitment[];
const seasonCropPriorities = [
  'high',
  'low',
  'medium',
] as const satisfies SeasonCropPriority[];
const seasonCropSowPreferences = [
  'directSow',
  'noPreference',
  'transplant',
] as const satisfies SeasonCropSowPreference[];

function isPlantingMode(value: unknown): value is PlantingMode {
  return (
    typeof value === 'string' &&
    (plantingModes as readonly string[]).includes(value)
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

export function readNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function readStringArray(value: unknown, fallback: string[] = []) {
  return Array.isArray(value)
    ? value.flatMap((entry): string[] =>
        typeof entry === 'string' && entry.trim() ? [entry] : [],
      )
    : fallback;
}

export function readNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function readNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === 'boolean' ? value : fallback;
}

export function readStringUnion<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return typeof value === 'string' && allowed.includes(value)
    ? value
    : fallback;
}

export function readNullableStringUnion<T extends readonly string[]>(
  value: unknown,
  allowed: T,
): T[number] | null {
  return typeof value === 'string' && allowed.includes(value) ? value : null;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function sanitizePlotDimension(value: unknown, fallback: number) {
  return Math.round(clamp(readNumber(value, fallback), 1, 100));
}

export function sanitizeFootPosition(value: unknown, max: number) {
  return clamp(Number(readNumber(value, 0).toFixed(3)), 0, max);
}

export function parseClimateProfile(value: unknown): ClimateProfile {
  if (!isRecord(value)) {
    return annArborClimateProfile;
  }

  return {
    averageFirstFrost: readString(
      value.averageFirstFrost,
      annArborClimateProfile.averageFirstFrost,
    ),
    averageLastFrost: readString(
      value.averageLastFrost,
      annArborClimateProfile.averageLastFrost,
    ),
    editableByUser: readBoolean(value.editableByUser, true),
    hardinessZone: readString(
      value.hardinessZone,
      annArborClimateProfile.hardinessZone,
    ),
    locationName: readString(
      value.locationName,
      annArborClimateProfile.locationName,
    ),
    source: readStringUnion(
      value.source,
      ['demoDefault', 'user'] as const,
      'user',
    ),
    updatedAtIso: readNullableString(value.updatedAtIso),
  };
}

export function parseGardenLocation(value: unknown): GardenLocation {
  if (!isRecord(value)) {
    return annArborLocation;
  }

  return {
    latitude: readNullableNumber(value.latitude),
    locationName: readString(value.locationName, annArborLocation.locationName),
    locationQuery: readString(
      value.locationQuery,
      annArborLocation.locationQuery,
    ),
    longitude: readNullableNumber(value.longitude),
    timezone: readString(value.timezone, annArborLocation.timezone),
  };
}

export function parsePlot(value: unknown): Plot {
  if (!isRecord(value)) {
    return defaultGardenPlot;
  }

  return {
    depthFt: sanitizePlotDimension(value.depthFt, defaultGardenPlot.depthFt),
    gridUnitFt: 1,
    location: parseGardenLocation(value.location),
    orientationDegrees: clamp(readNumber(value.orientationDegrees, 0), 0, 359),
    snapUnitFt: defaultGardenPlot.snapUnitFt,
    widthFt: sanitizePlotDimension(value.widthFt, defaultGardenPlot.widthFt),
  };
}

export function parseNotificationPreference(
  value: unknown,
): NotificationPreference {
  if (!isRecord(value)) {
    return defaultNotificationPreference;
  }

  const channelsValue = isRecord(value.channels) ? value.channels : {};
  const alertTypesValue = isRecord(value.alertTypes) ? value.alertTypes : {};
  const consentValue = isRecord(value.channelConsent)
    ? value.channelConsent
    : {};
  const quietHoursValue = isRecord(value.quietHours) ? value.quietHours : {};
  const alertTypes = Object.fromEntries(
    notificationAlertTypes.map((alertType) => [
      alertType,
      readBoolean(
        alertTypesValue[alertType],
        defaultNotificationPreference.alertTypes[alertType],
      ),
    ]),
  ) as Record<NotificationAlertType, boolean>;
  const channels = Object.fromEntries(
    notificationChannels.map((channel) => [
      channel,
      readBoolean(
        channelsValue[channel],
        defaultNotificationPreference.channels[channel],
      ),
    ]),
  ) as Record<NotificationChannel, boolean>;

  return {
    alertTypes,
    channelConsent: {
      email: parseNotificationConsent(
        consentValue.email,
        defaultNotificationPreference.channelConsent.email,
      ),
      push: parseNotificationConsent(
        consentValue.push,
        defaultNotificationPreference.channelConsent.push,
      ),
      carrier messaging: parseNotificationConsent(
        consentValue.carrier messaging,
        defaultNotificationPreference.channelConsent.carrier messaging,
      ),
    },
    channels,
    defaultWateringCheckTime: readString(
      value.defaultWateringCheckTime,
      defaultNotificationPreference.defaultWateringCheckTime,
    ),
    email: readNullableString(value.email),
    frostAlertThresholdF: readNumber(
      value.frostAlertThresholdF,
      defaultNotificationPreference.frostAlertThresholdF,
    ),
    phoneE164: readNullableString(value.phoneE164),
    pushPermission: readStringUnion(
      value.pushPermission,
      ['default', 'denied', 'granted', 'unsupported', 'unknown'] as const,
      defaultNotificationPreference.pushPermission,
    ),
    pushTokenLastRegisteredAtIso: readNullableString(
      value.pushTokenLastRegisteredAtIso,
    ),
    quietHours: {
      endLocalTime: readString(
        quietHoursValue.endLocalTime,
        defaultNotificationPreference.quietHours.endLocalTime,
      ),
      startLocalTime: readString(
        quietHoursValue.startLocalTime,
        defaultNotificationPreference.quietHours.startLocalTime,
      ),
    },
    timezone: readString(
      value.timezone,
      defaultNotificationPreference.timezone,
    ),
    wateringAlertThresholdIn: readNumber(
      value.wateringAlertThresholdIn,
      defaultNotificationPreference.wateringAlertThresholdIn,
    ),
  };
}

function parseNotificationConsent(
  value: unknown,
  fallback: NotificationConsent = {
    consentCopyVersion: '2026-04-20',
    grantedAtIso: null,
    revokedAtIso: null,
    status: 'notRequested',
  },
): NotificationConsent {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    consentCopyVersion: readString(
      value.consentCopyVersion,
      fallback.consentCopyVersion,
    ),
    grantedAtIso: readNullableString(value.grantedAtIso),
    revokedAtIso: readNullableString(value.revokedAtIso),
    status: readStringUnion(
      value.status,
      ['denied', 'granted', 'notRequested', 'revoked'] as const,
      fallback.status,
    ),
  };
}

export function parseUserProfile(
  uid: string,
  email: string,
  value: unknown,
): UserProfile {
  const record = isRecord(value) ? value : {};

  return {
    alertLocationQuery: readString(
      record.alertLocationQuery,
      annArborLocation.locationQuery,
    ),
    climateProfile: parseClimateProfile(record.climateProfile),
    createdAtIso: readNullableString(record.createdAtIso),
    defaultGardenId: readString(record.defaultGardenId, uid),
    displayName: readString(record.displayName),
    email: readString(record.email, email),
    notificationPreference: parseNotificationPreference(
      record.notificationPreference,
    ),
    timezone: readString(record.timezone, annArborLocation.timezone),
    uid,
    updatedAtIso: readNullableString(record.updatedAtIso),
  };
}

export function parseStructure(value: unknown, plot: Plot): Structure | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  const widthFt = clamp(readNumber(value.widthFt, 1), 0.25, plot.widthFt);
  const depthFt = clamp(readNumber(value.depthFt, 1), 0.25, plot.depthFt);
  const type = readStringUnion(
    value.type,
    [
      'bed',
      'compost',
      'container',
      'fence',
      'fenceWall',
      'hoseBib',
      'inGroundBed',
      'path',
      'pathway',
      'raisedBed',
      'treeObstacle',
      'trellis',
      'waterSource',
      'other',
    ] as const,
    'other',
  );
  const isPath = type === 'path' || type === 'pathway';

  return {
    accessiblePath: readBoolean(value.accessiblePath, isPath && widthFt >= 4),
    canopyRadiusFt: readNullableNumber(value.canopyRadiusFt),
    continuousPath: readBoolean(value.continuousPath, isPath),
    depthFt,
    drainageProfile: readStringUnion(
      value.drainageProfile,
      ['fast', 'normal', 'slow', 'unknown'] as const,
      'normal',
    ),
    heightFt: readNullableNumber(value.heightFt),
    id: value.id,
    irrigationZone: readNullableString(value.irrigationZone),
    label: readString(value.label, 'Structure'),
    locked: readBoolean(value.locked, false),
    material: readStringUnion(
      value.material,
      [
        'gravel',
        'lumber',
        'metal',
        'mixed',
        'mulch',
        'none',
        'pavers',
        'soil',
        'stone',
        'wire',
        'woodChips',
      ] as const,
      getDefaultStructureMaterial(type),
    ),
    mulched: readBoolean(value.mulched, false),
    notes: readString(value.notes),
    rotationDegrees: clamp(readNumber(value.rotationDegrees, 0), 0, 359),
    soilType: readStringUnion(
      value.soilType,
      ['clay', 'loam', 'sandy', 'unknown'] as const,
      'unknown',
    ),
    type,
    widthFt,
    workingClearanceFt:
      typeof value.workingClearanceFt === 'number' &&
      Number.isFinite(value.workingClearanceFt)
        ? clamp(value.workingClearanceFt, 0, 12)
        : getDefaultWorkingClearanceFt(type),
    xFt: sanitizeFootPosition(value.xFt, Math.max(plot.widthFt - widthFt, 0)),
    yFt: sanitizeFootPosition(value.yFt, Math.max(plot.depthFt - depthFt, 0)),
  };
}

function getDefaultStructureMaterial(type: Structure['type']) {
  switch (type) {
    case 'bed':
    case 'compost':
    case 'fence':
    case 'fenceWall':
    case 'raisedBed':
      return 'lumber';
    case 'inGroundBed':
      return 'soil';
    case 'path':
    case 'pathway':
      return 'woodChips';
    case 'trellis':
      return 'wire';
    case 'hoseBib':
    case 'treeObstacle':
    case 'waterSource':
      return 'none';
    case 'container':
    case 'other':
      return 'mixed';
  }
}

function getDefaultWorkingClearanceFt(type: Structure['type']) {
  if (type === 'path' || type === 'pathway') {
    return null;
  }

  if (type === 'treeObstacle') {
    return 3;
  }

  if (type === 'fence' || type === 'fenceWall' || type === 'trellis') {
    return 1;
  }

  return 2;
}

export function parsePlanting(value: unknown, plot: Plot): Planting | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  return {
    allowRelocation: readBoolean(value.allowRelocation, false),
    blockDepthFt: readNullableNumber(value.blockDepthFt),
    blockWidthFt: readNullableNumber(value.blockWidthFt),
    clusterRadiusFt: readNullableNumber(value.clusterRadiusFt),
    cropId: readNullableString(value.cropId),
    id: value.id,
    irrigationZone: readNullableString(value.irrigationZone),
    label: readString(value.label, 'Planting'),
    locked: readBoolean(value.locked, false),
    mode: readStringUnion(value.mode, plantingModes, 'single'),
    mulched: readBoolean(value.mulched, false),
    notes: readString(value.notes),
    plantCount: readNullableNumber(value.plantCount),
    plantedOn: readNullableString(value.plantedOn),
    plannedFor: readNullableString(value.plannedFor),
    matureHeightInches: readNullableNumber(value.matureHeightInches),
    matureSpreadInches: readNullableNumber(value.matureSpreadInches),
    rowCount: readNullableNumber(value.rowCount),
    rowLengthFt: readNullableNumber(value.rowLengthFt),
    rowSpacingFt: readNullableNumber(value.rowSpacingFt),
    rowSpacingInches: readNullableNumber(value.rowSpacingInches),
    spacingInches: readNullableNumber(value.spacingInches),
    status: readStringUnion(
      value.status,
      [
        'growing',
        'harvest-ready',
        'harvested',
        'planned',
        'planted',
        'removed',
      ] as const,
      'planned',
    ),
    sunRequirement:
      isRecord(value) && value.sunRequirement
        ? readStringUnion(
            value.sunRequirement,
            ['fullShade', 'fullSun', 'partShade', 'partSun'] as const,
            'fullSun',
          )
        : null,
    trellisLengthFt: readNullableNumber(value.trellisLengthFt),
    weeklyWaterNeedInches: readNullableNumber(value.weeklyWaterNeedInches),
    xFt: sanitizeFootPosition(value.xFt, plot.widthFt),
    yFt: sanitizeFootPosition(value.yFt, plot.depthFt),
  };
}

export function parsePlantings(value: unknown, plot: Plot): Planting[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((planting): Planting[] => {
    const parsed = parsePlanting(planting, plot);
    return parsed ? [parsed] : [];
  });
}

export function parseSeasonPlan(value: unknown): SeasonPlan {
  if (!isRecord(value)) {
    return {
      updatedAtIso: null,
      wantedCrops: [],
    };
  }

  return {
    updatedAtIso: readNullableString(value.updatedAtIso),
    wantedCrops: parseSeasonCropSelections(value.wantedCrops),
  };
}

export function parseSeasonCropSelections(
  value: unknown,
): SeasonCropSelection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((selection, index): SeasonCropSelection[] => {
    const parsed = parseSeasonCropSelection(selection, index);

    return parsed ? [parsed] : [];
  });
}

export function parseSeasonCropSelection(
  value: unknown,
  index = 0,
): SeasonCropSelection | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  const cropId = readString(value.cropId).trim();

  if (!cropId) {
    return null;
  }

  return {
    commitment: readStringUnion(
      value.commitment,
      seasonCropCommitments,
      'niceToHave',
    ),
    containerAllowed: readBoolean(value.containerAllowed, true),
    cropId,
    id: value.id,
    modePreference: readStringUnion(
      value.modePreference,
      plantingModes,
      'single',
    ),
    notes: readString(value.notes),
    priority: readStringUnion(value.priority, seasonCropPriorities, 'medium'),
    rank: Math.round(clamp(readNumber(value.rank, index), 0, 999)),
    sowPreference: readStringUnion(
      value.sowPreference,
      seasonCropSowPreferences,
      'noPreference',
    ),
    supportAllowed: readBoolean(value.supportAllowed, false),
    targetQuantity: Math.round(
      clamp(
        readNumber(value.targetQuantity, readNumber(value.quantity, 1)),
        1,
        999,
      ),
    ),
    varietyName: readString(value.varietyName),
  };
}

export function parseStructures(value: unknown, plot: Plot): Structure[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((structure): Structure[] => {
    const parsed = parseStructure(structure, plot);
    return parsed ? [parsed] : [];
  });
}

export function parseTask(value: unknown): Task | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  const delayReason = readNullableString(value.delayReason);
  const delaySetAtIso = readNullableString(value.delaySetAtIso);

  return {
    bedLabel: readNullableString(value.bedLabel),
    completedAtIso: readNullableString(value.completedAtIso),
    createdAtIso: readString(value.createdAtIso, ''),
    ...(delayReason ? { delayReason } : {}),
    ...(delaySetAtIso ? { delaySetAtIso } : {}),
    deferredUntilDate: readNullableString(value.deferredUntilDate),
    dueDate: readNullableString(value.dueDate),
    gardenId: readString(value.gardenId),
    id: value.id,
    notes: readString(value.notes),
    plantingId: readNullableString(value.plantingId),
    priority: readStringUnion(
      value.priority,
      ['high', 'low', 'medium'] as const,
      'medium',
    ),
    snoozedUntilDate: readNullableString(value.snoozedUntilDate),
    source: readStringUnion(
      value.source,
      ['generated', 'manual', 'succession', 'waterRecommendation'] as const,
      'manual',
    ),
    sourceId: readNullableString(value.sourceId),
    status: readStringUnion(
      value.status,
      ['done', 'open', 'skipped'] as const,
      'open',
    ),
    structureId: readNullableString(value.structureId),
    title: readString(value.title, 'Garden task'),
    type: readStringUnion(
      value.type,
      [
        'amend',
        'fertilize',
        'harvest',
        'inspect',
        'mulch',
        'plant',
        'prune',
        'sow',
        'thin',
        'transplant',
        'trellis',
        'water',
        'weed',
        'other',
      ] as const,
      'other',
    ),
  };
}

export function parseJournalEntry(value: unknown): JournalEntry | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }
  const plantingId = readNullableString(value.plantingId);
  const structureId = readNullableString(value.structureId);

  return {
    body: readString(value.body),
    createdAtIso: readString(value.createdAtIso, ''),
    gardenId: readString(value.gardenId),
    id: value.id,
    issueCategory: readNullableStringUnion(value.issueCategory, [
      'disease',
      'general',
      'irrigation',
      'nutrient',
      'pest',
      'weatherDamage',
    ] as const),
    issueSeverity: readNullableStringUnion(value.issueSeverity, [
      'high',
      'low',
      'medium',
    ] as const),
    issueStatus: parseIssueStatus(value.issueStatus),
    occurredOn: readString(value.occurredOn),
    photos: parsePhotoAttachments(value.photos),
    plantingId,
    structureId,
    targetLabel: readString(value.targetLabel, 'Whole garden'),
    targetType: readStringUnion(
      value.targetType,
      ['garden', 'planting', 'structure'] as const,
      plantingId ? 'planting' : structureId ? 'structure' : 'garden',
    ),
    title: readString(value.title, 'Garden note'),
    type: readStringUnion(value.type, ['issue', 'note'] as const, 'note'),
    weatherSnapshotId: readNullableString(value.weatherSnapshotId),
  };
}

export function parsePhotoAttachment(value: unknown): PhotoAttachment | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  return {
    contentType: readString(value.contentType, 'application/octet-stream'),
    downloadUrl: readString(value.downloadUrl),
    fileName: readString(value.fileName, 'photo'),
    id: value.id,
    sizeBytes: readNumber(value.sizeBytes, 0),
    storagePath: readString(value.storagePath),
    uploadedAtIso: readString(value.uploadedAtIso, ''),
  };
}

export function parsePhotoAttachments(value: unknown): PhotoAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((photo): PhotoAttachment[] => {
    const parsed = parsePhotoAttachment(photo);
    return parsed ? [parsed] : [];
  });
}

export function parseHarvestEvent(value: unknown): HarvestEvent | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  return {
    amountText: readString(value.amountText),
    cropId: readNullableString(value.cropId),
    gardenId: readString(value.gardenId),
    harvestedOn: readString(value.harvestedOn),
    id: value.id,
    notes: readString(value.notes),
    plantingId: readNullableString(value.plantingId),
    quantity: readNullableNumber(value.quantity),
    unit: readStringUnion(
      value.unit,
      ['bunch', 'count', 'freeform', 'lb', 'oz'] as const,
      'count',
    ),
  };
}

export function parseNotificationLog(value: unknown): NotificationLog | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  return {
    acknowledgedAtIso: readNullableString(value.acknowledgedAtIso),
    attemptCount: readNumber(value.attemptCount, 0),
    body: readString(value.body),
    channel: readStringUnion(
      value.channel,
      ['email', 'inApp', 'push', 'carrier messaging'] as const,
      'inApp',
    ),
    createdAtIso: readString(value.createdAtIso, ''),
    decisionReason: readNullableString(value.decisionReason),
    dedupeKey: readNullableString(value.dedupeKey),
    deepLink: readNullableString(value.deepLink),
    dismissedAtIso: readNullableString(value.dismissedAtIso),
    dryRun: readBoolean(value.dryRun, false),
    errorMessage: readNullableString(value.errorMessage),
    gardenId: readNullableString(value.gardenId),
    id: value.id,
    messageSummary: readString(value.messageSummary),
    provider: readNotificationProvider(value.provider),
    providerMessageId: readNullableString(value.providerMessageId),
    providerStatus: readNullableString(value.providerStatus),
    recipientRedacted: readString(value.recipientRedacted),
    retryPolicy: readNullableString(value.retryPolicy),
    sentAtIso: readNullableString(value.sentAtIso),
    snoozedUntilIso: readNullableString(value.snoozedUntilIso),
    status: readStringUnion(
      value.status,
      ['failed', 'queued', 'sent', 'skipped'] as const,
      'queued',
    ),
    taskId: readNullableString(value.taskId),
    type: readStringUnion(
      value.type,
      [
        'frost',
        'heatStress',
        'severeWeather',
        'task',
        'taskDue',
        'watering',
        'weather',
      ] as const,
      'task',
    ),
    userId: readString(value.userId),
  };
}

function readNotificationProvider(value: unknown): NotificationLog['provider'] {
  const providers = ['firebaseCloudMessaging', 'inApp', 'retiredDeliveryProvider'] as const;

  return typeof value === 'string'
    ? (providers.find((provider) => provider === value) ?? null)
    : null;
}

function parseIssueStatus(value: unknown) {
  if (value === 'todo') {
    return 'open';
  }

  if (value === 'monitoring') {
    return 'inProgress';
  }

  return readNullableStringUnion(value, [
    'inProgress',
    'open',
    'resolved',
  ] as const);
}

export function parseCropProfile(value: unknown): CropProfile | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  return {
    aliases: readStringArray(value.aliases),
    category: readStringUnion(
      value.category,
      [
        'brassica',
        'flower',
        'fruit',
        'grain',
        'herb',
        'leafyGreen',
        'legume',
        'root',
        'vegetable',
      ] as const,
      'vegetable',
    ),
    caution: readNullableString(value.caution),
    commonName: readString(value.commonName, readString(value.name, 'Crop')),
    completenessScore: readNumber(value.completenessScore, 0.5),
    daysToMaturity: readNullableNumber(value.daysToMaturity),
    defaultIcon: readString(value.defaultIcon, 'seedling'),
    family: readString(value.family),
    frostSensitive: readBoolean(value.frostSensitive, false),
    growthForm: readStringUnion(
      value.growthForm,
      [
        'bulb',
        'bush',
        'climber',
        'clump',
        'groundcover',
        'rosette',
        'root',
        'upright',
        'vining',
      ] as const,
      'upright',
    ),
    hardiness: readString(value.hardiness),
    id: value.id,
    lifecycle: readStringUnion(
      value.lifecycle,
      ['annual', 'biennial', 'perennial'] as const,
      'annual',
    ),
    lastRefreshedIso: readNullableString(value.lastRefreshedIso),
    manualOverride: readBoolean(value.manualOverride, false),
    matureHeightInches: readNullableNumber(value.matureHeightInches),
    matureSpreadInches: readNullableNumber(value.matureSpreadInches),
    name: readString(value.name, 'Crop'),
    notes: readString(value.notes),
    perennialSuitability: readString(value.perennialSuitability),
    pollinatorRole: readNullableString(value.pollinatorRole),
    profileConfidence: readStringUnion(
      value.profileConfidence,
      ['complete', 'needsReview', 'partial'] as const,
      'needsReview',
    ),
    rowSpacingInches: readNullableNumber(value.rowSpacingInches),
    rootDepthInches: readNullableNumber(value.rootDepthInches),
    roles: readStringArray(value.roles),
    scientificName: readString(value.scientificName),
    spacingInches: readNullableNumber(value.spacingInches),
    sowMethod: readStringUnion(
      value.sowMethod,
      ['both', 'directSow', 'transplant'] as const,
      'both',
    ),
    source: readString(value.source, 'unknown'),
    supportedPlantingModes: Array.isArray(value.supportedPlantingModes)
      ? value.supportedPlantingModes.flatMap((mode): PlantingMode[] =>
          isPlantingMode(mode) ? [mode] : [],
        )
      : ['single'],
    sourceTags: readStringArray(value.sourceTags, ['imported']),
    synonyms: readStringArray(value.synonyms),
    sunExposure: readStringUnion(
      value.sunExposure,
      ['fullShade', 'fullSun', 'partShade', 'partSun'] as const,
      'fullSun',
    ),
    sunRequirement: readStringUnion(
      value.sunRequirement,
      ['fullShade', 'fullSun', 'partShade', 'partSun'] as const,
      'fullSun',
    ),
    trellisRecommended: readBoolean(
      value.trellisRecommended,
      readBoolean(value.trellisRequired, false),
    ),
    trellisRequired: readBoolean(value.trellisRequired, false),
    varietyGroup: readNullableString(value.varietyGroup),
    weeklyWaterNeedInches: readNullableNumber(value.weeklyWaterNeedInches),
    waterNeeds: readStringUnion(
      value.waterNeeds,
      ['high', 'low', 'medium'] as const,
      'medium',
    ),
  };
}

export function parseSunShadeLayer(value: unknown): SunShadeLayer | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  return {
    areas: Array.isArray(value.areas)
      ? value.areas.flatMap((area): SunShadeLayer['areas'] => {
          if (!isRecord(area) || typeof area.id !== 'string') {
            return [];
          }
          const shadeSources = parseSunShadeSources(area.shadeSources);
          const microclimateNotes = parseSunShadeMicroclimateNotes(
            area.microclimateNotes,
          );

          return [
            {
              depthFt: readNumber(area.depthFt, 1),
              exposure: readStringUnion(
                area.exposure,
                ['fullShade', 'fullSun', 'partShade', 'partSun'] as const,
                'partSun',
              ),
              id: area.id,
              ...(microclimateNotes.length > 0 ? { microclimateNotes } : {}),
              ...(shadeSources.length > 0 ? { shadeSources } : {}),
              source: readStringUnion(
                area.source,
                ['manual', 'modeled'] as const,
                'modeled',
              ),
              sunHours: Math.max(readNumber(area.sunHours, 0), 0),
              widthFt: readNumber(area.widthFt, 1),
              xFt: readNumber(area.xFt, 0),
              yFt: readNumber(area.yFt, 0),
            },
          ];
        })
      : [],
    cellSizeFt: readNumber(value.cellSizeFt, 1),
    fullSunHours: readNullableNumber(value.fullSunHours),
    gardenId: readString(value.gardenId),
    generatedAtIso: readNullableString(value.generatedAtIso),
    id: value.id,
    label: readString(value.label, 'Sun/shade layer'),
    modelVersion: readString(value.modelVersion, 'manual'),
    observedOn: readNullableString(value.observedOn),
    representativeDate: readString(value.representativeDate, '06-21'),
    season: readStringUnion(
      value.season,
      ['fall', 'spring', 'summer', 'winter'] as const,
      'summer',
    ),
  };
}

function parseSunShadeSources(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(
    (source): NonNullable<SunShadeLayer['areas'][number]['shadeSources']> => {
      if (!isRecord(source)) {
        return [];
      }

      const itemId = readString(source.itemId).trim();
      const label = readString(source.label).trim();

      if (!itemId || !label) {
        return [];
      }

      return [
        {
          heightFt: Math.max(readNumber(source.heightFt, 0), 0),
          itemId,
          itemType: readStringUnion(
            source.itemType,
            ['planting', 'structure'] as const,
            'structure',
          ),
          kind: readStringUnion(
            source.kind,
            [
              'fenceWall',
              'structure',
              'tallCrop',
              'treeObstacle',
              'trellisedCrop',
              'trellis',
            ] as const,
            'structure',
          ),
          label,
        },
      ];
    },
  );
}

function parseSunShadeMicroclimateNotes(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(
    (
      note,
    ): NonNullable<SunShadeLayer['areas'][number]['microclimateNotes']> => {
      if (!isRecord(note) || typeof note.id !== 'string') {
        return [];
      }

      const label = readString(note.label).trim();

      if (!label) {
        return [];
      }

      return [
        {
          description: readString(note.description),
          id: note.id,
          kind: readStringUnion(
            note.kind,
            [
              'coolShadePocket',
              'reflectedHeat',
              'westHeat',
              'windExposedEdge',
            ] as const,
            'coolShadePocket',
          ),
          label,
          source: readStringUnion(
            note.source,
            ['manual', 'modeled'] as const,
            'modeled',
          ),
        },
      ];
    },
  );
}

export function parseWeatherSnapshot(value: unknown): WeatherSnapshot | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  return {
    alertSummaries: Array.isArray(value.alertSummaries)
      ? value.alertSummaries.flatMap((summary): string[] =>
          typeof summary === 'string' ? [summary] : [],
        )
      : [],
    capturedAtIso: readString(value.capturedAtIso),
    conditionSummary: readString(value.conditionSummary),
    dataQuality: readStringUnion(
      value.dataQuality,
      ['complete', 'limited', 'partial'] as const,
      'limited',
    ),
    evapotranspirationIn: readNullableNumber(value.evapotranspirationIn),
    forecastRainNext24In: readNullableNumber(value.forecastRainNext24In),
    forecastRainNext48In: readNullableNumber(value.forecastRainNext48In),
    frostRisk: readStringUnion(
      value.frostRisk,
      ['none', 'warning', 'watch'] as const,
      'none',
    ),
    gardenId: readString(value.gardenId),
    heatRisk: readStringUnion(
      value.heatRisk,
      ['none', 'warning', 'watch'] as const,
      'none',
    ),
    humidityPercent: readNullableNumber(value.humidityPercent),
    id: value.id,
    nextRainIso: readNullableString(value.nextRainIso),
    observedForDate: readString(value.observedForDate),
    overnightLowF: readNullableNumber(value.overnightLowF),
    precipitationIn: readNullableNumber(value.precipitationIn),
    providerDecision: readNullableString(value.providerDecision),
    providerLabel: readString(value.providerLabel),
    recentPrecipitation72hIn: readNullableNumber(
      value.recentPrecipitation72hIn,
    ),
    source: readStringUnion(
      value.source,
      ['manual', 'nationalWeatherService', 'tomorrowIo'] as const,
      'manual',
    ),
    temperatureF: readNullableNumber(value.temperatureF),
    windMph: readNullableNumber(value.windMph),
  };
}

export function parseWaterRecommendation(
  value: unknown,
): WaterRecommendation | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null;
  }

  return {
    dataQuality: readStringUnion(
      value.dataQuality,
      ['complete', 'limited', 'partial'] as const,
      'limited',
    ),
    deficitInches: Math.max(
      readNumber(value.deficitInches, readNumber(value.inchesNeeded, 0)),
      0,
    ),
    generatedAtIso: readString(value.generatedAtIso),
    generatedBy: readStringUnion(
      value.generatedBy,
      ['backend', 'client', 'manualRefresh'] as const,
      'client',
    ),
    gardenId: readString(value.gardenId),
    id: value.id,
    inchesNeeded: Math.max(readNumber(value.inchesNeeded, 0), 0),
    plantingId: readNullableString(value.plantingId),
    rationale: Array.isArray(value.rationale)
      ? value.rationale.flatMap((reason): string[] =>
          typeof reason === 'string' ? [reason] : [],
        )
      : [readString(value.reason)].filter(Boolean),
    reason: readString(value.reason),
    recommendationDate: readString(value.recommendationDate),
    recommendedWaterInches: Math.max(
      readNumber(
        value.recommendedWaterInches,
        readNumber(value.inchesNeeded, 0),
      ),
      0,
    ),
    refreshedAtIso: readString(
      value.refreshedAtIso,
      readString(value.generatedAtIso),
    ),
    status: readStringUnion(
      value.status,
      [
        'accepted',
        'active',
        'completed',
        'dismissed',
        'new',
        'suppressed',
      ] as const,
      'new',
    ),
    suppressUntilIso: readNullableString(value.suppressUntilIso),
    targetId: readString(
      value.targetId,
      readNullableString(value.plantingId) ?? value.id,
    ),
    targetLabel: readString(value.targetLabel, 'Garden target'),
    targetType: readStringUnion(
      value.targetType,
      ['bed', 'planting'] as const,
      readNullableString(value.plantingId) ? 'planting' : 'bed',
    ),
    urgency: readStringUnion(
      value.urgency,
      ['high', 'low', 'medium', 'none'] as const,
      'none',
    ),
    weatherSnapshotId: readNullableString(value.weatherSnapshotId),
  };
}

export function parseTasks(value: unknown): Task[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((task): Task[] => {
    const parsed = parseTask(task);
    return parsed ? [parsed] : [];
  });
}

export function parseJournalEntries(value: unknown): JournalEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry): JournalEntry[] => {
    const parsed = parseJournalEntry(entry);
    return parsed ? [parsed] : [];
  });
}

export function parseHarvestEvents(value: unknown): HarvestEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((event): HarvestEvent[] => {
    const parsed = parseHarvestEvent(event);
    return parsed ? [parsed] : [];
  });
}

export function parseNotificationLogs(value: unknown): NotificationLog[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((log): NotificationLog[] => {
    const parsed = parseNotificationLog(log);
    return parsed ? [parsed] : [];
  });
}

export function parseSunShadeLayers(value: unknown): SunShadeLayer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((layer): SunShadeLayer[] => {
    const parsed = parseSunShadeLayer(layer);
    return parsed ? [parsed] : [];
  });
}

export function parseWeatherSnapshots(value: unknown): WeatherSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((snapshot): WeatherSnapshot[] => {
    const parsed = parseWeatherSnapshot(snapshot);
    return parsed ? [parsed] : [];
  });
}

export function parseWaterRecommendations(
  value: unknown,
): WaterRecommendation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((recommendation): WaterRecommendation[] => {
    const parsed = parseWaterRecommendation(recommendation);
    return parsed ? [parsed] : [];
  });
}

export function parseGarden(
  userId: string,
  value: unknown,
  collections: Partial<
    Pick<
      Garden,
      | 'harvestEvents'
      | 'journalEntries'
      | 'notificationLogs'
      | 'plantings'
      | 'structures'
      | 'tasks'
    >
  > = {},
): Garden {
  const record = migrateGardenRecord(value).record;
  const plot = parsePlot(record.plot);
  const legacyPlants = parsePlantings(record.plants, plot);
  const plantings =
    collections.plantings ?? parsePlantings(record.plantings, plot);

  return {
    climateProfile: parseClimateProfile(record.climateProfile),
    harvestEvents:
      collections.harvestEvents ?? parseHarvestEvents(record.harvestEvents),
    id: readString(record.id, userId),
    journalEntries:
      collections.journalEntries ?? parseJournalEntries(record.journalEntries),
    name: readString(record.name, 'Home garden'),
    notificationLogs:
      collections.notificationLogs ??
      parseNotificationLogs(record.notificationLogs),
    plantings: plantings.length > 0 ? plantings : legacyPlants,
    plot,
    schemaVersion: CURRENT_GARDEN_SCHEMA_VERSION,
    seasonPlan: parseSeasonPlan(record.seasonPlan),
    structures:
      collections.structures ?? parseStructures(record.structures, plot),
    sunShadeLayers: parseSunShadeLayers(record.sunShadeLayers),
    tasks: collections.tasks ?? parseTasks(record.tasks),
    updatedAtIso: readNullableString(record.updatedAtIso),
    userId,
    waterRecommendations: parseWaterRecommendations(
      record.waterRecommendations,
    ),
    weatherSnapshots: parseWeatherSnapshots(record.weatherSnapshots),
  };
}

export function isUserProfile(value: unknown): value is UserProfile {
  return isRecord(value) && typeof value.uid === 'string';
}

export function isClimateProfile(value: unknown): value is ClimateProfile {
  return isRecord(value) && typeof value.hardinessZone === 'string';
}

export function isGarden(value: unknown): value is Garden {
  return (
    isRecord(value) && Array.isArray(value.plantings) && isRecord(value.plot)
  );
}

export function isPlot(value: unknown): value is Plot {
  return isRecord(value) && typeof value.widthFt === 'number';
}

export function isStructure(value: unknown): value is Structure {
  return isRecord(value) && typeof value.id === 'string';
}

export function isPlanting(value: unknown): value is Planting {
  return isRecord(value) && typeof value.id === 'string';
}

export function isCropProfile(value: unknown): value is CropProfile {
  return isRecord(value) && typeof value.id === 'string';
}

export function isSunShadeLayer(value: unknown): value is SunShadeLayer {
  return isRecord(value) && Array.isArray(value.areas);
}

export function isWeatherSnapshot(value: unknown): value is WeatherSnapshot {
  return isRecord(value) && typeof value.id === 'string';
}

export function isWaterRecommendation(
  value: unknown,
): value is WaterRecommendation {
  return isRecord(value) && typeof value.inchesNeeded === 'number';
}

export function isTask(value: unknown): value is Task {
  return isRecord(value) && typeof value.title === 'string';
}

export function isJournalEntry(value: unknown): value is JournalEntry {
  return isRecord(value) && typeof value.body === 'string';
}

export function isHarvestEvent(value: unknown): value is HarvestEvent {
  return isRecord(value) && typeof value.quantity === 'number';
}

export function isNotificationPreference(
  value: unknown,
): value is NotificationPreference {
  return isRecord(value) && isRecord(value.channels);
}

export function isNotificationLog(value: unknown): value is NotificationLog {
  return isRecord(value) && typeof value.messageSummary === 'string';
}
