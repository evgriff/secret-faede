import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { GardenPlan, UserProfile } from '../../src/v2/domain';

const nowIso = '2026-07-09T12:00:00.000Z';

export function member(testEnv: RulesTestEnvironment, userId: string) {
  return testEnv.authenticatedContext(userId, {
    gardenAccess: true,
    secretFaeriesMember: true,
  });
}

export async function seedWorkspace(testEnv: RulesTestEnvironment) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const firestore = context.firestore();
    const published = {
      plan: plan(nowIso, 'Home garden'),
      publishedAtIso: nowIso,
      publishedByUserId: 'system',
      revisionId: 'revision-initial',
    };
    await firestore.doc('gardenWorkspaces/main').set({
      id: 'main',
      operationsAutomation: {
        lastCompletedAtIso: nowIso,
        status: 'ready',
      },
      publishedRevisionId: 'revision-initial',
      schemaVersion: 2,
      updatedAtIso: nowIso,
    });
    await firestore.doc('gardenWorkspaces/main/plans/published').set(published);
    await firestore
      .doc('gardenWorkspaces/main/revisions/revision-initial')
      .set({
        ...published,
        changeSummary: 'Initial garden',
      });
  });
}

export function plan(updatedAtIso: string, name: string): GardenPlan {
  return {
    createdAtIso: nowIso,
    id: 'garden-main',
    name,
    plantings: [],
    plot: {
      climate: {
        firstFrost: '10-15',
        hardinessZone: '6b',
        lastFrost: '04-30',
      },
      depthFt: 12,
      location: {
        coordinates: { latitude: 42.3314, longitude: -83.0458 },
        label: 'Detroit, MI',
        query: 'Detroit, MI',
        timezone: 'America/Detroit',
      },
      northDegrees: 0,
      snapFt: 0.125,
      widthFt: 16,
    },
    reviewDecisions: [],
    schemaVersion: 9,
    setupCompleted: true,
    structures: [],
    updatedAtIso,
  };
}

export function userProfile(userId: string): UserProfile {
  return {
    displayName: 'Primary Gardener',
    email: 'primary@example.com',
    notificationPreferences: {
      alertKinds: {
        frost: true,
        heat: true,
        severeWeather: true,
        taskDue: true,
        watering: true,
      },
      dailyCheckTime: '07:00',
      minimumWateringDeficitInches: 0.25,
      pushEnabled: false,
      quietHours: { end: '07:00', start: '21:00' },
    },
    schemaVersion: 2,
    timezone: 'America/Detroit',
    updatedAtIso: nowIso,
    userId,
  };
}

export function pushToken(tokenId: string) {
  return {
    createdAtIso: nowIso,
    firstRegisteredAt: new Date(nowIso),
    firstRegisteredAtIso: nowIso,
    installationId: 'installation-user-a',
    lastSeenAt: new Date(nowIso),
    lastSeenAtIso: nowIso,
    permission: 'granted',
    permissionLastCheckedAtIso: nowIso,
    platform: 'web',
    provider: 'firebaseCloudMessaging',
    status: 'active',
    token: 'fcm-token',
    tokenId,
    userAgent: 'rules-test',
  };
}

export function journal(id: string, createdByUserId: string) {
  return {
    body: 'Healthy growth',
    createdAtIso: nowIso,
    createdByUserId,
    id,
    occurredOn: '2026-07-09',
    photos: [],
    target: target(),
    title: 'Field note',
    type: 'note',
  };
}

export function harvest(id: string, createdByUserId: string) {
  return {
    amount: 3,
    createdAtIso: nowIso,
    createdByUserId,
    cropId: 'tomato',
    id,
    notes: '',
    occurredOn: '2026-07-09',
    plantingGroupId: 'crop-1',
    unit: 'count',
  };
}

export function task(id: string) {
  return {
    completedAtIso: null,
    createdAtIso: nowIso,
    dueOn: '2026-07-09',
    id,
    kind: 'inspect',
    notes: '',
    priority: 'medium',
    reason: 'Routine check',
    sourceId: null,
    status: 'open',
    target: target(),
    title: 'Inspect tomato',
    updatedAtIso: nowIso,
  };
}

export function waterApplication(
  id: string,
  revision: number,
  recordedByUserId = 'user-a',
) {
  return {
    amount: { depthInches: 0.4, unit: 'inches' },
    appliedAtIso: nowIso,
    cropGroupId: 'crop-1',
    efficiency: { confidence: 'medium', fraction: 0.8, source: 'estimated' },
    id,
    method: 'hose',
    outcome: 'applied',
    recordedAtIso: nowIso,
    recordedByUserId,
    revision,
  };
}

function target() {
  return { id: 'crop-1', kind: 'plantingGroup', label: 'Tomato' };
}
