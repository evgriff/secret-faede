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

function hasSecretFaeriesAccess(auth) {
  return (
    auth?.token?.gardenAccess === true &&
    auth?.token?.secretFaeriesMember === true
  );
}

function createDefaultUserProfile(uid, email, nowIso) {
  return {
    alertLocationQuery: 'Detroit, MI',
    climateProfile: {
      averageFirstFrost: '10-15',
      averageLastFrost: '04-30',
      editableByUser: true,
      hardinessZone: '6b',
      locationName: 'Detroit, MI',
      source: 'demoDefault',
      updatedAtIso: null,
    },
    createdAtIso: nowIso,
    defaultGardenId: uid,
    displayName: '',
    email: email || '',
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
      timezone: 'America/Detroit',
      wateringAlertThresholdIn: 0.25,
    },
    timezone: 'America/Detroit',
    uid,
    updatedAtIso: nowIso,
  };
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

  if (!hasSecretFaeriesAccess(request.auth)) {
    throw new HttpsError(
      'permission-denied',
      'This account is not provisioned for Secret Faeries.',
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

  const profileRef = db.collection('users').doc(uid);
  const profileSnapshot = await profileRef.get();

  let profile = profileSnapshot.exists ? profileSnapshot.data() : null;

  if (!profile) {
    profile = createDefaultUserProfile(
      uid,
      request.auth.token.email,
      new Date().toISOString(),
    );
    await profileRef.set(profile, { merge: true });
  }

  const runGardenOperationsForUser = createOperationRunner({
    admin,
    db,
    dispatchNotification,
    logger,
  });
  const result = await runGardenOperationsForUser(uid, profile, {
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
  'gardenWorkspaces/main/drafts/{uid}',
  async (event) => {
    const beforeDraft = event.data?.before.exists
      ? event.data.before.data()
      : null;
    const afterDraft = event.data?.after.exists
      ? event.data.after.data()
      : null;
    const beforeGarden =
      beforeDraft && typeof beforeDraft.garden === 'object'
        ? beforeDraft.garden
        : null;
    const afterGarden =
      afterDraft && typeof afterDraft.garden === 'object'
        ? afterDraft.garden
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
        dedupeKey: notification.dedupeKey ?? null,
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
  dedupeKey = null,
  garden,
  profile,
  title,
  type,
  uid,
}) {
  const duplicate = wasRecentlyLogged({
    body,
    dedupeKey,
    garden,
    now: new Date(),
    type,
  });

  if (duplicate) {
    logger.info('Skipping duplicate notification', { type, uid });
    return;
  }

  const inAppDecision = shouldSendNotification({
    channel: 'inApp',
    profile,
    type,
  });

  await writeNotificationLog(
    createNotificationLog({
      body,
      channel: 'inApp',
      decisionReason: inAppDecision.reason,
      dedupeKey,
      gardenId: garden.id || uid,
      provider: 'inApp',
      recipientRedacted: 'in-app',
      status: inAppDecision.allowed ? 'sent' : 'skipped',
      title,
      type,
      userId: uid,
    }),
    uid,
    garden,
  );

  await sendPushAndLog({
    body,
    dedupeKey,
    garden,
    profile,
    title,
    type,
    uid,
  });
}

async function sendPushAndLog({
  body,
  dedupeKey = null,
  garden,
  profile,
  title,
  type,
  uid,
}) {
  const decision = shouldSendNotification({ channel: 'push', profile, type });

  if (!decision.allowed) {
    await writeNotificationLog(
      createNotificationLog({
        body,
        channel: 'push',
        decisionReason: decision.reason,
        dedupeKey,
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
      garden,
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
        dedupeKey,
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
      garden,
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
        dedupeKey,
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
      garden,
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
      dedupeKey,
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
    garden,
  );

  return {
    reason:
      response.failureCount > 0 ? 'partial push failure' : 'push delivered',
    status: response.successCount > 0 ? 'sent' : 'failed',
  };
}

async function writeNotificationLog(log, uid, garden, extra = {}) {
  const payload = {
    ...log,
    ...extra,
  };
  const nextLogs = [...(garden.notificationLogs || []), payload].slice(-60);

  garden.notificationLogs = nextLogs;

  await db
    .collection('gardenWorkspaces')
    .doc('main')
    .collection('notifications')
    .doc(payload.id)
    .set(payload);
  await db.collection('gardenWorkspaces').doc('main').set(
    {
      sharedOperationsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      sharedOperationsUpdatedAtIso: payload.createdAtIso,
    },
    { merge: true },
  );
}

function wasRecentlyLogged({ body, dedupeKey = null, garden, now, type }) {
  const nowMs = now.getTime();
  const cutoffMs = nowMs - 24 * 60 * 60 * 1000;
  const fallbackKey = `${type}:${body}`;

  return (garden.notificationLogs || []).some((log) => {
    const createdAt = Date.parse(log.createdAtIso || '');
    const snoozedUntil = Date.parse(log.snoozedUntilIso || '');
    const matchesAlert =
      (dedupeKey &&
        log.type === type &&
        (log.dedupeKey === dedupeKey || log.body === body)) ||
      ((!dedupeKey || !log.dedupeKey) &&
        log.type === type &&
        (log.body === body || `${log.type}:${log.body}` === fallbackKey));

    if (!matchesAlert) {
      return false;
    }

    if (Number.isFinite(snoozedUntil) && snoozedUntil > now.getTime()) {
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
