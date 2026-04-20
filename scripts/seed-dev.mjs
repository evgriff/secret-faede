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
        hasSmsPhone: Boolean(process.env.DEFAULT_ALERT_PHONE_E164),
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
  const phoneE164 = process.env.DEFAULT_ALERT_PHONE_E164 || null;
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
          grantedAtIso: phoneE164 ? now : null,
          revokedAtIso: null,
          status: phoneE164 ? 'granted' : 'notRequested',
        },
      },
      channels: {
        email: false,
        inApp: true,
        push: false,
        carrier messaging: Boolean(phoneE164),
      },
      defaultWateringCheckTime: '07:00',
      email,
      frostAlertThresholdF: 36,
      phoneE164,
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
    name: 'Detroit demo garden',
    plot: {
      depthFt: 18,
      gridUnitFt: 1,
      location: annArborLocation,
      orientationDegrees: 0,
      snapUnitFt: 0.5,
      widthFt: 24,
    },
    updatedAtIso: now,
    userId: uid,
    waterRecommendations: [],
    weatherSnapshots: [],
  };
  const crops = ['tomato', 'radish', 'pole-bean'].map(readSeedCrop);
  const tomatoCrop = readSeedCrop('tomato');
  const radishCrop = readSeedCrop('radish');
  const poleBeanCrop = readSeedCrop('pole-bean');
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
      status: 'planned',
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
    ...crops.map((crop) => ['catalog', 'crops', crop.id, crop]),
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

function toWaterNeed(weeklyWaterNeedInches) {
  if (weeklyWaterNeedInches === null) {
    return 'medium';
  }

  if (weeklyWaterNeedInches < 0.75) {
    return 'low';
  }

  return weeklyWaterNeedInches > 1.15 ? 'high' : 'medium';
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
