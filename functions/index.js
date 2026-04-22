'use strict';

const admin = require('firebase-admin');
const { logger } = require('firebase-functions');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const {
  buildFrostNotification,
  buildHeatNotification,
  buildSevereWeatherNotification,
  createNotificationLog,
  shouldSendNotification,
} = require('./notificationLogic');
const { createOperationRunner } = require('./operationRunner');
const { createBackendWeatherProvider } = require('./weatherProviders');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

function hasSecretFaedeAccess(auth) {
  return (
    auth?.token?.gardenAccess === true &&
    auth?.token?.secretFaedeMember === true
  );
}

exports.dailyWateringCheck = onSchedule(
  {
    schedule: '0 * * * *',
    timeZone: 'UTC',
  },
  async () => {
    const weatherProvider = createBackendWeatherProvider(logger);
    const runGardenOperationsForUser = createOperationRunner({
      admin,
      db,
      dispatchNotification,
      logger,
    });
    const usersSnapshot = await db.collection('users').get();
    let generatedCount = 0;

    for (const userDocument of usersSnapshot.docs) {
      const result = await runGardenOperationsForUser(
        userDocument.id,
        userDocument.data(),
        { weatherProvider },
      );

      if (result.generated) {
        generatedCount += 1;
      }
    }

    logger.info('Scheduled garden operations completed', {
      generatedCount,
      userCount: usersSnapshot.size,
    });
  },
);

exports.refreshGardenOperations = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError(
      'unauthenticated',
      'Sign in before refreshing garden operations.',
    );
  }

  if (!hasSecretFaedeAccess(request.auth)) {
    throw new HttpsError(
      'permission-denied',
      'This account is not provisioned for Secret Faede.',
    );
  }

  const uid = request.auth.uid;
  const requestedUid =
    typeof request.data?.userId === 'string' ? request.data.userId : uid;

  if (requestedUid !== uid) {
    throw new HttpsError(
      'permission-denied',
      'You can only refresh your own garden.',
    );
  }

  const profileSnapshot = await db.collection('users').doc(uid).get();

  if (!profileSnapshot.exists) {
    throw new HttpsError('not-found', 'No notification profile exists.');
  }

  const runGardenOperationsForUser = createOperationRunner({
    admin,
    db,
    dispatchNotification,
    logger,
  });
  const result = await runGardenOperationsForUser(uid, profileSnapshot.data(), {
    force: true,
    weatherProvider: createBackendWeatherProvider(logger),
  });

  if (result.skipped === 'noGarden') {
    throw new HttpsError('not-found', 'No garden exists for this user.');
  }

  return {
    generatedAtIso: result.generatedAtIso ?? null,
    ok: result.generated === true,
    providerId: result.providerId ?? null,
    recommendationCount: result.recommendationCount ?? 0,
    taskCount: result.taskCount ?? 0,
  };
});

exports.onGardenWeatherSnapshotUpdated = onDocumentWritten(
  'gardens/{uid}',
  async (event) => {
    const beforeGarden = event.data?.before.exists
      ? event.data.before.data()
      : null;
    const afterGarden = event.data?.after.exists
      ? event.data.after.data()
      : null;

    if (!afterGarden) {
      return;
    }

    const uid = event.params.uid;
    const beforeSnapshot = getLatestSnapshot(beforeGarden);
    const afterSnapshot = getLatestSnapshot(afterGarden);

    if (!afterSnapshot || beforeSnapshot?.id === afterSnapshot.id) {
      return;
    }

    const profileSnapshot = await db.collection('users').doc(uid).get();

    if (!profileSnapshot.exists) {
      return;
    }

    const profile = profileSnapshot.data();
    const notifications = [];

    if (
      afterSnapshot.frostRisk &&
      afterSnapshot.frostRisk !== 'none' &&
      beforeSnapshot?.frostRisk !== afterSnapshot.frostRisk
    ) {
      notifications.push(buildFrostNotification(afterGarden, afterSnapshot));
    }

    if (
      afterSnapshot.heatRisk &&
      afterSnapshot.heatRisk !== 'none' &&
      beforeSnapshot?.heatRisk !== afterSnapshot.heatRisk
    ) {
      notifications.push(buildHeatNotification(afterGarden, afterSnapshot));
    }

    if ((afterSnapshot.alertSummaries || []).length > 0) {
      notifications.push(buildSevereWeatherNotification(afterSnapshot));
    }

    for (const notification of notifications) {
      await dispatchNotification({
        body: notification.body,
        garden: afterGarden,
        profile,
        title: notification.title,
        type: notification.type,
        uid,
      });
    }
  },
);

async function dispatchNotification({
  body,
  garden,
  profile,
  title,
  type,
  uid,
}) {
  const duplicate = await wasRecentlyLogged({
    body,
    channel: 'inApp',
    type,
    uid,
  });

  if (duplicate) {
    logger.info('Skipping duplicate notification', { type, uid });
    return;
  }

  await writeNotificationLog(
    createNotificationLog({
      body,
      channel: 'inApp',
      decisionReason: shouldSendNotification({
        channel: 'inApp',
        profile,
        type,
      }).reason,
      gardenId: garden.id || uid,
      provider: 'inApp',
      recipientRedacted: 'in-app',
      status: shouldSendNotification({
        channel: 'inApp',
        profile,
        type,
      }).allowed
        ? 'sent'
        : 'skipped',
      title,
      type,
      userId: uid,
    }),
    uid,
  );

  await sendPushAndLog({
    body,
    garden,
    profile,
    title,
    type,
    uid,
  });
}

async function sendPushAndLog({ body, garden, profile, title, type, uid }) {
  const decision = shouldSendNotification({ channel: 'push', profile, type });

  if (!decision.allowed) {
    await writeNotificationLog(
      createNotificationLog({
        body,
        channel: 'push',
        decisionReason: decision.reason,
        errorMessage: decision.reason,
        gardenId: garden.id || uid,
        provider: 'firebaseCloudMessaging',
        recipientRedacted: 'push',
        status: 'skipped',
        title,
        type,
        userId: uid,
      }),
      uid,
    );
    return { reason: decision.reason, status: 'skipped' };
  }

  const tokensSnapshot = await db
    .collection('users')
    .doc(uid)
    .collection('pushTokens')
    .get();
  const tokenDocuments = tokensSnapshot.docs
    .map((document) => ({
      id: document.id,
      ref: document.ref,
      token: document.data().token,
    }))
    .filter((entry) => Boolean(entry.token));
  const tokens = tokenDocuments.map((entry) => entry.token);

  if (tokens.length === 0) {
    await writeNotificationLog(
      createNotificationLog({
        body,
        channel: 'push',
        errorMessage: 'No web or native push tokens registered',
        gardenId: garden.id || uid,
        provider: 'firebaseCloudMessaging',
        recipientRedacted: 'push',
        status: 'skipped',
        title,
        type,
        userId: uid,
      }),
      uid,
    );
    return {
      reason: 'No web or native push tokens registered',
      status: 'skipped',
    };
  }

  const deepLink = getDeepLinkForNotification(type);
  let response;

  try {
    response = await messaging.sendEachForMulticast({
      data: { body, link: deepLink, title, type },
      notification: { body, title },
      tokens: tokens.slice(0, 500),
      webpush: {
        fcmOptions: {
          link: deepLink,
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await writeNotificationLog(
      createNotificationLog({
        attemptCount: tokens.length,
        body,
        channel: 'push',
        decisionReason: 'push provider error',
        deepLink,
        errorMessage,
        gardenId: garden.id || uid,
        provider: 'firebaseCloudMessaging',
        recipientRedacted: `${tokens.length} push tokens`,
        status: 'failed',
        title,
        type,
        userId: uid,
      }),
      uid,
    );

    return { reason: errorMessage, status: 'failed' };
  }

  const invalidTokenDeletes = response.responses.flatMap(
    (sendResponse, index) => {
      const code = sendResponse.error?.code || '';
      const tokenDocument = tokenDocuments[index];

      return isInvalidFcmTokenCode(code) && tokenDocument
        ? [tokenDocument.ref.delete()]
        : [];
    },
  );

  await Promise.all(invalidTokenDeletes);

  await writeNotificationLog(
    createNotificationLog({
      attemptCount: tokens.length,
      body,
      channel: 'push',
      decisionReason:
        response.failureCount > 0 ? 'partial push failure' : 'allowed',
      deepLink,
      errorMessage:
        response.failureCount > 0
          ? `${response.failureCount} push sends failed; ${invalidTokenDeletes.length} stale tokens removed`
          : null,
      gardenId: garden.id || uid,
      provider: 'firebaseCloudMessaging',
      recipientRedacted: `${response.successCount}/${tokens.length} web tokens`,
      status: response.successCount > 0 ? 'sent' : 'failed',
      title,
      type,
      userId: uid,
    }),
    uid,
  );

  return {
    reason:
      response.failureCount > 0 ? 'partial push failure' : 'push delivered',
    status: response.successCount > 0 ? 'sent' : 'failed',
  };
}

async function writeNotificationLog(log, uid, extra = {}) {
  const payload = {
    ...log,
    ...extra,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db
    .collection('gardens')
    .doc(uid)
    .collection('notifications')
    .doc(log.id)
    .set(payload);
}

async function wasRecentlyLogged({ body, channel, type, uid }) {
  const snapshot = await db
    .collection('gardens')
    .doc(uid)
    .collection('notifications')
    .limit(100)
    .get();
  const nowMs = Date.now();
  const cutoffMs = nowMs - 24 * 60 * 60 * 1000;
  const dedupeKey = `${channel}:${type}:${body}`;

  return snapshot.docs.some((document) => {
    const log = document.data();
    const createdAt = Date.parse(log.createdAtIso || '');
    const snoozedUntil = Date.parse(log.snoozedUntilIso || '');
    const matchesAlert =
      log.channel === channel &&
      log.type === type &&
      (log.body === body || log.dedupeKey === dedupeKey);

    if (!matchesAlert) {
      return false;
    }

    if (Number.isFinite(snoozedUntil) && snoozedUntil > nowMs) {
      return true;
    }

    return Number.isFinite(createdAt) && createdAt >= cutoffMs;
  });
}

function getLatestSnapshot(garden) {
  const snapshots = garden?.weatherSnapshots || [];

  return [...snapshots].sort((left, right) =>
    String(right.capturedAtIso || '').localeCompare(
      String(left.capturedAtIso || ''),
    ),
  )[0];
}

function isInvalidFcmTokenCode(code) {
  return [
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
  ].includes(code);
}

function getDeepLinkForNotification(type) {
  if (type === 'task' || type === 'taskDue' || type === 'watering') {
    return '/app/today';
  }

  return '/app/today';
}
