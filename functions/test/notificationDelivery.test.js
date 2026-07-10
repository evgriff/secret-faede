'use strict';

const assert = require('node:assert/strict');
const {
  buildDataOnlyMessage,
  buildNativeMessage,
  buildWebMessage,
  createNotificationDeliveryPipeline,
  getDeliveryId,
  publishGardenAlert,
} = require('../notificationDelivery');
const {
  buildWateringNotification,
  createGardenAlert,
} = require('../notificationLogic');
const { createMemoryFirestore } = require('./testFirestore');

const profile = {
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
    pushEnabled: true,
    quietHours: { end: '07:00', start: '21:00' },
  },
  schemaVersion: 2,
  timezone: 'America/Detroit',
  userId: 'user-a',
};
const authorizedUser = {
  customClaims: { gardenAccess: true, secretFaeriesMember: true },
  disabled: false,
  uid: 'user-a',
};
const revokedUser = {
  customClaims: { gardenAccess: false, secretFaeriesMember: false },
  disabled: false,
  uid: 'user-revoked',
};
const auth = {
  async listUsers() {
    return { pageToken: undefined, users: [authorizedUser, revokedUser] };
  },
};

function createAlert(
  id = 'recommendation-a',
  createdAtIso = '2026-06-21T12:00:00.000Z',
) {
  const recommendation = {
    id,
    recommendedDepthInches: 0.62,
    status: 'due',
    target: {
      cropGroupId: 'tomato-group',
      cropName: 'Tomato',
      deepLink: '/app/today?focus=watering&cropGroupId=tomato-group',
      kind: 'cropGroup',
    },
  };

  return createGardenAlert(
    buildWateringNotification(recommendation, {
      forecastRainNext24In: 0,
      precipitation: { status: 'current' },
    }),
    {
      amountInches: recommendation.recommendedDepthInches,
      createdAtIso,
      targetId: recommendation.target.cropGroupId,
      workspaceRevisionId: 'revision-1',
    },
  );
}

function createDeliveryDb(extra = {}) {
  return createMemoryFirestore({
    'gardenWorkspaces/main': {
      publishedRevisionId: 'revision-1',
    },
    'users/user-a': profile,
    'users/user-a/pushTokens/token-a': {
      platform: 'web',
      token: 'valid-token',
    },
    ...extra,
  });
}

async function seedCurrentRecommendation(db, alert, overrides = {}) {
  await db
    .collection('gardenWorkspaces')
    .doc('main')
    .collection('wateringRecommendations')
    .doc(alert.targetId)
    .set({
      actionable: true,
      calculatedAtIso: alert.createdAtIso,
      id: alert.recommendationId,
      recommendedDepthInches: alert.amountInches,
      status: 'due',
      target: { cropGroupId: alert.targetId },
      workspaceRevisionId: alert.workspaceRevisionId,
      ...overrides,
    });
}

(async () => {
  const now = new Date('2026-06-21T13:00:00.000Z');
  const db = createDeliveryDb({
    'users/user-a/pushTokens/token-invalid': {
      platform: 'native-ios',
      token: 'invalid-token',
    },
  });
  const sentMessages = [];
  const messaging = {
    async sendEach(messages) {
      sentMessages.push(...messages);
      return {
        failureCount: 1,
        responses: [
          { success: true },
          {
            error: {
              code: 'messaging/registration-token-not-registered',
            },
            success: false,
          },
        ],
        successCount: 1,
      };
    },
  };
  const pipeline = createNotificationDeliveryPipeline({
    auth,
    db,
    logger: { warn() {} },
    messaging,
  });
  const alert = createAlert();
  await seedCurrentRecommendation(db, alert);
  const first = await pipeline.publishAndFanOutAlert(alert, { now });

  assert.equal(first.recipientCount, 1, 'revoked Auth users are excluded');
  assert.equal(sentMessages.length, 2);
  assert.equal('notification' in sentMessages[0], false);
  assert.equal(sentMessages[0].token, 'valid-token');
  assert.equal(
    sentMessages[0].data.link,
    '/app/today?focus=watering&cropGroupId=tomato-group',
  );
  assert.deepEqual(sentMessages[1].notification, {
    body: alert.body,
    title: alert.title,
  });
  assert.equal(sentMessages[1].token, 'invalid-token');
  assert.equal(sentMessages[1].apns.headers['apns-priority'], '10');
  assert.equal(
    db.dump()['users/user-a/pushTokens/token-invalid'],
    undefined,
    'invalid FCM tokens are removed',
  );
  assert.equal(
    Object.keys(db.dump()).some((path) => path.includes('user-revoked')),
    false,
    'revoked users receive no private delivery records',
  );

  await pipeline.publishAndFanOutAlert(alert, { now });
  assert.equal(
    sentMessages.length,
    2,
    'user + channel + alert idempotency prevents a duplicate push',
  );
  assert.ok(
    db.dump()[
      `users/user-a/notificationDeliveries/${getDeliveryId(alert.id, 'inApp')}`
    ],
  );
  const receipt =
    db.dump()[
      `users/user-a/notificationDeliveries/${getDeliveryId(alert.id, 'push')}`
    ];
  assert.equal(receipt.title, 'Water Tomato');
  assert.match(receipt.body, /Apply 0.62 in to Tomato/);
  assert.ok(
    db.dump()[
      `users/user-a/notificationDeliveries/${getDeliveryId(alert.id, 'push')}`
    ],
  );

  const directPayload = buildDataOnlyMessage(alert, ['token']);
  assert.equal('notification' in directPayload, false);
  assert.equal(directPayload.data.alertId, alert.id);
  assert.equal('notification' in buildWebMessage(alert, 'web-token'), false);
  assert.deepEqual(
    buildNativeMessage(alert, 'android-token', 'native-android').notification,
    { body: alert.body, title: alert.title },
  );
  assert.equal(
    buildNativeMessage(alert, 'android-token', 'native-android').android
      .collapseKey,
    alert.id,
  );
  assert.equal(
    buildNativeMessage(alert, 'ios-token', 'native-ios').apns.headers[
      'apns-collapse-id'
    ],
    alert.id,
  );
  const updatedAlert = {
    ...alert,
    amountInches: 0.72,
    body: alert.body.replace('0.62', '0.72'),
    severity: 'warning',
  };
  await publishGardenAlert(
    db,
    updatedAlert,
    new Date('2026-06-21T13:05:00.000Z'),
  );
  assert.equal(
    db.dump()[`gardenWorkspaces/main/alerts/${alert.id}`].amountInches,
    0.72,
    'the stable active alert is updated instead of freezing an old amount',
  );

  const quietDb = createDeliveryDb();
  let quietSends = 0;
  const quietPipeline = createNotificationDeliveryPipeline({
    auth,
    db: quietDb,
    logger: { warn() {} },
    messaging: {
      async sendEach() {
        quietSends += 1;
        return {
          failureCount: 0,
          responses: [{ success: true }],
          successCount: 1,
        };
      },
    },
  });
  const quietAlert = createAlert(
    'quiet-recommendation',
    '2026-06-22T01:55:00.000Z',
  );
  await seedCurrentRecommendation(quietDb, quietAlert);
  await quietPipeline.publishAndFanOutAlert(quietAlert, {
    now: new Date('2026-06-22T02:00:00.000Z'),
  });
  const quietReceiptPath = `users/user-a/notificationDeliveries/${getDeliveryId(
    quietAlert.id,
    'push',
  )}`;
  assert.equal(quietSends, 0);
  assert.equal(quietDb.dump()[quietReceiptPath].status, 'deferred');
  assert.equal(
    quietDb.dump()[quietReceiptPath].deliverAfterIso,
    '2026-06-22T11:00:00.000Z',
  );
  await quietPipeline.processPendingDeliveries({
    now: new Date('2026-06-22T11:01:00.000Z'),
  });
  assert.equal(quietSends, 1);
  assert.equal(quietDb.dump()[quietReceiptPath].status, 'sent');

  const checkTimeDb = createDeliveryDb({
    'users/user-a': {
      ...profile,
      notificationPreferences: {
        ...profile.notificationPreferences,
        dailyCheckTime: '10:30',
      },
    },
  });
  let checkTimeSends = 0;
  const checkTimePipeline = createNotificationDeliveryPipeline({
    auth,
    db: checkTimeDb,
    logger: { warn() {} },
    messaging: {
      async sendEach() {
        checkTimeSends += 1;
        return {
          failureCount: 0,
          responses: [{ success: true }],
          successCount: 1,
        };
      },
    },
  });
  const checkTimeAlert = createAlert('check-time-recommendation');
  const checkTimeReceiptPath = `users/user-a/notificationDeliveries/${getDeliveryId(
    checkTimeAlert.id,
    'push',
  )}`;
  await seedCurrentRecommendation(checkTimeDb, checkTimeAlert);
  await checkTimePipeline.publishAndFanOutAlert(checkTimeAlert, { now });
  assert.equal(checkTimeSends, 0);
  assert.equal(checkTimeDb.dump()[checkTimeReceiptPath].status, 'deferred');
  assert.equal(
    checkTimeDb.dump()[checkTimeReceiptPath].deliverAfterIso,
    '2026-06-21T14:30:00.000Z',
  );
  await checkTimePipeline.processPendingDeliveries({
    now: new Date('2026-06-21T14:31:00.000Z'),
  });
  assert.equal(checkTimeSends, 1);
  assert.equal(checkTimeDb.dump()[checkTimeReceiptPath].status, 'sent');

  const retryDb = createDeliveryDb();
  let retrySends = 0;
  const retryPipeline = createNotificationDeliveryPipeline({
    auth,
    db: retryDb,
    logger: { warn() {} },
    messaging: {
      async sendEach() {
        retrySends += 1;
        throw new Error('temporary provider outage');
      },
    },
  });
  const retryAlert = createAlert('retry-recommendation');
  const retryReceiptPath = `users/user-a/notificationDeliveries/${getDeliveryId(
    retryAlert.id,
    'push',
  )}`;

  await seedCurrentRecommendation(retryDb, retryAlert);
  await retryPipeline.publishAndFanOutAlert(retryAlert, { now });
  assert.equal(retryDb.dump()[retryReceiptPath].status, 'retrying');
  await retryPipeline.processPendingDeliveries({
    now: new Date('2026-06-21T13:06:00.000Z'),
  });
  assert.equal(retryDb.dump()[retryReceiptPath].attemptCount, 2);
  await retryPipeline.processPendingDeliveries({
    now: new Date('2026-06-21T13:37:00.000Z'),
  });
  assert.equal(retrySends, 3);
  assert.equal(retryDb.dump()[retryReceiptPath].attemptCount, 3);
  assert.equal(retryDb.dump()[retryReceiptPath].status, 'failed');

  console.log('notificationDelivery tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
