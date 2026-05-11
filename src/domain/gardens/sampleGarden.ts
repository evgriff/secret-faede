import { getCropById } from '../crops/cropCatalog';
import {
  detroitClimateProfile,
  detroitLocation,
  createDefaultGarden,
  createDefaultPlanting,
  createDefaultStructure,
  createDefaultUserProfile,
  type Garden,
  type HarvestEvent,
  type JournalEntry,
  type NotificationLog,
  type Planting,
  type PlantingLifecycleStatus,
  type PlantingMode,
  type SeasonCropSelection,
  type Structure,
  type StructureType,
  type SunExposure,
  type SunShadeLayer,
  type Task,
  type TaskPriority,
  type TaskType,
  type UserProfile,
  type WateringScheduleEntry,
  type WeatherSnapshot,
} from './GardenRepository';
import { withPlantingInstances } from './plantingInstances';

export const sampleGardenName = 'Sample Kitchen Garden';

const peaTrellisPhotoDataUrl =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"%3E%3Crect width="640" height="420" fill="%23edf4e5"/%3E%3Crect x="72" y="52" width="496" height="316" rx="18" fill="%23d9e8cc"/%3E%3Cg stroke="%237b6f5d" stroke-width="8"%3E%3Cpath d="M138 66v292"/%3E%3Cpath d="M248 66v292"/%3E%3Cpath d="M358 66v292"/%3E%3Cpath d="M468 66v292"/%3E%3C/g%3E%3Cg stroke="%2334613b" stroke-width="14" fill="none" stroke-linecap="round"%3E%3Cpath d="M118 334 C192 258 174 180 244 108"/%3E%3Cpath d="M286 338 C354 252 340 180 424 100"/%3E%3Cpath d="M458 334 C512 260 494 198 550 128"/%3E%3C/g%3E%3Cg fill="%2393bd6f"%3E%3Ccircle cx="205" cy="210" r="24"/%3E%3Ccircle cx="362" cy="214" r="22"/%3E%3Ccircle cx="491" cy="226" r="20"/%3E%3C/g%3E%3C/svg%3E';

const radishHarvestPhotoDataUrl =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"%3E%3Crect width="640" height="420" fill="%23f3efe5"/%3E%3Crect x="68" y="72" width="504" height="272" rx="20" fill="%23dfd1b8"/%3E%3Cg transform="translate(92 122)"%3E%3Cg fill="%23c84f5b"%3E%3Cellipse cx="68" cy="116" rx="34" ry="48"/%3E%3Cellipse cx="166" cy="132" rx="38" ry="52"/%3E%3Cellipse cx="268" cy="116" rx="34" ry="48"/%3E%3Cellipse cx="372" cy="134" rx="40" ry="52"/%3E%3C/g%3E%3Cg stroke="%23466d3c" stroke-width="8" fill="none" stroke-linecap="round"%3E%3Cpath d="M68 70 C48 22 88 22 70 4"/%3E%3Cpath d="M166 84 C138 32 178 24 164 2"/%3E%3Cpath d="M268 70 C236 24 288 20 268 0"/%3E%3Cpath d="M372 86 C342 34 392 26 374 2"/%3E%3C/g%3E%3Cg fill="%23f5f0df"%3E%3Cellipse cx="67" cy="150" rx="18" ry="18"/%3E%3Cellipse cx="166" cy="168" rx="20" ry="18"/%3E%3Cellipse cx="270" cy="150" rx="18" ry="18"/%3E%3Cellipse cx="372" cy="170" rx="21" ry="18"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E';

interface DemoPlantingInput {
  blockDepthFt?: number | null;
  blockWidthFt?: number | null;
  clusterRadiusFt?: number | null;
  cropId: string;
  id: string;
  label?: string;
  mode: PlantingMode;
  mulched?: boolean;
  notes?: string;
  plantCount?: number | null;
  plantedOn?: string | null;
  plannedFor?: string | null;
  rowLengthFt?: number | null;
  status?: PlantingLifecycleStatus;
  trellisLengthFt?: number | null;
  xFt: number;
  yFt: number;
}

interface DemoStructureInput {
  accessiblePath?: boolean;
  canopyRadiusFt?: number | null;
  depthFt: number;
  heightFt?: number | null;
  id: string;
  irrigationZone?: string | null;
  label: string;
  mulched?: boolean;
  notes?: string;
  soilType?: Structure['soilType'];
  type: StructureType;
  widthFt: number;
  xFt: number;
  yFt: number;
}

interface DemoDates {
  fiveDaysFromNow: string;
  fortyDaysAgo: string;
  nineDaysAgo: string;
  nowIso: string;
  oneDayFromNow: string;
  oneDayAgo: string;
  sevenDaysFromNow: string;
  sixMonthsAgo: string;
  thirtyDaysAgo: string;
  threeDaysAgo: string;
  today: string;
  twoDaysFromNow: string;
  twoDaysAgo: string;
  twentyFiveDaysFromNow: string;
}

export function createSampleGarden(userId: string, now = new Date()): Garden {
  const dates = createDemoDates(now);
  const structures = createDemoStructures();
  const plantings = createDemoPlantings(dates);
  const weatherSnapshot = createDemoWeatherSnapshot(userId, dates);
  const wateringEntry = createDemoWateringEntry(userId, dates);
  const gardenWithoutSun: Garden = {
    ...createDefaultGarden(userId),
    climateProfile: {
      ...detroitClimateProfile,
      source: 'user',
      updatedAtIso: dates.nowIso,
    },
    harvestEvents: createDemoHarvests(userId, dates),
    id: userId,
    journalEntries: createDemoJournalEntries(userId, dates),
    name: sampleGardenName,
    notificationLogs: createDemoNotificationLogs(userId, dates),
    plantings,
    plot: {
      depthFt: 16,
      gridUnitFt: 1,
      location: detroitLocation,
      orientationDegrees: 8,
      snapUnitFt: 0.125,
      widthFt: 20,
    },
    seasonPlan: {
      updatedAtIso: dates.nowIso,
      wantedCrops: createDemoSeasonCrops(),
    },
    structures,
    tasks: createDemoTasks(userId, dates),
    updatedAtIso: dates.nowIso,
    userId,
    wateringSchedule: [wateringEntry],
    weatherSnapshots: [weatherSnapshot],
  };

  return {
    ...gardenWithoutSun,
    sunShadeLayers: createDemoSunShadeLayers(gardenWithoutSun, dates),
  };
}

export function createSampleUserProfile(
  uid: string,
  email: string,
): UserProfile {
  const nowIso = new Date().toISOString();
  const baseProfile = createDefaultUserProfile(uid, email);

  return {
    ...baseProfile,
    alertLocationQuery: detroitLocation.locationQuery,
    climateProfile: {
      ...detroitClimateProfile,
      source: 'user',
      updatedAtIso: nowIso,
    },
    createdAtIso: nowIso,
    displayName: 'Demo gardener',
    notificationPreference: {
      ...baseProfile.notificationPreference,
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
      defaultWateringCheckTime: '07:15',
      frostAlertThresholdF: 36,
      pushPermission: 'unknown',
      pushTokenLastRegisteredAtIso: null,
      quietHours: {
        endLocalTime: '07:00',
        startLocalTime: '21:00',
      },
      timezone: detroitLocation.timezone,
      wateringAlertThresholdIn: 0.25,
    },
    timezone: detroitLocation.timezone,
    updatedAtIso: nowIso,
  };
}

function createDemoSeasonCrops(): SeasonCropSelection[] {
  return [
    {
      cropId: 'tomato',
      id: 'demo-season-tomato',
      plantingForm: 'single',
      notes: 'Two paste tomatoes for sauce, movable until transplant day.',
      supportAllowed: true,
      quantity: 2,
      varietyName: 'Roma',
    },
    {
      cropId: 'cucumber',
      id: 'demo-season-cucumber',
      plantingForm: 'trellisLine',
      notes: 'One short trellised row if support fits cleanly.',
      supportAllowed: true,
      quantity: 3,
      varietyName: 'Marketmore',
    },
    {
      cropId: 'parsley',
      id: 'demo-season-parsley',
      plantingForm: 'block',
      notes: 'Kitchen herb that can tuck into a smaller part-sun pocket.',
      supportAllowed: true,
      quantity: 4,
      varietyName: 'Italian flat-leaf',
    },
    {
      cropId: 'cilantro',
      id: 'demo-season-cilantro',
      plantingForm: 'row',
      notes: 'Optional quick herb row after the first radish pull.',
      supportAllowed: true,
      quantity: 6,
      varietyName: '',
    },
  ];
}

function createDemoStructures(): Structure[] {
  return [
    demoStructure({
      depthFt: 4,
      heightFt: 1.5,
      id: 'demo-bed-spring-greens',
      irrigationZone: 'zone-a',
      label: 'Spring greens bed',
      mulched: true,
      notes:
        'Raised bed near the north edge; peas and greens stay readable as grouped footprints.',
      soilType: 'loam',
      type: 'raisedBed',
      widthFt: 7.5,
      xFt: 1,
      yFt: 2,
    }),
    demoStructure({
      depthFt: 4,
      heightFt: 1.5,
      id: 'demo-bed-summer-fruit',
      irrigationZone: 'zone-b',
      label: 'Summer fruiting bed',
      mulched: true,
      notes:
        'Warm-season draft bed for tomatoes, support review, and one clearer layout suggestion.',
      soilType: 'loam',
      type: 'raisedBed',
      widthFt: 6.25,
      xFt: 12.25,
      yFt: 2,
    }),
    demoStructure({
      depthFt: 4,
      heightFt: 1.5,
      id: 'demo-bed-roots',
      irrigationZone: 'zone-a',
      label: 'Roots and salad bed',
      mulched: true,
      notes: 'Fast spring crops with succession room.',
      soilType: 'loam',
      type: 'raisedBed',
      widthFt: 7.5,
      xFt: 1,
      yFt: 8,
    }),
    demoStructure({
      accessiblePath: true,
      depthFt: 13,
      heightFt: null,
      id: 'demo-main-path',
      label: 'Main access path',
      notes:
        'The only intentional access warning in the demo; Review can widen it to the accessible 4 ft standard.',
      type: 'pathway',
      widthFt: 2.25,
      xFt: 9.25,
      yFt: 1,
    }),
    demoStructure({
      depthFt: 0.5,
      heightFt: 6.5,
      id: 'demo-north-trellis',
      label: 'North pea trellis',
      notes:
        'Existing trellis for peas; cucumber support is missing elsewhere.',
      type: 'trellis',
      widthFt: 6.5,
      xFt: 1,
      yFt: 1.35,
    }),
  ];
}

function createDemoPlantings(dates: DemoDates): Planting[] {
  return [
    demoPlanting({
      cropId: 'snap-pea',
      id: 'demo-snap-pea-trellis',
      label: 'Snap peas',
      mode: 'trellisLine',
      mulched: true,
      notes:
        'Eight pea positions are grouped on the saved north trellis; tendrils are catching cleanly.',
      plantCount: 8,
      plantedOn: dates.thirtyDaysAgo,
      rowLengthFt: 5.75,
      status: 'growing',
      trellisLengthFt: 5.75,
      xFt: 4.25,
      yFt: 3,
    }),
    demoPlanting({
      blockDepthFt: 2.1,
      blockWidthFt: 2.1,
      cropId: 'lettuce',
      id: 'demo-lettuce-block',
      label: 'Butterhead lettuce',
      mode: 'block',
      mulched: true,
      notes:
        'Nine heads stay easy to scan inside one lettuce footprint; outer leaves are ready.',
      plantCount: 9,
      plantedOn: dates.fortyDaysAgo,
      status: 'harvest-ready',
      xFt: 2.65,
      yFt: 9.55,
    }),
    demoPlanting({
      cropId: 'radish',
      id: 'demo-radish-row',
      label: 'French breakfast radish',
      mode: 'row',
      notes:
        'Fourteen roots in one visible row group; pull largest roots before heat.',
      plantCount: 14,
      plantedOn: dates.thirtyDaysAgo,
      rowLengthFt: 4,
      status: 'harvest-ready',
      xFt: 4.9,
      yFt: 11.6,
    }),
    demoPlanting({
      blockDepthFt: 2.1,
      blockWidthFt: 2.1,
      cropId: 'spinach',
      id: 'demo-spinach-block',
      label: 'Spinach',
      mode: 'block',
      mulched: true,
      notes: 'Nine spinach positions stay readable inside the water story.',
      plantCount: 9,
      plantedOn: dates.fortyDaysAgo,
      status: 'growing',
      xFt: 6.75,
      yFt: 9.55,
    }),
    demoPlanting({
      cropId: 'tomato',
      id: 'demo-tomato-transplant',
      label: 'Roma tomato transplants',
      mode: 'row',
      mulched: true,
      notes:
        '[auto-layout] Draft summer row; two Roma plants stay movable until transplant day.',
      plantCount: 2,
      plannedFor: dates.twentyFiveDaysFromNow,
      rowLengthFt: 2,
      status: 'planned',
      xFt: 14.4,
      yFt: 4.5,
    }),
    demoPlanting({
      blockDepthFt: 1,
      blockWidthFt: 1,
      cropId: 'cilantro',
      id: 'demo-cilantro-succession',
      label: 'Cilantro succession',
      mode: 'block',
      notes:
        '[auto-layout] Six-node herb block after the first radish pull; movable while it is still a draft.',
      plantCount: 6,
      plannedFor: dates.sevenDaysFromNow,
      status: 'planned',
      xFt: 7.55,
      yFt: 11,
    }),
    demoPlanting({
      cropId: 'pepper-sweet',
      id: 'demo-pepper-part-shade',
      label: 'Sweet pepper start',
      mode: 'single',
      notes:
        '[auto-layout] One pepper start in a manually corrected part-shade pocket for warning review.',
      plantCount: 1,
      plannedFor: dates.twentyFiveDaysFromNow,
      status: 'planned',
      xFt: 17.75,
      yFt: 2.75,
    }),
    demoPlanting({
      cropId: 'carrot',
      id: 'demo-carrot-succession',
      label: 'Carrot succession row',
      mode: 'row',
      notes:
        'Sixteen-node succession row after radishes clear; no simultaneous overlap.',
      plantCount: 16,
      plannedFor: dates.twentyFiveDaysFromNow,
      rowLengthFt: 4,
      status: 'planned',
      xFt: 3.4,
      yFt: 11.45,
    }),
    demoPlanting({
      cropId: 'cherry-tomato',
      id: 'demo-prior-cherry-tomato',
      label: '2025 cherry tomatoes',
      mode: 'trellisLine',
      notes: 'Prior-season Solanaceae crop kept for rotation guidance.',
      plantCount: 3,
      plantedOn: dates.sixMonthsAgo,
      rowLengthFt: 5,
      status: 'harvested',
      trellisLengthFt: 5,
      xFt: 14,
      yFt: 3.5,
    }),
  ];
}

function createDemoWeatherSnapshot(
  gardenId: string,
  dates: DemoDates,
): WeatherSnapshot {
  return {
    alertSummaries: [
      'Dry, breezy afternoon may stress shallow-rooted greens.',
      'No frost risk tonight; warm-season crops still depend on editable frost dates.',
    ],
    capturedAtIso: dates.nowIso,
    conditionSummary: 'Sunny, dry breeze',
    dataQuality: 'partial',
    evapotranspirationIn: 0.18,
    forecastRainNext24In: 0.04,
    forecastRainNext48In: 0.12,
    frostRisk: 'none',
    gardenId,
    heatRisk: 'watch',
    humidityPercent: 44,
    id: 'demo-weather-today',
    nextRainIso: `${dates.oneDayFromNow}T20:00:00.000Z`,
    observedForDate: dates.today,
    overnightLowF: 48,
    precipitationIn: 0,
    providerDecision:
      'Demo snapshot uses NWS-style fields for an auditable local weather story.',
    providerLabel: 'Demo National Weather Service',
    recentPrecipitation72hIn: 0.05,
    source: 'manual',
    temperatureF: 76,
    windMph: 12,
  };
}

function createDemoWateringEntry(
  gardenId: string,
  dates: DemoDates,
): WateringScheduleEntry {
  return {
    appliedAmountInches: null,
    createdAtIso: dates.nowIso,
    dataQuality: 'partial',
    deficitInches: 0.42,
    dueDate: dates.today,
    dueWindowEndIso: null,
    dueWindowStartIso: dates.nowIso,
    gardenId,
    id: 'demo-water-greens-bed',
    lastWateredAtIso: `${dates.threeDaysAgo}T12:20:00.000Z`,
    nextRecalculationAtIso: `${dates.oneDayFromNow}T07:15:00.000Z`,
    reasonDetails: [
      'Only 0.05 in rain recorded over the last 72 hours.',
      'Leafy greens target about 1.0 in per week and are shallow rooted.',
      'Forecast rain is below the saved 0.25 in alert threshold.',
      'Mulch trims the watering amount slightly.',
      'Today can complete this in one tap; harvest is the only photo follow-up.',
    ],
    reasonSummary: 'Spring greens bed is below its weekly water target.',
    source: 'backend',
    status: 'due',
    targetId: 'demo-bed-roots',
    targetAmountInches: 0.35,
    targetKind: 'bed',
    targetLabel: 'Roots and salad bed',
    updatedAtIso: dates.nowIso,
    urgency: 'high',
    wateringZoneId: 'zone-a',
    weatherSnapshotId: 'demo-weather-today',
  };
}

function createDemoTasks(gardenId: string, dates: DemoDates): Task[] {
  return [
    demoTask({
      bedLabel: 'Roots and salad bed',
      dueDate: dates.today,
      gardenId,
      id: 'demo-task-water-greens',
      priority: 'high',
      source: 'wateringSchedule',
      sourceId: 'demo-water-greens-bed',
      structureId: 'demo-bed-roots',
      title: 'Water roots and salad bed 0.35 in',
      type: 'water',
    }),
    demoTask({
      bedLabel: 'Roots and salad bed',
      dueDate: dates.oneDayFromNow,
      gardenId,
      id: 'demo-task-inspect-slugs',
      plantingId: 'demo-lettuce-block',
      priority: 'high',
      source: 'manual',
      sourceId: 'demo-issue-slugs',
      title: 'Inspect lettuce for slug pressure',
      type: 'inspect',
    }),
    demoTask({
      bedLabel: 'Summer fruiting bed',
      dueDate: dates.twoDaysFromNow,
      gardenId,
      id: 'demo-task-stage-summer-supports',
      plantingId: 'demo-tomato-transplant',
      priority: 'medium',
      sourceId: 'demo-season-cucumber',
      title: 'Stage tomato cages and cucumber trellis',
      type: 'trellis',
    }),
    demoTask({
      bedLabel: 'Summer fruiting bed',
      dueDate: dates.fiveDaysFromNow,
      gardenId,
      id: 'demo-task-mulch-tomatoes',
      plantingId: 'demo-tomato-transplant',
      priority: 'medium',
      sourceId: 'demo-tomato-transplant',
      title: 'Stage mulch for tomato transplant week',
      type: 'mulch',
    }),
    demoTask({
      bedLabel: 'Main access path',
      dueDate: dates.sevenDaysFromNow,
      gardenId,
      id: 'demo-task-review-carrots',
      plantingId: 'demo-carrot-succession',
      priority: 'medium',
      source: 'succession',
      sourceId: 'demo-carrot-succession',
      title: 'Sow carrot succession after radishes clear',
      type: 'sow',
    }),
  ];
}

function createDemoJournalEntries(
  gardenId: string,
  dates: DemoDates,
): JournalEntry[] {
  return [
    {
      body: 'Outer lettuce leaves are clean, but the northeast corner has fresh slug trails. Check again after watering.',
      createdAtIso: `${dates.oneDayAgo}T15:15:00.000Z`,
      gardenId,
      id: 'demo-issue-slugs',
      issueCategory: 'pest',
      issueSeverity: 'medium',
      issueStatus: 'open',
      occurredOn: dates.oneDayAgo,
      photos: [],
      plantingId: 'demo-lettuce-block',
      structureId: null,
      targetLabel: 'Butterhead lettuce',
      targetType: 'planting',
      title: 'Slug pressure in lettuce',
      type: 'issue',
      weatherSnapshotId: null,
    },
    {
      body: 'Eight pea vines are attached to the saved trellis after tightening the loose twine on the north end.',
      createdAtIso: `${dates.twoDaysAgo}T19:10:00.000Z`,
      gardenId,
      id: 'demo-note-pea-trellis',
      issueCategory: null,
      issueSeverity: null,
      issueStatus: null,
      occurredOn: dates.twoDaysAgo,
      photos: [
        {
          contentType: 'image/svg+xml',
          downloadUrl: peaTrellisPhotoDataUrl,
          fileName: 'pea-trellis-demo.svg',
          id: 'demo-photo-peas',
          sizeBytes: 1280,
          storagePath: 'demo/local/pea-trellis-demo.svg',
          uploadedAtIso: `${dates.twoDaysAgo}T19:11:00.000Z`,
        },
      ],
      plantingId: 'demo-snap-pea-trellis',
      structureId: null,
      targetLabel: 'Snap peas',
      targetType: 'planting',
      title: 'Peas caught the trellis',
      type: 'note',
      weatherSnapshotId: null,
    },
    {
      body: 'Pulled a small bowl from the front of the row before the warm spell; smaller roots can stand until the carrot succession is ready.',
      createdAtIso: `${dates.twoDaysAgo}T18:20:00.000Z`,
      gardenId,
      id: 'demo-note-radish-harvest-photo',
      issueCategory: null,
      issueSeverity: null,
      issueStatus: null,
      occurredOn: dates.twoDaysAgo,
      photos: [
        {
          contentType: 'image/svg+xml',
          downloadUrl: radishHarvestPhotoDataUrl,
          fileName: 'radish-harvest-demo.svg',
          id: 'demo-photo-radish-harvest',
          sizeBytes: 1320,
          storagePath: 'demo/local/radish-harvest-demo.svg',
          uploadedAtIso: `${dates.twoDaysAgo}T18:21:00.000Z`,
        },
      ],
      plantingId: 'demo-radish-row',
      structureId: null,
      targetLabel: 'French breakfast radish',
      targetType: 'planting',
      title: 'Radish harvest before heat',
      type: 'note',
      weatherSnapshotId: null,
    },
    {
      body: 'Applied 0.3 in to Roots and salad bed. Watering is complete for now after 0.3 inches were applied.',
      createdAtIso: `${dates.threeDaysAgo}T12:20:00.000Z`,
      gardenId,
      id: 'demo-note-watered-greens',
      issueCategory: null,
      issueSeverity: null,
      issueStatus: null,
      occurredOn: dates.threeDaysAgo,
      photos: [],
      plantingId: null,
      structureId: 'demo-bed-roots',
      targetLabel: 'Roots and salad bed',
      targetType: 'structure',
      title: 'Watered Roots and salad bed',
      type: 'note',
      weatherSnapshotId: 'demo-weather-today',
    },
    {
      body: 'Last year tomatoes were productive here, but the same bed should be rotated if disease pressure appears.',
      createdAtIso: `${dates.nineDaysAgo}T13:00:00.000Z`,
      gardenId,
      id: 'demo-note-rotation',
      issueCategory: null,
      issueSeverity: null,
      issueStatus: null,
      occurredOn: dates.nineDaysAgo,
      photos: [],
      plantingId: 'demo-prior-cherry-tomato',
      structureId: null,
      targetLabel: '2025 cherry tomatoes',
      targetType: 'planting',
      title: 'Rotation note from last season',
      type: 'note',
      weatherSnapshotId: null,
    },
  ];
}

function createDemoHarvests(
  gardenId: string,
  dates: DemoDates,
): HarvestEvent[] {
  return [
    {
      amountText: '10 radishes',
      cropId: 'radish',
      gardenId,
      harvestedOn: dates.twoDaysAgo,
      id: 'demo-harvest-radish',
      notes:
        'Pulled the largest roots before heat; smaller roots can stand a few more days.',
      plantingId: 'demo-radish-row',
      quantity: 10,
      unit: 'count',
    },
    {
      amountText: '0.5 lb lettuce',
      cropId: 'lettuce',
      gardenId,
      harvestedOn: dates.threeDaysAgo,
      id: 'demo-harvest-lettuce',
      notes: 'Outer leaves only.',
      plantingId: 'demo-lettuce-block',
      quantity: 0.5,
      unit: 'lb',
    },
    {
      amountText: '8 lb cherry tomatoes',
      cropId: 'cherry-tomato',
      gardenId,
      harvestedOn: dates.sixMonthsAgo,
      id: 'demo-harvest-prior-tomato',
      notes: 'Saved as rotation history for this bed.',
      plantingId: 'demo-prior-cherry-tomato',
      quantity: 8,
      unit: 'lb',
    },
  ];
}

function createDemoNotificationLogs(
  userId: string,
  dates: DemoDates,
): NotificationLog[] {
  return [
    {
      acknowledgedAtIso: null,
      attemptCount: 1,
      body: 'Water Roots and salad bed 0.35 in today. Recent rain is low, the greens are shallow rooted, and no soaking rain is forecast.',
      channel: 'inApp',
      createdAtIso: `${dates.today}T11:00:00.000Z`,
      decisionReason: 'User has in-app watering alerts enabled.',
      dedupeKey: 'demo-water-greens-bed',
      deepLink: '/app/today',
      dismissedAtIso: null,
      dryRun: false,
      errorMessage: null,
      gardenId: userId,
      id: 'demo-log-water-inapp',
      messageSummary: 'Water roots and salad bed today',
      provider: 'inApp',
      providerMessageId: null,
      providerStatus: 'recorded',
      recipientRedacted: 'in-app',
      retryPolicy: 'none',
      sentAtIso: `${dates.today}T11:00:00.000Z`,
      status: 'sent',
      taskId: 'demo-task-water-greens',
      type: 'watering',
      userId,
    },
    {
      acknowledgedAtIso: `${dates.oneDayAgo}T18:30:00.000Z`,
      attemptCount: 1,
      body: 'Dry breeze expected tomorrow. Check shallow greens before midday and water only if the bed has dried at the surface.',
      channel: 'push',
      createdAtIso: `${dates.oneDayAgo}T17:00:00.000Z`,
      decisionReason: 'Demo push send is shown as delivered history.',
      dedupeKey: 'demo-heat-watch',
      deepLink: '/app/today',
      dismissedAtIso: null,
      dryRun: false,
      errorMessage: null,
      gardenId: userId,
      id: 'demo-log-heat-push',
      messageSummary: 'Heat and wind watch for greens',
      provider: 'firebaseCloudMessaging',
      providerMessageId: 'demo-fcm-message',
      providerStatus: 'sent',
      recipientRedacted: 'browser token ending demo',
      retryPolicy: 'retry transient provider failures up to 3 attempts',
      sentAtIso: `${dates.oneDayAgo}T17:01:00.000Z`,
      status: 'sent',
      taskId: null,
      type: 'heatStress',
      userId,
    },
    {
      acknowledgedAtIso: `${dates.twoDaysAgo}T08:00:00.000Z`,
      attemptCount: 1,
      body: 'Harvest largest radishes this week before the row gets pithy.',
      channel: 'inApp',
      createdAtIso: `${dates.twoDaysAgo}T07:15:00.000Z`,
      decisionReason: 'Task due within the daily check window.',
      dedupeKey: 'demo-task-radish',
      deepLink: '/app/today',
      dismissedAtIso: `${dates.oneDayAgo}T08:10:00.000Z`,
      dryRun: false,
      errorMessage: null,
      gardenId: userId,
      id: 'demo-log-task-radish',
      messageSummary: 'Radish harvest task due',
      provider: 'inApp',
      providerMessageId: null,
      providerStatus: 'recorded',
      recipientRedacted: 'in-app',
      retryPolicy: 'none',
      sentAtIso: `${dates.twoDaysAgo}T07:15:00.000Z`,
      status: 'sent',
      taskId: 'demo-task-harvest-radish',
      type: 'taskDue',
      userId,
    },
  ];
}

function createDemoSunShadeLayers(
  garden: Garden,
  dates: DemoDates,
): SunShadeLayer[] {
  return [
    createDemoSunLayer(garden, {
      dates,
      label: 'Spring shoulder',
      representativeDate: '04-15',
      season: 'spring',
    }),
    createDemoSunLayer(garden, {
      dates,
      label: 'Summer peak',
      representativeDate: '06-21',
      season: 'summer',
    }),
    createDemoSunLayer(garden, {
      dates,
      label: 'Fall shoulder',
      representativeDate: '09-15',
      season: 'fall',
    }),
  ];
}

function createDemoSunLayer(
  garden: Garden,
  options: {
    dates: DemoDates;
    label: string;
    representativeDate: string;
    season: 'fall' | 'spring' | 'summer';
  },
): SunShadeLayer {
  return {
    areas: Array.from({ length: garden.plot.depthFt }, (_, yFt) =>
      Array.from({ length: garden.plot.widthFt }, (_, xFt) =>
        createSunArea(xFt, yFt, options.season),
      ),
    ).flat(),
    cellSizeFt: 1,
    fullSunHours: null,
    gardenId: garden.id,
    generatedAtIso: options.dates.nowIso,
    id: `demo-sun-${options.season}`,
    label: options.label,
    modelVersion: 'sample-garden-sun-v1',
    observedOn: options.dates.today,
    representativeDate: options.representativeDate,
    season: options.season,
  };
}

function createSunArea(
  xFt: number,
  yFt: number,
  season: 'fall' | 'spring' | 'summer',
) {
  const isManualPepperShade =
    season === 'summer' && xFt >= 15 && xFt <= 17 && yFt >= 2 && yFt <= 4;
  const isFenceShade =
    season !== 'summer' && yFt <= 2 && xFt >= 10 && xFt <= 18;
  const isPathPocket = xFt >= 9 && xFt <= 10 && yFt >= 6 && yFt <= 8;
  const exposure: SunExposure = isManualPepperShade
    ? 'partShade'
    : isFenceShade || isPathPocket
      ? 'partShade'
      : season === 'summer'
        ? 'fullSun'
        : 'partSun';

  return {
    depthFt: 1,
    exposure,
    id: `${season}-${xFt}-${yFt}`,
    source: isManualPepperShade ? ('manual' as const) : ('modeled' as const),
    sunHours: getDemoSunHours(exposure),
    widthFt: 1,
    xFt,
    yFt,
  };
}

function demoStructure(input: DemoStructureInput): Structure {
  return {
    ...createDefaultStructure({
      accessibleMode: input.accessiblePath ?? false,
      id: input.id,
      type: input.type,
      xFt: input.xFt,
      yFt: input.yFt,
    }),
    accessiblePath: input.accessiblePath ?? false,
    canopyRadiusFt: input.canopyRadiusFt ?? null,
    depthFt: input.depthFt,
    heightFt: input.heightFt ?? null,
    irrigationZone: input.irrigationZone ?? null,
    label: input.label,
    mulched: input.mulched ?? false,
    notes: input.notes ?? '',
    soilType: input.soilType ?? 'loam',
    widthFt: input.widthFt,
  };
}

function demoPlanting(input: DemoPlantingInput): Planting {
  const crop = getCropById(input.cropId);

  return withPlantingInstances({
    ...createDefaultPlanting({
      id: input.id,
      label: input.label ?? crop?.commonName ?? input.cropId,
      xFt: input.xFt,
      yFt: input.yFt,
    }),
    blockDepthFt: input.blockDepthFt ?? null,
    blockWidthFt: input.blockWidthFt ?? null,
    clusterRadiusFt: input.clusterRadiusFt ?? null,
    cropId: input.cropId,
    matureHeightInches: crop?.matureHeightInches ?? null,
    matureSpreadInches: crop?.matureSpreadInches ?? null,
    mode: input.mode,
    mulched: input.mulched ?? false,
    notes: input.notes ?? crop?.notes ?? '',
    plantCount: input.plantCount ?? 1,
    plantedOn: input.plantedOn ?? null,
    plannedFor: input.plannedFor ?? null,
    rowCount:
      input.mode === 'row' ||
      input.mode === 'block' ||
      input.mode === 'trellisLine'
        ? 1
        : null,
    rowLengthFt: input.rowLengthFt ?? null,
    rowSpacingInches: crop?.rowSpacingInches ?? null,
    spacingInches: crop?.spacingInches ?? null,
    status: input.status ?? 'planned',
    sunRequirement: crop?.sunRequirement ?? null,
    trellisLengthFt: input.trellisLengthFt ?? null,
    weeklyWaterNeedInches: crop?.weeklyWaterNeedInches ?? null,
  });
}

function demoTask(input: {
  bedLabel: string | null;
  dueDate: string;
  gardenId: string;
  id: string;
  plantingId?: string | null;
  priority: TaskPriority;
  source?: Task['source'];
  sourceId?: string | null;
  structureId?: string | null;
  title: string;
  type: TaskType;
}): Task {
  return {
    bedLabel: input.bedLabel,
    completedAtIso: null,
    createdAtIso: `${input.dueDate}T07:00:00.000Z`,
    deferredUntilDate: null,
    dueDate: input.dueDate,
    gardenId: input.gardenId,
    id: input.id,
    notes: '',
    plantingId: input.plantingId ?? null,
    priority: input.priority,
    snoozedUntilDate: null,
    source: input.source ?? 'generated',
    sourceId: input.sourceId ?? null,
    status: 'open',
    structureId: input.structureId ?? null,
    title: input.title,
    type: input.type,
  };
}

function createDemoDates(now: Date): DemoDates {
  return {
    fiveDaysFromNow: addDays(now, 5),
    fortyDaysAgo: addDays(now, -40),
    nineDaysAgo: addDays(now, -9),
    nowIso: now.toISOString(),
    oneDayFromNow: addDays(now, 1),
    oneDayAgo: addDays(now, -1),
    sevenDaysFromNow: addDays(now, 7),
    sixMonthsAgo: addDays(now, -180),
    thirtyDaysAgo: addDays(now, -30),
    threeDaysAgo: addDays(now, -3),
    today: toLocalDate(now),
    twoDaysFromNow: addDays(now, 2),
    twoDaysAgo: addDays(now, -2),
    twentyFiveDaysFromNow: addDays(now, 25),
  };
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return toLocalDate(nextDate);
}

function toLocalDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDemoSunHours(exposure: SunExposure) {
  switch (exposure) {
    case 'fullSun':
      return 7.2;
    case 'partSun':
      return 5.1;
    case 'partShade':
      return 3.1;
    case 'fullShade':
      return 1.2;
  }
}
