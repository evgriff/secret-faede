'use strict';

const admin = require('firebase-admin');
const { logger } = require('firebase-functions');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const {
  buildFrostNotification,
  buildHeatNotification,
  buildSevereWeatherNotification,
  createNotificationLog,
  isSmsFallbackNotificationType,
  redactPhone,
  shouldSendNotification,
} = require('./notificationLogic');
const { createOperationRunner } = require('./operationRunner');
const { createBackendWeatherProvider } = require('./weatherProviders');
const {
  createSmsConsent,
  getSmsKeywordIntent,
  getSmsRateLimitDecision,
  normalizePhone,
} = require('./notificationCompliance');
const {
  getnotification providerMessageStatus,
  isSmsDryRun,
  isValidnotification providerWebhook,
  sendnotification providerMessageWithRetry,
  retiredDeliveryProviderId,
} = require('./notificationProvider');
const {
  parsenotification providerDeliveryWebhook,
  parsenotification providerInboundMessageWebhook,
} = require('./notificationProviderWebhooks');

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

exports.sendTestSmsAlert = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError(
      'unauthenticated',
      'Sign in before sending a test carrier messaging.',
    );
  }

  if (!hasSecretFaedeAccess(request.auth)) {
    throw new HttpsError(
      'permission-denied',
      'This account is not provisioned for Secret Faede.',
    );
  }

  const uid = request.auth.uid;
  const profileSnapshot = await db.collection('users').doc(uid).get();

  if (!profileSnapshot.exists) {
    throw new HttpsError('not-found', 'No notification profile exists.');
  }

  const profile = profileSnapshot.data();
  const gardenSnapshot = await db.collection('gardens').doc(uid).get();
  const garden = gardenSnapshot.exists
    ? gardenSnapshot.data()
    : { id: uid, userId: uid };
  const title = 'Secret Faede frost test';
  const body =
    'Frost is possible tonight. This is a controlled carrier messaging fallback test.';

  await sendSmsAndLog({
    body,
    garden,
    profile,
    title,
    type: 'frost',
    uid,
  });

  return { ok: true };
});

exports.retiredDeliveryWebhook = onRequest(async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).send('Method not allowed');
    return;
  }

  if (!isValidnotification providerWebhook(request)) {
    response.status(403).send('Invalid notification provider signature');
    return;
  }

  const inboundMessage = parsenotification providerInboundMessageWebhook(request.body);
  const from = normalizePhone(inboundMessage?.from);
  const intent = getSmsKeywordIntent({
    body: inboundMessage?.body,
    optOutType: null,
  });

  if (!from || !intent) {
    logger.info('Ignoring non-compliance carrier messaging webhook', {
      hasFrom: Boolean(from),
      intent,
    });
    response.status(204).send('');
    return;
  }

  const usersSnapshot = await db
    .collection('users')
    .where('notificationPreference.phoneE164', '==', from)
    .get();
  const now = new Date().toISOString();

  for (const userDocument of usersSnapshot.docs) {
    await applySmsKeywordIntent({
      intent,
      now,
      profile: userDocument.data(),
      provider: retiredDeliveryProviderId,
      source: 'retiredDeliveryWebhook',
      uid: userDocument.id,
    });
  }

  logger.info('Processed notification provider carrier messaging keyword webhook', {
    matchedUsers: usersSnapshot.size,
    smsIntent: intent,
  });

  response.status(204).send('');
});

exports.retiredDeliveryStatusWebhook = onRequest(async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).send('Method not allowed');
    return;
  }

  if (!isValidnotification providerWebhook(request)) {
    response.status(403).send('Invalid notification provider signature');
    return;
  }

  const deliveryEvent = parsenotification providerDeliveryWebhook(request.body);

  if (!deliveryEvent?.messageId) {
    response.status(400).send('Missing notification provider message id');
    return;
  }

  const logsSnapshot = await db
    .collectionGroup('notifications')
    .where('providerMessageId', '==', deliveryEvent.messageId)
    .limit(10)
    .get();
  const status = String(deliveryEvent.providerStatus || 'unknown');
  const errorMessage = getnotification providerDeliveryError(request.body);
  const batch = db.batch();

  for (const logDocument of logsSnapshot.docs) {
    batch.set(
      logDocument.ref,
      {
        errorMessage,
        providerStatus: status,
        sentAtIso:
          status === 'delivered' || status === 'sent'
            ? new Date().toISOString()
            : logDocument.data().sentAtIso || null,
        status: mapnotification providerDeliveryStatus(status),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  await batch.commit();
  response.status(204).send('');
});

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

  const pushResult = await sendPushAndLog({
    body,
    garden,
    profile,
    title,
    type,
    uid,
  });

  if (shouldAttemptSmsFallback({ pushResult, type })) {
    await sendSmsAndLog({
      body,
      fallbackReason: pushResult.reason,
      garden,
      profile,
      title,
      type,
      uid,
    });
  }
}

async function applySmsKeywordIntent({
  intent,
  now,
  profile,
  provider,
  source,
  uid,
}) {
  const smsConsent =
    intent === 'stop'
      ? createSmsConsent('revoked', now)
      : intent === 'start'
        ? createSmsConsent('granted', now)
        : profile.notificationPreference?.channelConsent?.carrier messaging;
  const smsEnabled =
    intent === 'start'
      ? true
      : intent === 'stop'
        ? false
        : profile.notificationPreference?.channels?.carrier messaging === true;

  await db
    .collection('users')
    .doc(uid)
    .set(
      {
        notificationPreference: {
          ...profile.notificationPreference,
          channelConsent: {
            ...profile.notificationPreference?.channelConsent,
            carrier messaging: smsConsent,
          },
          channels: {
            ...profile.notificationPreference?.channels,
            carrier messaging: smsEnabled,
          },
          smsLastKeywordAtIso: now,
          smsLastKeywordType: intent,
        },
        updatedAtIso: now,
      },
      { merge: true },
    );

  await db
    .collection('users')
    .doc(uid)
    .collection('smsEvents')
    .doc(`carrier messaging-${intent}-${Date.now()}`)
    .set({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtIso: now,
      eventType: intent,
      provider,
      source,
      userId: uid,
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

async function sendSmsAndLog({
  body,
  fallbackReason = null,
  garden,
  profile,
  title,
  type,
  uid,
}) {
  const decision = shouldSendNotification({ channel: 'carrier messaging', profile, type });
  const phoneE164 = profile.notificationPreference?.phoneE164;
  const dryRun = isSmsDryRun();

  if (!decision.allowed) {
    await writeNotificationLog(
      createNotificationLog({
        body,
        channel: 'carrier messaging',
        decisionReason: decision.reason,
        dryRun,
        errorMessage: decision.reason,
        gardenId: garden.id || uid,
        provider: retiredDeliveryProviderId,
        recipientRedacted: redactPhone(phoneE164),
        status: 'skipped',
        title,
        type,
        userId: uid,
      }),
      uid,
    );
    return;
  }

  const rateLimitDecision = await getSmsRateLimitDecisionForUser(uid);

  if (!rateLimitDecision.allowed) {
    await writeNotificationLog(
      createNotificationLog({
        body,
        channel: 'carrier messaging',
        decisionReason: rateLimitDecision.reason,
        dryRun,
        errorMessage: rateLimitDecision.reason,
        gardenId: garden.id || uid,
        provider: retiredDeliveryProviderId,
        recipientRedacted: redactPhone(phoneE164),
        status: 'skipped',
        title,
        type,
        userId: uid,
      }),
      uid,
    );
    return;
  }

  if (dryRun) {
    await writeNotificationLog(
      createNotificationLog({
        body,
        channel: 'carrier messaging',
        decisionReason: 'dry-run mode',
        dryRun: true,
        gardenId: garden.id || uid,
        provider: retiredDeliveryProviderId,
        recipientRedacted: redactPhone(phoneE164),
        status: 'skipped',
        title,
        type,
        userId: uid,
      }),
      uid,
    );
    return;
  }

  try {
    const { attempts, message } = await sendnotification providerMessageWithRetry({
      body,
      to: phoneE164,
    });

    await writeNotificationLog(
      createNotificationLog({
        attemptCount: attempts,
        body,
        channel: 'carrier messaging',
        decisionReason: fallbackReason,
        dryRun: false,
        gardenId: garden.id || uid,
        provider: retiredDeliveryProviderId,
        providerMessageId: message.id,
        providerStatus: getnotification providerMessageStatus(message),
        recipientRedacted: redactPhone(phoneE164),
        retryPolicy: 'retry once on notification provider 429/5xx',
        status: 'sent',
        title,
        type,
        userId: uid,
      }),
      uid,
    );
  } catch (error) {
    await writeNotificationLog(
      createNotificationLog({
        attemptCount: 2,
        body,
        channel: 'carrier messaging',
        dryRun: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        gardenId: garden.id || uid,
        provider: retiredDeliveryProviderId,
        recipientRedacted: redactPhone(phoneE164),
        retryPolicy: 'retry once on notification provider 429/5xx',
        status: 'failed',
        title,
        type,
        userId: uid,
      }),
      uid,
    );
  }
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

async function getSmsRateLimitDecisionForUser(uid) {
  const snapshot = await db
    .collection('gardens')
    .doc(uid)
    .collection('notifications')
    .limit(100)
    .get();

  return getSmsRateLimitDecision(
    snapshot.docs.map((document) => document.data()),
  );
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

function shouldAttemptSmsFallback({ pushResult, type }) {
  return (
    isSmsFallbackNotificationType(type) &&
    pushResult &&
    pushResult.status !== 'sent'
  );
}

function mapnotification providerDeliveryStatus(status) {
  if (['delivered', 'delivery_unconfirmed', 'sent'].includes(status)) {
    return 'sent';
  }

  if (['delivery_failed', 'failed'].includes(status)) {
    return 'failed';
  }

  return 'queued';
}

function getnotification providerDeliveryError(payload) {
  const errors = payload?.data?.payload?.errors;

  if (!Array.isArray(errors) || errors.length === 0) {
    return null;
  }

  const firstError = errors[0];

  return firstError?.detail || firstError?.title || firstError?.code || null;
}

function redactEmail(value) {
  const [name = '', domain = ''] = String(value).split('@');
  return `${name.slice(0, 2)}***@${domain}`;
}
