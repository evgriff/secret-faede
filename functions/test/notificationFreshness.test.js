'use strict';

const assert = require('node:assert/strict');
const {
  createNotificationDeliveryPipeline,
  getDeliveryId,
  resolvePushTokenOwnership,
} = require('../notificationDelivery');
const {
  buildTaskNotification,
  buildWateringNotification,
  createGardenAlert,
} = require('../notificationLogic');
const { createMemoryFirestore } = require('./testFirestore');

const user = {
  customClaims: { gardenAccess: true, secretFaeriesMember: true },
  disabled: false,
  uid: 'user-a',
};
const auth = {
  async listUsers() {
    return { pageToken: undefined, users: [user] };
  },
};
const profile = {
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
    pushEnabled: true,
    quietHours: { end: '07:00', start: '21:00' },
  },
  schemaVersion: 2,
  timezone: 'America/Detroit',
  userId: 'user-a',
};

(async () => {
  await staleWateringCases();
  await thresholdEscalationCase();
  await staleTaskCase();
  await duplicateTokenOwnershipCase();
  console.log('notificationFreshness tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function staleWateringCases() {
  const cases = [
    {
      expectedReason: 'recommendationNoLongerDue',
      mutate: async ({ db, recommendationRef }) =>
        recommendationRef.set(
          { actionable: false, status: 'suppressed' },
          { merge: true },
        ),
      name: 'recommendation changes to non-due',
    },
    {
      expectedReason: 'recommendationAmountChanged',
      mutate: async ({ recommendationRef }) =>
        recommendationRef.set(
          { recommendedDepthInches: 0.31 },
          { merge: true },
        ),
      name: 'recommended amount changes',
    },
    {
      expectedReason: 'wateringAlreadyRecorded',
      mutate: async ({ db }) =>
        db
          .collection('gardenWorkspaces')
          .doc('main')
          .collection('waterApplications')
          .doc('watered-after-alert')
          .set({
            appliedAtIso: '2026-06-22T03:00:00.000Z',
            cropGroupId: 'tomato-group',
            id: 'watered-after-alert',
            outcome: 'applied',
            recordedAtIso: '2026-06-22T03:01:00.000Z',
            recordedByUserId: 'user-a',
            revision: 1,
          }),
      name: 'watering is recorded during deferral',
    },
    {
      expectedReason: 'publishedRevisionChanged',
      mutate: async ({ db }) =>
        db
          .collection('gardenWorkspaces')
          .doc('main')
          .set({ publishedRevisionId: 'revision-2' }, { merge: true }),
      name: 'published plan changes',
    },
  ];

  for (const scenario of cases) {
    const context = await createDeferredWateringCase(scenario.name);
    await scenario.mutate(context);
    await context.pipeline.processPendingDeliveries({
      now: new Date('2026-06-22T11:01:00.000Z'),
    });

    assert.equal(context.sendCount(), 0, scenario.name);
    const dump = context.db.dump();
    assert.equal(dump[context.receiptPath].status, 'skipped', scenario.name);
    assert.match(
      dump[context.receiptPath].decisionReason,
      new RegExp(scenario.expectedReason),
      scenario.name,
    );
    assert.equal(dump[context.alertPath].status, 'superseded', scenario.name);
  }
}

async function thresholdEscalationCase() {
  const db = createDb({
    'users/user-a': {
      ...profile,
      notificationPreferences: {
        ...profile.notificationPreferences,
        minimumWateringDeficitInches: 0.7,
      },
    },
  });
  const delivery = createCountingPipeline(db);
  const alert = createGardenAlert(
    buildWateringNotification({
      forecastRainCreditInches: 0,
      id: 'watering:tomato-group:2026-06-21:r1',
      recommendedDepthInches: 0.62,
      status: 'due',
      target: {
        cropGroupId: 'tomato-group',
        cropName: 'Tomato',
        kind: 'cropGroup',
      },
    }),
    {
      amountInches: 0.62,
      createdAtIso: '2026-06-21T12:00:00.000Z',
      targetId: 'tomato-group',
      workspaceRevisionId: 'revision-1',
    },
  );
  const recommendationRef = db
    .collection('gardenWorkspaces')
    .doc('main')
    .collection('wateringRecommendations')
    .doc('tomato-group');
  await recommendationRef.set({
    actionable: true,
    calculatedAtIso: alert.createdAtIso,
    id: alert.recommendationId,
    recommendedDepthInches: 0.62,
    status: 'due',
    target: { cropGroupId: 'tomato-group' },
    workspaceRevisionId: 'revision-1',
  });
  await delivery.pipeline.publishAndFanOutAlert(alert, {
    now: new Date('2026-06-21T13:00:00.000Z'),
  });
  assert.equal(delivery.sendCount(), 0);

  const escalated = {
    ...alert,
    amountInches: 0.8,
    body: alert.body.replace('0.62', '0.8'),
    severity: 'warning',
  };
  await recommendationRef.set(
    {
      calculatedAtIso: '2026-06-21T14:00:00.000Z',
      recommendedDepthInches: 0.8,
    },
    { merge: true },
  );
  await delivery.pipeline.publishAndFanOutAlert(escalated, {
    now: new Date('2026-06-21T14:00:00.000Z'),
  });
  const receipt =
    db.dump()[
      `users/user-a/notificationDeliveries/${getDeliveryId(alert.id, 'push')}`
    ];
  assert.equal(delivery.sendCount(), 1);
  assert.equal(receipt.status, 'sent');
  assert.equal(receipt.amountInches, 0.8);
}

async function createDeferredWateringCase(id) {
  const db = createDb();
  const recommendation = {
    id: `watering:${id}`,
    recommendedDepthInches: 0.62,
    status: 'due',
    target: {
      cropGroupId: 'tomato-group',
      cropName: 'Tomato',
      kind: 'cropGroup',
    },
  };
  const alert = createGardenAlert(
    buildWateringNotification(recommendation, {}),
    {
      amountInches: 0.62,
      createdAtIso: '2026-06-22T01:55:00.000Z',
      targetId: 'tomato-group',
      workspaceRevisionId: 'revision-1',
    },
  );
  const recommendationRef = db
    .collection('gardenWorkspaces')
    .doc('main')
    .collection('wateringRecommendations')
    .doc('tomato-group');
  await recommendationRef.set({
    actionable: true,
    calculatedAtIso: alert.createdAtIso,
    id: alert.recommendationId,
    recommendedDepthInches: 0.62,
    status: 'due',
    target: { cropGroupId: 'tomato-group' },
    workspaceRevisionId: 'revision-1',
  });
  const delivery = createCountingPipeline(db);
  await delivery.pipeline.publishAndFanOutAlert(alert, {
    now: new Date('2026-06-22T02:00:00.000Z'),
  });
  assert.equal(delivery.sendCount(), 0);
  return {
    ...delivery,
    alertPath: `gardenWorkspaces/main/alerts/${alert.id}`,
    db,
    recommendationRef,
    receiptPath: `users/user-a/notificationDeliveries/${getDeliveryId(alert.id, 'push')}`,
  };
}

async function staleTaskCase() {
  const db = createDb();
  const task = {
    dueOn: '2026-06-21',
    id: 'task-a',
    notes: 'Tie the tomatoes.',
    priority: 'high',
    status: 'open',
    title: 'Support tomatoes',
  };
  const taskRef = db
    .collection('gardenWorkspaces')
    .doc('main')
    .collection('tasks')
    .doc(task.id);
  await taskRef.set(task);
  const alert = createGardenAlert(buildTaskNotification(task), {
    createdAtIso: '2026-06-21T12:00:00.000Z',
    taskId: task.id,
    workspaceRevisionId: 'revision-1',
  });
  const delivery = createCountingPipeline(db);
  await delivery.pipeline.publishAndFanOutAlert(alert, {
    now: new Date('2026-06-22T02:00:00.000Z'),
  });
  await taskRef.set({ status: 'done' }, { merge: true });
  await delivery.pipeline.processPendingDeliveries({
    now: new Date('2026-06-22T11:01:00.000Z'),
  });
  const receipt =
    db.dump()[
      `users/user-a/notificationDeliveries/${getDeliveryId(alert.id, 'push')}`
    ];
  assert.equal(delivery.sendCount(), 0);
  assert.equal(receipt.status, 'skipped');
  assert.match(receipt.decisionReason, /taskNoLongerOpen/);
}

async function duplicateTokenOwnershipCase() {
  const db = createDb({
    'users/user-b': { ...profile, userId: 'user-b' },
    'users/user-a/pushTokens/same-a': {
      installationId: 'shared-installation-1234',
      lastSeenAtIso: '2026-06-21T12:00:00.000Z',
      platform: 'web',
      status: 'active',
      token: 'same-device-token',
    },
    'users/user-b/pushTokens/same-b': {
      installationId: 'shared-installation-1234',
      lastSeenAtIso: '2026-06-21T13:00:00.000Z',
      platform: 'web',
      status: 'active',
      token: 'rotated-device-token',
    },
  });
  const ownership = await resolvePushTokenOwnership(db, [
    user,
    { ...user, uid: 'user-b' },
  ]);
  assert.deepEqual(
    ownership.get('user-a').map((entry) => entry.token),
    ['valid-token'],
  );
  assert.equal(ownership.get('user-b').length, 1);
  assert.equal(ownership.get('user-b')[0].token, 'rotated-device-token');
}

function createCountingPipeline(db) {
  let sends = 0;
  return {
    pipeline: createNotificationDeliveryPipeline({
      auth,
      db,
      logger: { warn() {} },
      messaging: {
        async sendEach() {
          sends += 1;
          return {
            failureCount: 0,
            responses: [{ success: true }],
            successCount: 1,
          };
        },
      },
    }),
    sendCount: () => sends,
  };
}

function createDb(extra = {}) {
  return createMemoryFirestore({
    'gardenWorkspaces/main': { publishedRevisionId: 'revision-1' },
    'users/user-a': profile,
    'users/user-a/pushTokens/token-a': {
      lastSeenAtIso: '2026-06-21T12:00:00.000Z',
      platform: 'web',
      status: 'active',
      token: 'valid-token',
    },
    ...extra,
  });
}
