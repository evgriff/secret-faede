import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import process from 'node:process';

const require = createRequire(import.meta.url);
const auth = require('firebase-tools/lib/auth');
const { findUser } = require('firebase-tools/lib/gcp/auth');

loadEnvFile('.env.local');

const projectId = getProjectId();
const seedEmail = getSeedEmail();
const dryRun = process.argv.includes('--dry-run');
const curatedCropCatalog = readCuratedCropCatalog();

if (!seedEmail) {
  throw new Error(
    'Set SEED_USER_EMAIL or VITE_ALLOWED_EMAILS before running the seed.',
  );
}

const annArborLocation = {
  latitude: 42.3314,
  locationName: 'Detroit, MI',
  locationQuery: process.env.DEFAULT_ALERT_LOCATION_QUERY || 'Detroit, MI',
  longitude: -83.0458,
  timezone: process.env.DEFAULT_ALERT_TIMEZONE || 'America/Detroit',
};

const annArborClimateProfile = {
  averageFirstFrost: '10-05',
  averageLastFrost: '05-10',
  editableByUser: true,
  hardinessZone: '6a',
  locationName: 'Detroit, MI',
  source: 'demoDefault',
  updatedAtIso: new Date().toISOString(),
};

async function main() {
  const user = dryRun
    ? {
        email: seedEmail,
        uid: process.env.SEED_USER_UID || 'dry-run-user',
      }
    : await getSeedUser(projectId, seedEmail);

  if (!user) {
    console.log(
      JSON.stringify(
        {
          projectId,
          seedEmail,
          skipped: 'No matching Firebase Auth user exists.',
        },
        null,
        2,
      ),
    );
    return;
  }

  const now = new Date().toISOString();
  const documents = createSeedDocuments(user.uid, user.email, now);

  if (!dryRun) {
    await commitDocuments(projectId, documents);
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        gardenId: user.uid,
        projectId,
        seededDocuments: documents.length,
        userEmail: user.email,
      },
      null,
      2,
    ),
  );
}

function createSeedDocuments(uid, email, now) {
  const userProfile = {
    alertLocationQuery: annArborLocation.locationQuery,
    climateProfile: annArborClimateProfile,
    createdAtIso: now,
    defaultGardenId: uid,
    displayName: 'Demo gardener',
    email,
    notificationPreference: {
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
      timezone: annArborLocation.timezone,
      wateringAlertThresholdIn: 0.25,
    },
    timezone: annArborLocation.timezone,
    uid,
    updatedAtIso: now,
  };
  const garden = {
    climateProfile: annArborClimateProfile,
    id: uid,
    name: 'Sample Kitchen Garden',
    plot: {
      depthFt: 16,
      gridUnitFt: 1,
      location: annArborLocation,
      orientationDegrees: 0,
      snapUnitFt: 0.25,
      widthFt: 20,
    },
    schemaVersion: 6,
    seasonPlan: {
      updatedAtIso: now,
      wantedCrops: [
        createSeasonSelection('tomato', {
          plantingForm: 'single',
          quantity: 4,
        }),
        createSeasonSelection('cucumber', {
          plantingForm: 'trellisLine',
          quantity: 6,
        }),
        createSeasonSelection('basil', {
          plantingForm: 'cluster',
          quantity: 4,
        }),
        createSeasonSelection('pepper-sweet', {
          plantingForm: 'single',
          quantity: 2,
        }),
        createSeasonSelection('carrot', {
          plantingForm: 'block',
          quantity: 36,
        }),
      ],
    },
    sunShadeLayers: createSeedSunShadeLayers(uid, now),
    updatedAtIso: now,
    userId: uid,
    wateringSchedule: [
      {
        appliedAmountInches: null,
        createdAtIso: now,
        dataQuality: 'partial',
        deficitInches: 0.42,
        dueDate: toLocalDate(new Date(now)),
        dueWindowEndIso: null,
        dueWindowStartIso: now,
        gardenId: uid,
        id: 'seed-water-main-bed',
        lastWateredAtIso: `${addDays(new Date(now), -3)}T12:20:00.000Z`,
        nextRecalculationAtIso: `${addDays(new Date(now), 1)}T07:15:00.000Z`,
        reasonDetails: [
          'Only light rain was recorded over the last 72 hours.',
          'Spring greens and roots are shallow-rooted.',
          'Forecast rain is below the saved alert threshold.',
        ],
        reasonSummary: 'Roots and salad bed is below its weekly water target.',
        source: 'backend',
        status: 'due',
        targetAmountInches: 0.35,
        targetId: 'bed-salad',
        targetKind: 'bed',
        targetLabel: 'Roots and salad bed',
        updatedAtIso: now,
        urgency: 'high',
        wateringZoneId: 'zone-a',
        weatherSnapshotId: 'seed-weather-today',
      },
    ],
    weatherSnapshots: [
      {
        alertSummaries: [
          'Dry, breezy afternoon may stress shallow-rooted greens.',
        ],
        capturedAtIso: now,
        conditionSummary: 'Sunny, dry breeze',
        dataQuality: 'partial',
        evapotranspirationIn: 0.18,
        forecastRainNext24In: 0.04,
        forecastRainNext48In: 0.12,
        frostRisk: 'none',
        gardenId: uid,
        heatRisk: 'watch',
        humidityPercent: 44,
        id: 'seed-weather-today',
        nextRainIso: `${addDays(new Date(now), 1)}T20:00:00.000Z`,
        observedForDate: toLocalDate(new Date(now)),
        overnightLowF: 48,
        precipitationIn: 0,
        providerDecision: 'Seeded demo weather snapshot.',
        providerLabel: 'Demo National Weather Service',
        recentPrecipitation72hIn: 0.05,
        source: 'manual',
        temperatureF: 76,
        windMph: 12,
      },
    ],
  };
  const seedCropIds = [
    'tomato',
    'radish',
    'pole-bean',
    'snap-pea',
    'lettuce',
    'carrot',
    'basil',
    'cucumber',
    'pepper-sweet',
  ];
  const crops = seedCropIds.map(readSeedCrop);
  const tomatoCrop = readSeedCrop('tomato');
  const radishCrop = readSeedCrop('radish');
  const poleBeanCrop = readSeedCrop('pole-bean');
  const snapPeaCrop = readSeedCrop('snap-pea');
  const lettuceCrop = readSeedCrop('lettuce');
  const carrotCrop = readSeedCrop('carrot');
  const basilCrop = readSeedCrop('basil');
  const cucumberCrop = readSeedCrop('cucumber');
  const pepperCrop = readSeedCrop('pepper-sweet');
  const structures = [
    {
      canopyRadiusFt: null,
      depthFt: 4,
      heightFt: 1.5,
      id: 'bed-main',
      label: 'Main raised bed',
      mulched: true,
      notes: 'Primary mixed vegetable bed.',
      rotationDegrees: 0,
      type: 'raisedBed',
      widthFt: 12,
      xFt: 2,
      yFt: 2,
    },
    {
      canopyRadiusFt: null,
      depthFt: 0.5,
      heightFt: 6,
      id: 'trellis-north',
      label: 'North trellis',
      mulched: false,
      notes: 'Simple trellis line for climbing crops.',
      rotationDegrees: 0,
      type: 'trellis',
      widthFt: 10,
      xFt: 3,
      yFt: 8,
    },
    {
      canopyRadiusFt: null,
      depthFt: 3,
      heightFt: null,
      id: 'path-center',
      label: 'Center pathway',
      mulched: false,
      notes: 'Walkway for bed access.',
      rotationDegrees: 0,
      type: 'pathway',
      widthFt: 12,
      xFt: 2,
      yFt: 11,
    },
    {
      canopyRadiusFt: null,
      depthFt: 4,
      heightFt: 1.25,
      id: 'bed-salad',
      irrigationZone: 'zone-a',
      label: 'Roots and salad bed',
      mulched: false,
      notes: 'Quick crops and succession sowings near the main path.',
      rotationDegrees: 0,
      type: 'raisedBed',
      widthFt: 8,
      xFt: 11,
      yFt: 2,
    },
    {
      canopyRadiusFt: null,
      depthFt: 1,
      heightFt: null,
      id: 'hose-bib-east',
      label: 'East hose bib',
      mulched: false,
      notes: 'Primary water source for hand watering.',
      rotationDegrees: 0,
      type: 'hoseBib',
      widthFt: 1,
      xFt: 18,
      yFt: 12,
    },
    {
      canopyRadiusFt: null,
      depthFt: 3,
      heightFt: null,
      id: 'compost-bay',
      label: 'Compost bay',
      mulched: false,
      notes: 'Compost staging at the back edge.',
      rotationDegrees: 0,
      type: 'compost',
      widthFt: 3,
      xFt: 1,
      yFt: 12,
    },
  ];
  const plantings = [
    {
      blockDepthFt: null,
      blockWidthFt: null,
      clusterRadiusFt: null,
      cropId: 'tomato',
      id: 'tomato-single',
      label: 'Tomato',
      mode: 'single',
      mulched: true,
      notes: 'Demo single tomato transplant.',
      plantCount: 1,
      plantedOn: null,
      matureHeightInches: tomatoCrop.matureHeightInches,
      matureSpreadInches: tomatoCrop.matureSpreadInches,
      rowCount: null,
      rowLengthFt: null,
      rowSpacingFt: null,
      rowSpacingInches: tomatoCrop.rowSpacingInches,
      spacingInches: tomatoCrop.spacingInches,
      status: 'planned',
      sunRequirement: tomatoCrop.sunRequirement,
      trellisLengthFt: null,
      weeklyWaterNeedInches: tomatoCrop.weeklyWaterNeedInches,
      xFt: 5,
      yFt: 4,
    },
    {
      blockDepthFt: 2,
      blockWidthFt: 4,
      clusterRadiusFt: null,
      cropId: 'radish',
      id: 'radish-block',
      label: 'Radish block',
      mode: 'block',
      mulched: false,
      notes: 'Dense spring sowing block.',
      plantCount: 48,
      plantedOn: null,
      matureHeightInches: radishCrop.matureHeightInches,
      matureSpreadInches: radishCrop.matureSpreadInches,
      rowCount: null,
      rowLengthFt: null,
      rowSpacingFt: null,
      rowSpacingInches: radishCrop.rowSpacingInches,
      spacingInches: radishCrop.spacingInches,
      status: 'harvest-ready',
      sunRequirement: radishCrop.sunRequirement,
      trellisLengthFt: null,
      weeklyWaterNeedInches: radishCrop.weeklyWaterNeedInches,
      xFt: 10,
      yFt: 4,
    },
    {
      blockDepthFt: null,
      blockWidthFt: null,
      clusterRadiusFt: null,
      cropId: 'pole-bean',
      id: 'pole-bean-trellis',
      label: 'Pole beans',
      mode: 'trellisLine',
      mulched: true,
      notes: 'Beans along the north trellis.',
      plantCount: 12,
      plantedOn: null,
      matureHeightInches: poleBeanCrop.matureHeightInches,
      matureSpreadInches: poleBeanCrop.matureSpreadInches,
      rowCount: 1,
      rowLengthFt: 10,
      rowSpacingFt: null,
      rowSpacingInches: poleBeanCrop.rowSpacingInches,
      spacingInches: poleBeanCrop.spacingInches,
      status: 'planned',
      sunRequirement: poleBeanCrop.sunRequirement,
      trellisLengthFt: 10,
      weeklyWaterNeedInches: poleBeanCrop.weeklyWaterNeedInches,
      xFt: 3,
      yFt: 8,
    },
    {
      blockDepthFt: null,
      blockWidthFt: null,
      clusterRadiusFt: null,
      cropId: 'snap-pea',
      id: 'snap-pea-trellis',
      label: 'Snap peas',
      mode: 'trellisLine',
      mulched: true,
      notes: 'Spring peas on the trellis; check ties after wind.',
      plantCount: 14,
      plantedOn: addDays(new Date(now), -30),
      matureHeightInches: snapPeaCrop.matureHeightInches,
      matureSpreadInches: snapPeaCrop.matureSpreadInches,
      rowCount: 1,
      rowLengthFt: 8,
      rowSpacingFt: null,
      rowSpacingInches: snapPeaCrop.rowSpacingInches,
      spacingInches: snapPeaCrop.spacingInches,
      status: 'growing',
      sunRequirement: snapPeaCrop.sunRequirement,
      trellisLengthFt: 8,
      weeklyWaterNeedInches: snapPeaCrop.weeklyWaterNeedInches,
      xFt: 4,
      yFt: 8,
    },
    {
      blockDepthFt: 2,
      blockWidthFt: 3,
      clusterRadiusFt: null,
      cropId: 'lettuce',
      id: 'lettuce-block',
      label: 'Butterhead lettuce',
      mode: 'block',
      mulched: false,
      notes: 'Partial shade helps keep lettuce productive in early heat.',
      plantCount: 12,
      plantedOn: addDays(new Date(now), -25),
      matureHeightInches: lettuceCrop.matureHeightInches,
      matureSpreadInches: lettuceCrop.matureSpreadInches,
      rowCount: null,
      rowLengthFt: null,
      rowSpacingFt: null,
      rowSpacingInches: lettuceCrop.rowSpacingInches,
      spacingInches: lettuceCrop.spacingInches,
      status: 'harvest-ready',
      sunRequirement: lettuceCrop.sunRequirement,
      trellisLengthFt: null,
      weeklyWaterNeedInches: lettuceCrop.weeklyWaterNeedInches,
      xFt: 12,
      yFt: 3,
    },
    {
      blockDepthFt: null,
      blockWidthFt: null,
      clusterRadiusFt: null,
      cropId: 'pepper-sweet',
      id: 'pepper-west-edge',
      label: 'Sweet pepper',
      mode: 'single',
      mulched: true,
      notes: 'Needs a sunnier final spot than the west shade edge.',
      plantCount: 2,
      plantedOn: null,
      matureHeightInches: pepperCrop.matureHeightInches,
      matureSpreadInches: pepperCrop.matureSpreadInches,
      rowCount: null,
      rowLengthFt: null,
      rowSpacingFt: null,
      rowSpacingInches: pepperCrop.rowSpacingInches,
      spacingInches: pepperCrop.spacingInches,
      status: 'planned',
      sunRequirement: pepperCrop.sunRequirement,
      trellisLengthFt: null,
      weeklyWaterNeedInches: pepperCrop.weeklyWaterNeedInches,
      xFt: 2,
      yFt: 5,
    },
    {
      blockDepthFt: null,
      blockWidthFt: null,
      clusterRadiusFt: null,
      cropId: 'cucumber',
      id: 'cucumber-plan',
      label: 'Cucumber row',
      mode: 'trellisLine',
      mulched: false,
      notes: 'A layout suggestion should keep cucumbers near a support.',
      plantCount: 6,
      plantedOn: null,
      matureHeightInches: cucumberCrop.matureHeightInches,
      matureSpreadInches: cucumberCrop.matureSpreadInches,
      rowCount: 1,
      rowLengthFt: 6,
      rowSpacingFt: null,
      rowSpacingInches: cucumberCrop.rowSpacingInches,
      spacingInches: cucumberCrop.spacingInches,
      status: 'planned',
      sunRequirement: cucumberCrop.sunRequirement,
      trellisLengthFt: 6,
      weeklyWaterNeedInches: cucumberCrop.weeklyWaterNeedInches,
      xFt: 6,
      yFt: 7,
    },
    {
      blockDepthFt: 2,
      blockWidthFt: 3,
      clusterRadiusFt: null,
      cropId: 'carrot',
      id: 'carrot-succession',
      label: 'Carrot succession',
      mode: 'block',
      mulched: false,
      notes: 'Succession is close to the path and should be reviewed.',
      plantCount: 36,
      plantedOn: null,
      matureHeightInches: carrotCrop.matureHeightInches,
      matureSpreadInches: carrotCrop.matureSpreadInches,
      rowCount: null,
      rowLengthFt: null,
      rowSpacingFt: null,
      rowSpacingInches: carrotCrop.rowSpacingInches,
      spacingInches: carrotCrop.spacingInches,
      status: 'planned',
      sunRequirement: carrotCrop.sunRequirement,
      trellisLengthFt: null,
      weeklyWaterNeedInches: carrotCrop.weeklyWaterNeedInches,
      xFt: 13,
      yFt: 5,
    },
    {
      blockDepthFt: null,
      blockWidthFt: null,
      clusterRadiusFt: 1.5,
      cropId: 'basil',
      id: 'basil-tomato-cluster',
      label: 'Basil cluster',
      mode: 'cluster',
      mulched: true,
      notes: 'High-frequency harvest near the main path.',
      plantCount: 4,
      plantedOn: null,
      matureHeightInches: basilCrop.matureHeightInches,
      matureSpreadInches: basilCrop.matureSpreadInches,
      rowCount: null,
      rowLengthFt: null,
      rowSpacingFt: null,
      rowSpacingInches: basilCrop.rowSpacingInches,
      spacingInches: basilCrop.spacingInches,
      status: 'planned',
      sunRequirement: basilCrop.sunRequirement,
      trellisLengthFt: null,
      weeklyWaterNeedInches: basilCrop.weeklyWaterNeedInches,
      xFt: 6,
      yFt: 5,
    },
  ];
  const tasks = [
    {
      bedLabel: 'Roots and salad bed',
      completedAtIso: null,
      createdAtIso: now,
      deferredUntilDate: null,
      dueDate: toLocalDate(new Date(now)),
      gardenId: uid,
      id: 'seed-task-water-main-bed',
      notes: '',
      plantingId: null,
      priority: 'high',
      snoozedUntilDate: null,
      source: 'wateringSchedule',
      sourceId: 'seed-water-main-bed',
      status: 'open',
      structureId: 'bed-salad',
      title: 'Water roots and salad bed 0.35 in',
      type: 'water',
    },
    {
      bedLabel: 'Main raised bed',
      completedAtIso: null,
      createdAtIso: now,
      deferredUntilDate: null,
      dueDate: addDays(new Date(now), 1),
      gardenId: uid,
      id: 'seed-task-harvest-radish',
      notes: '',
      plantingId: 'radish-block',
      priority: 'medium',
      snoozedUntilDate: null,
      source: 'generated',
      sourceId: 'radish-block',
      status: 'open',
      structureId: null,
      title: 'Harvest largest radishes',
      type: 'harvest',
    },
    {
      bedLabel: 'North trellis',
      completedAtIso: null,
      createdAtIso: now,
      deferredUntilDate: null,
      dueDate: addDays(new Date(now), 3),
      gardenId: uid,
      id: 'seed-task-check-trellis',
      notes: '',
      plantingId: 'pole-bean-trellis',
      priority: 'medium',
      snoozedUntilDate: null,
      source: 'generated',
      sourceId: 'pole-bean-trellis',
      status: 'open',
      structureId: 'trellis-north',
      title: 'Check trellis ties before beans climb',
      type: 'trellis',
    },
    {
      bedLabel: 'Roots and salad bed',
      completedAtIso: null,
      createdAtIso: now,
      deferredUntilDate: null,
      dueDate: toLocalDate(new Date(now)),
      gardenId: uid,
      id: 'seed-task-inspect-slugs',
      notes: 'Check lettuce undersides and board trap after watering.',
      plantingId: 'lettuce-block',
      priority: 'high',
      snoozedUntilDate: null,
      source: 'manual',
      sourceId: 'seed-issue-slugs',
      status: 'open',
      structureId: 'bed-salad',
      title: 'Inspect lettuce slug pressure',
      type: 'inspect',
    },
    {
      bedLabel: 'Roots and salad bed',
      completedAtIso: null,
      createdAtIso: now,
      deferredUntilDate: null,
      dueDate: addDays(new Date(now), 2),
      gardenId: uid,
      id: 'seed-task-mulch-salad-bed',
      notes: 'Use light mulch after direct-sown rows are up.',
      plantingId: null,
      priority: 'medium',
      snoozedUntilDate: null,
      source: 'generated',
      sourceId: 'bed-salad',
      status: 'open',
      structureId: 'bed-salad',
      title: 'Mulch salad bed shoulders',
      type: 'mulch',
    },
    {
      bedLabel: 'Roots and salad bed',
      completedAtIso: null,
      createdAtIso: now,
      deferredUntilDate: null,
      dueDate: addDays(new Date(now), 5),
      gardenId: uid,
      id: 'seed-task-sow-carrot-succession',
      notes: 'Confirm path clearance before sowing.',
      plantingId: 'carrot-succession',
      priority: 'medium',
      snoozedUntilDate: null,
      source: 'succession',
      sourceId: 'carrot-succession',
      status: 'open',
      structureId: 'bed-salad',
      title: 'Review carrot succession placement',
      type: 'sow',
    },
  ];
  const journalEntries = [
    {
      body: 'Applied 0.3 in to Roots and salad bed. Watering is complete for now after 0.3 inches were applied.',
      createdAtIso: `${addDays(new Date(now), -3)}T12:20:00.000Z`,
      gardenId: uid,
      id: 'seed-note-watered-salad-bed',
      issueCategory: null,
      issueSeverity: null,
      issueStatus: null,
      occurredOn: addDays(new Date(now), -3),
      photos: [],
      plantingId: null,
      structureId: 'bed-salad',
      targetLabel: 'Roots and salad bed',
      targetType: 'structure',
      title: 'Watered Roots and salad bed',
      type: 'note',
      weatherSnapshotId: null,
    },
    {
      body: 'Radishes are sizing up. Pull largest roots before the next hot spell.',
      createdAtIso: now,
      gardenId: uid,
      id: 'seed-note-radish-ready',
      issueCategory: null,
      issueSeverity: null,
      issueStatus: null,
      occurredOn: toLocalDate(new Date(now)),
      photos: [],
      plantingId: 'radish-block',
      structureId: null,
      targetLabel: 'Radish block',
      targetType: 'planting',
      title: 'Radishes are ready',
      type: 'note',
      weatherSnapshotId: null,
    },
    {
      body: 'A few slug trails under the lettuce after watering. Recheck tomorrow morning.',
      createdAtIso: now,
      gardenId: uid,
      id: 'seed-issue-slugs',
      issueCategory: 'pest',
      issueSeverity: 'medium',
      issueStatus: 'open',
      occurredOn: toLocalDate(new Date(now)),
      photos: [],
      plantingId: 'lettuce-block',
      structureId: null,
      targetLabel: 'Butterhead lettuce',
      targetType: 'planting',
      title: 'Slug pressure in lettuce',
      type: 'issue',
      weatherSnapshotId: null,
    },
    {
      body: 'Peas are climbing cleanly after tightening the twine on the north trellis.',
      createdAtIso: addDays(new Date(now), -2) + 'T19:10:00.000Z',
      gardenId: uid,
      id: 'seed-note-pea-trellis',
      issueCategory: null,
      issueSeverity: null,
      issueStatus: null,
      occurredOn: addDays(new Date(now), -2),
      photos: [
        {
          contentType: 'image/svg+xml',
          downloadUrl:
            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420"%3E%3Crect width="640" height="420" fill="%23edf4e5"/%3E%3Cpath d="M120 330 C210 210 220 150 310 80" stroke="%2334613b" stroke-width="18" fill="none"/%3E%3Cpath d="M300 330 C390 210 400 150 490 80" stroke="%2334613b" stroke-width="18" fill="none"/%3E%3Ccircle cx="230" cy="180" r="28" fill="%2393bd6f"/%3E%3Ccircle cx="405" cy="210" r="25" fill="%2393bd6f"/%3E%3C/svg%3E',
          fileName: 'pea-trellis-demo.svg',
          id: 'seed-photo-peas',
          sizeBytes: 912,
          storagePath: 'demo/local/pea-trellis-demo.svg',
          uploadedAtIso: addDays(new Date(now), -2) + 'T19:11:00.000Z',
        },
      ],
      plantingId: 'snap-pea-trellis',
      structureId: 'trellis-north',
      targetLabel: 'Snap peas',
      targetType: 'planting',
      title: 'Pea trellis tied in',
      type: 'note',
      weatherSnapshotId: null,
    },
  ];
  const harvestEvents = [
    {
      amountText: '12 radishes',
      cropId: 'radish',
      gardenId: uid,
      harvestedOn: addDays(new Date(now), -2),
      id: 'seed-harvest-radish',
      notes: 'Pulled largest roots from the block.',
      plantingId: 'radish-block',
      quantity: 12,
      unit: 'count',
    },
    {
      amountText: '1 salad bowl',
      cropId: 'lettuce',
      gardenId: uid,
      harvestedOn: addDays(new Date(now), -1),
      id: 'seed-harvest-lettuce',
      notes: 'Cut outer leaves and left centers growing.',
      plantingId: 'lettuce-block',
      quantity: null,
      unit: 'freeform',
    },
    {
      amountText: '8 basil sprigs',
      cropId: 'basil',
      gardenId: uid,
      harvestedOn: addDays(new Date(now), -3),
      id: 'seed-harvest-basil',
      notes: 'Pinched tops for pasta night.',
      plantingId: 'basil-tomato-cluster',
      quantity: 8,
      unit: 'count',
    },
  ];
  const notificationLogs = [
    {
      acknowledgedAtIso: null,
      attemptCount: 1,
      body: 'Water Roots and salad bed 0.35 in today. Recent rain is low and no soaking rain is forecast.',
      channel: 'inApp',
      createdAtIso: now,
      decisionReason: 'User has in-app watering alerts enabled.',
      dedupeKey: 'seed-water-main-bed',
      deepLink: '/app/today',
      dismissedAtIso: null,
      dryRun: false,
      errorMessage: null,
      gardenId: uid,
      id: 'seed-log-water-inapp',
      messageSummary: 'Water roots and salad bed today',
      provider: 'inApp',
      providerMessageId: null,
      providerStatus: 'recorded',
      recipientRedacted: 'in-app',
      retryPolicy: 'none',
      sentAtIso: now,
      status: 'sent',
      taskId: 'seed-task-water-main-bed',
      type: 'watering',
      userId: uid,
    },
    {
      acknowledgedAtIso: null,
      attemptCount: 1,
      body: 'Slug pressure in lettuce still needs a quick field check.',
      channel: 'inApp',
      createdAtIso: addDays(new Date(now), -1) + 'T15:20:00.000Z',
      decisionReason: 'Open issue follow-up is due today.',
      dedupeKey: 'seed-issue-slugs',
      deepLink: '/app/today',
      dismissedAtIso: null,
      dryRun: false,
      errorMessage: null,
      gardenId: uid,
      id: 'seed-log-slug-issue',
      messageSummary: 'Inspect lettuce slug pressure',
      provider: 'inApp',
      providerMessageId: null,
      providerStatus: 'recorded',
      recipientRedacted: 'in-app',
      retryPolicy: 'none',
      sentAtIso: addDays(new Date(now), -1) + 'T15:20:00.000Z',
      status: 'sent',
      taskId: 'seed-task-inspect-slugs',
      type: 'task',
      userId: uid,
    },
    {
      acknowledgedAtIso: addDays(new Date(now), -2) + 'T08:05:00.000Z',
      attemptCount: 1,
      body: 'Heat watch: check shallow lettuce and radishes before afternoon.',
      channel: 'inApp',
      createdAtIso: addDays(new Date(now), -2) + 'T07:15:00.000Z',
      decisionReason: 'Heat stress alert type is enabled.',
      dedupeKey: 'seed-heat-watch',
      deepLink: '/app/today',
      dismissedAtIso: null,
      dryRun: false,
      errorMessage: null,
      gardenId: uid,
      id: 'seed-log-heat-watch',
      messageSummary: 'Heat watch acknowledged',
      provider: 'inApp',
      providerMessageId: null,
      providerStatus: 'recorded',
      recipientRedacted: 'in-app',
      retryPolicy: 'none',
      sentAtIso: addDays(new Date(now), -2) + 'T07:15:00.000Z',
      status: 'sent',
      taskId: null,
      type: 'heatStress',
      userId: uid,
    },
  ];

  return [
    ['users', uid, userProfile],
    ['gardens', uid, garden],
    ...structures.map((structure) => [
      'gardens',
      uid,
      'structures',
      structure.id,
      structure,
    ]),
    ...plantings.map((planting) => [
      'gardens',
      uid,
      'plantings',
      planting.id,
      planting,
    ]),
    ...tasks.map((task) => ['gardens', uid, 'tasks', task.id, task]),
    ...journalEntries.map((entry) => [
      'gardens',
      uid,
      'journal',
      entry.id,
      entry,
    ]),
    ...harvestEvents.map((harvest) => [
      'gardens',
      uid,
      'harvests',
      harvest.id,
      harvest,
    ]),
    ...notificationLogs.map((log) => [
      'gardens',
      uid,
      'notifications',
      log.id,
      log,
    ]),
    ...crops.map((crop) => ['catalog', crop.id, crop]),
  ];
}

function readSeedCrop(cropId) {
  const crop = curatedCropCatalog.find((candidate) => candidate.id === cropId);

  if (!crop) {
    throw new Error(`Missing curated crop seed: ${cropId}`);
  }

  const { trefleQuery, ...curatedFields } = crop;

  return {
    ...curatedFields,
    frostSensitive: crop.hardiness.toLowerCase().includes('frost sensitive'),
    name: crop.commonName,
    sunExposure: crop.sunRequirement,
    trellisRequired: crop.trellisRecommended,
    waterNeeds: toWaterNeed(crop.weeklyWaterNeedInches),
  };
}

function createSeasonSelection(cropId, overrides = {}) {
  return {
    cropId,
    id: `seed-season-${cropId}`,
    plantingForm: 'single',
    notes: '',
    supportAllowed: true,
    quantity: 1,
    varietyName: '',
    ...overrides,
  };
}

function createSeedSunShadeLayers(gardenId, now) {
  const updatedAtIso = new Date(now).toISOString();
  const layerMeta = {
    fall: { label: 'Fall sun', representativeDate: '09-21' },
    spring: { label: 'Spring sun', representativeDate: '04-21' },
    summer: { label: 'Summer sun', representativeDate: '06-21' },
  };

  return ['spring', 'summer', 'fall'].map((season) => ({
    areas: [
      {
        depthFt: 4,
        exposure: season === 'summer' ? 'partSun' : 'fullSun',
        id: `seed-${season}-pepper-observation`,
        microclimateNotes: [
          {
            description: 'Observed cooler afternoon pocket near pepper starts.',
            id: `seed-${season}-cool-shade`,
            kind: 'coolShadePocket',
            label: 'Cool shade pocket',
            source: 'manual',
          },
        ],
        shadeSources: [],
        source: 'manual',
        sunHours: season === 'summer' ? 4.5 : 6.5,
        updatedAtIso,
        widthFt: 5,
        xFt: 0,
        yFt: 0,
      },
      {
        depthFt: 5,
        exposure: 'fullSun',
        id: `seed-${season}-main-sun`,
        microclimateNotes: [
          {
            description: 'Bright bed edge that dries faster after windy days.',
            id: `seed-${season}-reflected-heat`,
            kind: 'reflectedHeat',
            label: 'Reflected heat',
            source: 'manual',
          },
        ],
        shadeSources: [],
        source: 'manual',
        sunHours: 8,
        updatedAtIso,
        widthFt: 10,
        xFt: 5,
        yFt: 2,
      },
      {
        depthFt: 4,
        exposure: season === 'fall' ? 'partSun' : 'fullSun',
        id: `seed-${season}-east-heat`,
        microclimateNotes: [
          {
            description: 'Late-day heat can stress shallow-rooted greens.',
            id: `seed-${season}-west-heat`,
            kind: 'westHeat',
            label: 'West heat',
            source: 'modeled',
          },
        ],
        shadeSources: [],
        source: 'modeled',
        sunHours: season === 'fall' ? 5 : 7.5,
        updatedAtIso,
        widthFt: 5,
        xFt: 15,
        yFt: 4,
      },
    ],
    cellSizeFt: 1,
    fullSunHours: 6,
    gardenId,
    generatedAtIso: updatedAtIso,
    id: `seed-${season}-sun`,
    label: layerMeta[season].label,
    modelVersion: 'seed-demo-v1',
    observedOn: null,
    representativeDate: layerMeta[season].representativeDate,
    season,
  }));
}

function toWaterNeed(weeklyWaterNeedInches) {
  if (weeklyWaterNeedInches === null) {
    return 'medium';
  }

  if (weeklyWaterNeedInches < 0.75) {
    return 'low';
  }

  return weeklyWaterNeedInches > 1.15 ? 'high' : 'medium';
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);

  return toLocalDate(nextDate);
}

function toLocalDate(date) {
  return date.toISOString().slice(0, 10);
}

function readCuratedCropCatalog() {
  return JSON.parse(
    readFileSync('src/domain/crops/curatedCropOverrides.json', 'utf8'),
  );
}

async function getSeedUser(project, email) {
  if (process.env.SEED_USER_UID) {
    return {
      email,
      uid: process.env.SEED_USER_UID,
    };
  }

  try {
    const user = await findUser(project, email);

    return {
      email: user.email || email,
      uid: user.uid,
    };
  } catch {
    return null;
  }
}

async function commitDocuments(project, documents) {
  const session = process.env.FIRESTORE_EMULATOR_HOST
    ? { accessToken: null }
    : await getCliSession();
  const origin = process.env.FIRESTORE_EMULATOR_HOST
    ? `http://${process.env.FIRESTORE_EMULATOR_HOST}`
    : 'https://firestore.googleapis.com';
  const basePath = `projects/${project}/databases/(default)/documents`;
  const url = `${origin}/v1/${basePath}:commit`;
  const writes = documents.map(([...parts]) => {
    const data = parts.pop();
    const documentPath = parts.map(encodeURIComponent).join('/');

    return {
      update: {
        fields: toFirestoreFields(data),
        name: `${basePath}/${documentPath}`,
      },
    };
  });

  for (let index = 0; index < writes.length; index += 400) {
    const chunk = writes.slice(index, index + 400);
    await fetchJson(url, {
      accessToken: session.accessToken,
      body: { writes: chunk },
      method: 'POST',
    });
  }
}

function toFirestoreFields(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [
      key,
      toFirestoreValue(fieldValue),
    ]),
  );
}

function toFirestoreValue(value) {
  if (value === null) {
    return { nullValue: null };
  }

  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }

  if (typeof value === 'object') {
    return { mapValue: { fields: toFirestoreFields(value) } };
  }

  return { stringValue: String(value) };
}

async function getCliSession() {
  const account = auth.getGlobalDefaultAccount();

  if (!account?.tokens?.refresh_token) {
    throw new Error(
      'Firebase CLI login is required. Run `firebase login` first, or set FIRESTORE_EMULATOR_HOST and SEED_USER_UID for emulator seeding.',
    );
  }

  const token = await auth.getAccessToken(account.tokens.refresh_token, []);

  if (!token?.access_token) {
    throw new Error('Unable to get an access token from the Firebase CLI.');
  }

  return {
    accessToken: token.access_token,
  };
}

async function fetchJson(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.accessToken
      ? { Authorization: `Bearer ${options.accessToken}` }
      : {}),
  };
  const response = await fetch(url, {
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers,
    method: options.method ?? 'GET',
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(
      `Request failed (${response.status}) for ${url}: ${JSON.stringify(payload)}`,
    );
  }

  return payload;
}

function getProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    readDefaultFirebaseProject() ||
    'demo-secret-faede'
  );
}

function getSeedEmail() {
  return (
    process.env.SEED_USER_EMAIL ||
    process.env.VITE_ALLOWED_EMAILS?.split(',')[0]?.trim() ||
    ''
  );
}

function readDefaultFirebaseProject() {
  if (!existsSync('.firebaserc')) {
    return null;
  }

  try {
    const file = JSON.parse(readFileSync('.firebaserc', 'utf8'));
    return file.projects?.default ?? null;
  } catch {
    return null;
  }
}

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf('=');

    if (separatorIndex < 1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();

    if (!process.env[key]) {
      process.env[key] = rawValue.replace(/^["']|["']$/g, '');
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Unknown seed error.');
  process.exitCode = 1;
});
