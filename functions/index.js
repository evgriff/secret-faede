'use strict';

const admin = require('firebase-admin');
const { logger } = require('firebase-functions');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const twilio = require('twilio');
const {
  buildFrostNotification,
  buildHeatNotification,
  buildSevereWeatherNotification,
  buildWateringNotification,
  createNotificationLog,
  redactPhone,
  shouldSendNotification,
} = require('./notificationLogic');

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

exports.dailyWateringCheck = onSchedule(
  {
    schedule: '0 7 * * *',
    timeZone: 'America/Detroit',
  },
  async () => {
    const usersSnapshot = await db.collection('users').get();

    for (const userDocument of usersSnapshot.docs) {
      await runWateringCheckForUser(userDocument.id, userDocument.data());
    }
  },
);

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
  const title = 'Secret Faede test alert';
  const body =
    'Tomatoes in Bed A are short 0.6 in of water. Rain is unlikely today.';

  await sendSmsAndLog({
    body,
    garden,
    profile,
    title,
    type: 'watering',
    uid,
  });

  return { ok: true };
});

async function runWateringCheckForUser(uid, profile) {
  const gardenSnapshot = await db.collection('gardens').doc(uid).get();

  if (!gardenSnapshot.exists) {
    return;
  }

  const garden = gardenSnapshot.data();
  const latestSnapshot = getLatestSnapshot(garden);
  const recommendations = (garden.waterRecommendations || []).filter(
    (recommendation) =>
      recommendation.status === 'active' &&
      Number(
        recommendation.deficitInches || recommendation.inchesNeeded || 0,
      ) >=
        Number(
          profile.notificationPreference?.wateringAlertThresholdIn ?? 0.25,
        ),
  );

  for (const recommendation of recommendations.slice(0, 5)) {
    const notification = buildWateringNotification(
      recommendation,
      latestSnapshot,
    );

    await dispatchNotification({
      body: notification.body,
      garden,
      profile,
      title: notification.title,
      type: notification.type,
      uid,
    });
  }
}

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

  await sendPushAndLog({ body, garden, profile, title, type, uid });
  await sendSmsAndLog({ body, garden, profile, title, type, uid });
  await writeEmailPlaceholder({ body, garden, profile, title, type, uid });
}

async function sendPushAndLog({ body, garden, profile, title, type, uid }) {
  const decision = shouldSendNotification({ channel: 'push', profile, type });

  if (!decision.allowed) {
    await writeNotificationLog(
      createNotificationLog({
        body,
        channel: 'push',
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
    return;
  }

  const tokensSnapshot = await db
    .collection('users')
    .doc(uid)
    .collection('pushTokens')
    .get();
  const tokens = tokensSnapshot.docs
    .map((document) => document.data().token)
    .filter(Boolean);

  if (tokens.length === 0) {
    await writeNotificationLog(
      createNotificationLog({
        body,
        channel: 'push',
        errorMessage: 'No web push tokens registered',
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
    return;
  }

  const response = await messaging.sendEachForMulticast({
    data: { body, title, type },
    notification: { body, title },
    tokens: tokens.slice(0, 500),
    webpush: {
      fcmOptions: {
        link: '/app/garden',
      },
    },
  });

  await writeNotificationLog(
    createNotificationLog({
      body,
      channel: 'push',
      errorMessage:
        response.failureCount > 0
          ? `${response.failureCount} push sends failed`
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
}

async function sendSmsAndLog({ body, garden, profile, title, type, uid }) {
  const decision = shouldSendNotification({ channel: 'carrier messaging', profile, type });
  const phoneE164 = profile.notificationPreference?.phoneE164;
  const dryRun = isSmsDryRun();

  if (!decision.allowed) {
    await writeNotificationLog(
      createNotificationLog({
        body,
        channel: 'carrier messaging',
        dryRun,
        errorMessage: decision.reason,
        gardenId: garden.id || uid,
        provider: 'twilio',
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
        dryRun: true,
        gardenId: garden.id || uid,
        provider: 'twilio',
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
    const message = await getTwilioClient().messages.create({
      body,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
      to: phoneE164,
    });

    await writeNotificationLog(
      createNotificationLog({
        body,
        channel: 'carrier messaging',
        dryRun: false,
        gardenId: garden.id || uid,
        provider: 'twilio',
        recipientRedacted: redactPhone(phoneE164),
        status: 'sent',
        title,
        type,
        userId: uid,
      }),
      uid,
      { providerMessageId: message.sid },
    );
  } catch (error) {
    await writeNotificationLog(
      createNotificationLog({
        body,
        channel: 'carrier messaging',
        dryRun: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        gardenId: garden.id || uid,
        provider: 'twilio',
        recipientRedacted: redactPhone(phoneE164),
        status: 'failed',
        title,
        type,
        userId: uid,
      }),
      uid,
    );
  }
}

async function writeEmailPlaceholder({
  body,
  garden,
  profile,
  title,
  type,
  uid,
}) {
  const decision = shouldSendNotification({ channel: 'email', profile, type });

  if (!profile.notificationPreference?.channels?.email && !decision.allowed) {
    return;
  }

  await writeNotificationLog(
    createNotificationLog({
      body,
      channel: 'email',
      errorMessage: 'Email delivery is a placeholder.',
      gardenId: garden.id || uid,
      provider: null,
      recipientRedacted: profile.email ? redactEmail(profile.email) : 'email',
      status: 'skipped',
      title,
      type,
      userId: uid,
    }),
    uid,
  );
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
    .limit(50)
    .get();
  const cutoffMs = Date.now() - 12 * 60 * 60 * 1000;

  return snapshot.docs.some((document) => {
    const log = document.data();
    const createdAt = Date.parse(log.createdAtIso || '');

    return (
      log.channel === channel &&
      log.type === type &&
      log.body === body &&
      Number.isFinite(createdAt) &&
      createdAt >= cutoffMs
    );
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

function getTwilioClient() {
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_MESSAGING_SERVICE_SID,
  } = process.env;

  if (
    !TWILIO_ACCOUNT_SID ||
    !TWILIO_AUTH_TOKEN ||
    !TWILIO_MESSAGING_SERVICE_SID
  ) {
    throw new Error('Twilio credentials are not configured.');
  }

  return twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
}

function isSmsDryRun() {
  return (
    process.env.NOTIFICATION_DRY_RUN !== 'false' ||
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_MESSAGING_SERVICE_SID
  );
}

function redactEmail(value) {
  const [name = '', domain = ''] = String(value).split('@');
  return `${name.slice(0, 2)}***@${domain}`;
}
