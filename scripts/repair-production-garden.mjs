import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

async function main() {
  loadEnvFile('.env.local');

  const apply = process.argv.includes('--apply');
  const backupOnly = process.argv.includes('--backup-only');
  const dryRun = !apply;

  if (apply && backupOnly) {
    throw new Error('Use either --apply or --backup-only, not both.');
  }

  const projectId = getProjectId();
  const accessToken = await getFirebaseCliAccessToken();
  const firestore = new FirestoreRestClient({ accessToken, projectId });
  const authUsers = await listAuthUsers({ accessToken, projectId });
  const backup = await createBackup({ authUsers, firestore, projectId });
  const backupPath = writeBackup(backup);
  const report = await buildRepairReport({ authUsers, firestore });

  if (apply) {
    await applyRepair({ firestore, report });
  }

  console.log(
    JSON.stringify(
      {
        backupPath,
        dryRun,
        projectId,
        repair: summarizeRepairReport(report),
      },
      null,
      2,
    ),
  );

  if (backupOnly) {
    process.exit(0);
  }

  if (dryRun) {
    console.log(
      'Dry run only. Re-run with --apply to delete/reset these records.',
    );
  }
}

async function buildRepairReport({ authUsers, firestore }) {
  const workspace = await firestore.getDecodedDocument('gardenWorkspaces/main');
  const journal = await firestore.listDecodedCollection(
    'gardenWorkspaces/main/journal',
  );
  const tasks = await firestore.listDecodedCollection(
    'gardenWorkspaces/main/tasks',
  );
  const notifications = await firestore.listDecodedCollection(
    'gardenWorkspaces/main/notifications',
  );
  const drafts = await firestore.listDecodedCollection(
    'gardenWorkspaces/main/drafts',
  );
  const profiles = await firestore.listDecodedCollection('users');
  const weatherSnapshots = await firestore.listDecodedCollection(
    'gardenWorkspaces/main/weatherSnapshots',
  );
  const testIssueIds = journal
    .filter((entry) => isProductionTestIssue(entry.data))
    .map((entry) => entry.id);
  const testIssueIdSet = new Set(testIssueIds);
  const testTasks = tasks.filter(
    (task) =>
      testIssueIdSet.has(task.data.sourceId) ||
      String(task.data.title ?? '').includes('Test Issue for Emma'),
  );
  const testNotifications = notifications.filter(
    (notification) =>
      testIssueIdSet.has(notification.data.sourceId) ||
      String(notification.data.message ?? '').includes('Test Issue for Emma'),
  );
  const staleDrafts = drafts.filter(
    (draft) => draft.data.baseRevisionId !== workspace.data.id,
  );
  const authUsersByUid = new Map(authUsers.map((user) => [user.uid, user]));
  const profileIds = new Set(profiles.map((profile) => profile.id));
  const missingProfiles = authUsers
    .filter((user) => isSecretFaeriesMember(user) && !profileIds.has(user.uid))
    .map((user) => ({
      displayName: user.displayName ?? '',
      email: user.email,
      id: user.uid,
    }));
  const latestWeather = weatherSnapshots
    .map((snapshot) => snapshot.data)
    .sort((left, right) =>
      String(right.capturedAtIso ?? '').localeCompare(
        String(left.capturedAtIso ?? ''),
      ),
    )[0];

  return {
    latestWeather: latestWeather
      ? {
          capturedAtIso: latestWeather.capturedAtIso ?? null,
          id: latestWeather.id ?? null,
          observedForDate: latestWeather.observedForDate ?? null,
        }
      : null,
    published: {
      id: workspace.data.id,
      plantings: workspace.data.garden?.plantings?.length ?? 0,
      publishedAtIso: workspace.data.publishedAtIso ?? null,
      structures: workspace.data.garden?.structures?.length ?? 0,
    },
    staleDrafts: staleDrafts.map((draft) => ({
      baseRevisionId: draft.data.baseRevisionId ?? null,
      email: authUsersByUid.get(draft.id)?.email ?? null,
      id: draft.id,
    })),
    missingProfiles,
    testIssues: testIssueIds,
    testNotifications: testNotifications.map((notification) => notification.id),
    testTasks: testTasks.map((task) => task.id),
    workspace: workspace.data,
  };
}

async function applyRepair({ firestore, report }) {
  const nowIso = new Date().toISOString();

  for (const issueId of report.testIssues) {
    await firestore.deleteDocument(`gardenWorkspaces/main/journal/${issueId}`);
  }

  for (const taskId of report.testTasks) {
    await firestore.deleteDocument(`gardenWorkspaces/main/tasks/${taskId}`);
  }

  for (const notificationId of report.testNotifications) {
    await firestore.deleteDocument(
      `gardenWorkspaces/main/notifications/${notificationId}`,
    );
  }

  for (const profile of report.missingProfiles) {
    await firestore.patchDocument(
      `users/${profile.id}`,
      createDefaultProductionUserProfile(profile, nowIso),
    );
  }

  for (const draft of report.staleDrafts) {
    await firestore.patchDocument(
      `gardenWorkspaces/main/drafts/${draft.id}`,
      createDraftFromPublished(report.workspace, draft.id, nowIso),
    );
  }
}

async function createBackup({ authUsers, firestore, projectId }) {
  const collections = [
    'gardenWorkspaces/main/drafts',
    'gardenWorkspaces/main/revisions',
    'gardenWorkspaces/main/journal',
    'gardenWorkspaces/main/harvests',
    'gardenWorkspaces/main/notifications',
    'gardenWorkspaces/main/tasks',
    'gardenWorkspaces/main/wateringSchedule',
    'gardenWorkspaces/main/weatherSnapshots',
    'users',
    'gardens',
  ];
  const rootDocuments = {
    'gardenWorkspaces/main': await firestore.getRawDocument(
      'gardenWorkspaces/main',
    ),
  };
  const collectionDocuments = {};

  for (const collectionPath of collections) {
    collectionDocuments[collectionPath] =
      await firestore.listRawCollection(collectionPath);
  }

  for (const userDocument of collectionDocuments.users ?? []) {
    const userId = getDocumentId(userDocument.name);

    collectionDocuments[`users/${userId}/pushTokens`] =
      await firestore.listRawCollection(`users/${userId}/pushTokens`);
  }

  for (const gardenDocument of collectionDocuments.gardens ?? []) {
    const userId = getDocumentId(gardenDocument.name);

    for (const subcollection of [
      'structures',
      'plantings',
      'tasks',
      'journal',
      'harvests',
      'notifications',
    ]) {
      collectionDocuments[`gardens/${userId}/${subcollection}`] =
        await firestore.listRawCollection(`gardens/${userId}/${subcollection}`);
    }
  }

  return {
    authUsers,
    collectionDocuments,
    createdAtIso: new Date().toISOString(),
    projectId,
    rootDocuments,
  };
}

function writeBackup(backup) {
  const safeTimestamp = backup.createdAtIso.replace(/[:.]/g, '-');
  const outputDir = path.join('output', 'production-backups');
  const backupPath = path.join(outputDir, `${safeTimestamp}.json`);

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  return backupPath;
}

function summarizeRepairReport(report) {
  return {
    latestWeather: report.latestWeather,
    published: report.published,
    staleDrafts: report.staleDrafts,
    missingProfiles: report.missingProfiles,
    testIssues: report.testIssues,
    testNotifications: report.testNotifications,
    testTasks: report.testTasks,
  };
}

function isProductionTestIssue(entry) {
  return (
    entry?.type === 'issue' &&
    entry.title === 'Test Issue for Emma' &&
    entry.body === 'Can you see this'
  );
}

const detroitLocation = {
  latitude: 42.3314,
  locationName: 'Detroit, MI',
  locationQuery: 'Detroit, MI',
  longitude: -83.0458,
  timezone: 'America/Detroit',
};

const detroitClimateProfile = {
  averageFirstFrost: '10-15',
  averageLastFrost: '04-30',
  editableByUser: true,
  hardinessZone: '6b',
  locationName: 'Detroit, MI',
  source: 'demoDefault',
  updatedAtIso: null,
};

function isSecretFaeriesMember(user) {
  return (
    user.email &&
    user.claims?.gardenAccess === true &&
    user.claims?.secretFaeriesMember === true
  );
}

function createDefaultProductionUserProfile(user, nowIso) {
  return {
    alertLocationQuery: detroitLocation.locationQuery,
    climateProfile: detroitClimateProfile,
    createdAtIso: nowIso,
    defaultGardenId: user.id,
    displayName: user.displayName ?? '',
    email: user.email,
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
      defaultWateringCheckTime: '07:00',
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
    uid: user.id,
    updatedAtIso: nowIso,
  };
}

function createDraftFromPublished(published, userId, nowIso) {
  return {
    baseRevisionId: published.id,
    garden: prepareGardenForUser(published.garden, userId),
    suggestionDecisions: [],
    updatedAtIso: nowIso,
    userId,
  };
}

function prepareGardenForUser(garden, userId) {
  return {
    ...garden,
    harvestEvents: remapGardenIds(garden.harvestEvents, userId),
    id: userId,
    journalEntries: remapGardenIds(garden.journalEntries, userId),
    notificationLogs: (garden.notificationLogs ?? []).map((log) => ({
      ...log,
      gardenId: log.gardenId ? userId : null,
      userId,
    })),
    sunShadeLayers: remapGardenIds(garden.sunShadeLayers, userId),
    tasks: remapGardenIds(garden.tasks, userId),
    userId,
    wateringSchedule: remapGardenIds(garden.wateringSchedule, userId),
    weatherSnapshots: remapGardenIds(garden.weatherSnapshots, userId),
  };
}

function remapGardenIds(values, userId) {
  return (values ?? []).map((value) => ({ ...value, gardenId: userId }));
}

class FirestoreRestClient {
  constructor({ accessToken, projectId }) {
    this.accessToken = accessToken;
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
  }

  async getRawDocument(pathname) {
    return this.request(pathname);
  }

  async getDecodedDocument(pathname) {
    const raw = await this.getRawDocument(pathname);

    return {
      data: decodeDocument(raw),
      id: getDocumentId(raw.name),
      raw,
    };
  }

  async listRawCollection(pathname) {
    const documents = [];
    let pageToken = null;

    do {
      const searchParams = new URLSearchParams({ pageSize: '1000' });

      if (pageToken) {
        searchParams.set('pageToken', pageToken);
      }

      const payload = await this.request(`${pathname}?${searchParams}`);

      documents.push(...(payload.documents ?? []));
      pageToken = payload.nextPageToken ?? null;
    } while (pageToken);

    return documents;
  }

  async listDecodedCollection(pathname) {
    const rawDocuments = await this.listRawCollection(pathname);

    return rawDocuments.map((raw) => ({
      data: decodeDocument(raw),
      id: getDocumentId(raw.name),
      raw,
    }));
  }

  async deleteDocument(pathname) {
    await this.request(pathname, { ignoreNotFound: true, method: 'DELETE' });
  }

  async patchDocument(pathname, data) {
    await this.request(pathname, {
      body: JSON.stringify({ fields: encodeFields(data) }),
      method: 'PATCH',
    });
  }

  async request(pathname, options = {}) {
    const response = await fetch(`${this.baseUrl}/${pathname}`, {
      body: options.body,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      method: options.method ?? 'GET',
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      if (options.ignoreNotFound && response.status === 404) {
        return payload;
      }

      throw new Error(
        `Firestore request failed (${response.status}) for ${pathname}: ${JSON.stringify(
          payload,
        )}`,
      );
    }

    return payload;
  }
}

function decodeDocument(document) {
  return Object.fromEntries(
    Object.entries(document.fields ?? {}).map(([key, value]) => [
      key,
      decodeValue(value),
    ]),
  );
}

function decodeValue(value) {
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map(decodeValue);
  }

  if ('booleanValue' in value) {
    return value.booleanValue;
  }

  if ('doubleValue' in value) {
    return Number(value.doubleValue);
  }

  if ('integerValue' in value) {
    return Number(value.integerValue);
  }

  if ('mapValue' in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields ?? {}).map(([key, nestedValue]) => [
        key,
        decodeValue(nestedValue),
      ]),
    );
  }

  if ('nullValue' in value) {
    return null;
  }

  if ('stringValue' in value) {
    return value.stringValue;
  }

  if ('timestampValue' in value) {
    return value.timestampValue;
  }

  return value;
}

function encodeFields(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      encodeValue(nestedValue),
    ]),
  );
}

function encodeValue(value) {
  if (Array.isArray(value)) {
    return {
      arrayValue:
        value.length > 0
          ? { values: value.map((item) => encodeValue(item)) }
          : {},
    };
  }

  if (value === null || value === undefined) {
    return { nullValue: null };
  }

  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }

  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }

  if (typeof value === 'string') {
    return { stringValue: value };
  }

  return { mapValue: { fields: encodeFields(value) } };
}

async function listAuthUsers({ accessToken, projectId }) {
  const users = [];
  let pageToken = null;

  do {
    const searchParams = new URLSearchParams({ maxResults: '1000' });

    if (pageToken) {
      searchParams.set('pageToken', pageToken);
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet?${searchParams}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(
        `Identity Toolkit request failed (${response.status}): ${JSON.stringify(
          payload,
        )}`,
      );
    }

    users.push(
      ...(payload.users ?? []).map((user) => ({
        claims: parseJsonObject(user.customAttributes),
        displayName: user.displayName ?? '',
        email: user.email ?? null,
        uid: user.localId,
      })),
    );
    pageToken = payload.nextPageToken ?? null;
  } while (pageToken);

  return users;
}

function parseJsonObject(value) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);

    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getDocumentId(name) {
  return name.split('/').pop();
}

function getProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.VITE_FIREBASE_PROJECT_ID ||
    'secret-faeries'
  );
}

async function getFirebaseCliAccessToken() {
  const require = createRequire(new URL('../package.json', import.meta.url));
  const firebaseAuth = require('firebase-tools/lib/auth');
  const account = firebaseAuth.getGlobalDefaultAccount();
  const scopes = [
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/firebase',
  ];

  if (!account?.tokens?.refresh_token) {
    throw new Error(
      'Firebase CLI login is required. Run `firebase login` or set GOOGLE_APPLICATION_CREDENTIALS.',
    );
  }

  const token = await firebaseAuth.getAccessToken(
    account.tokens.refresh_token,
    scopes,
  );

  if (!token?.access_token) {
    throw new Error('Unable to get an access token from Firebase CLI.');
  }

  return token.access_token;
}

function loadEnvFile(pathname) {
  if (!existsSync(pathname)) {
    return;
  }

  for (const line of readFileSync(pathname, 'utf8').split('\n')) {
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

await main();
