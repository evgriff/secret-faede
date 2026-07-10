'use strict';

const { shouldSendNotification } = require('./notificationEligibility');
const { validateNotificationProfile } = require('./operationValidation');
const {
  claimDelivery,
  completeClaim,
  recordDecision,
  recordTerminalSkip,
  reopenThresholdDecision,
  scheduleRetry,
} = require('./deliveryReceipts');
const {
  supersedeGardenAlert,
  validateAlertFreshness,
} = require('./notificationFreshness');

async function deliverPush({
  alert,
  db,
  logger,
  messaging,
  now,
  profile,
  tokenDocuments: providedTokenDocuments,
  uid,
}) {
  const freshness = await validateAlertFreshness({ alert, db, now });
  if (!freshness.fresh) {
    await supersedeGardenAlert(db, alert, freshness.reason, now);
    return recordTerminalSkip({
      alert,
      channel: 'push',
      db,
      now,
      reason: `superseded: ${freshness.reason}`,
      uid,
    });
  }
  if (!profile) {
    return skip(alert, db, now, uid, 'notification profile missing');
  }
  const validation = validateNotificationProfile(profile);
  if (!validation.valid) {
    return skip(alert, db, now, uid, validation.errors.join(', '));
  }

  await reopenThresholdDecision({ alert, db, now, uid });

  if (
    alert.type === 'watering' &&
    Number(alert.amountInches || 0) <
      validation.preference.wateringAlertThresholdIn
  ) {
    return skip(alert, db, now, uid, 'below user watering threshold');
  }

  const decision = shouldSendNotification({
    channel: 'push',
    now,
    profile: { ...profile, notificationPreference: validation.preference },
    type: alert.type,
  });
  if (!decision.allowed) {
    return recordDecision({
      alert,
      channel: 'push',
      db,
      deliverAfterIso: decision.deferUntilIso || null,
      now,
      reason: decision.reason,
      status: decision.deferUntilIso ? 'deferred' : 'skipped',
      uid,
    });
  }

  const claim = await claimDelivery({ alert, channel: 'push', db, now, uid });
  if (!claim.claimed) return claim;
  const tokenDocuments = providedTokenDocuments
    ? dedupeTokens(providedTokenDocuments)
    : await loadActivePushTokens(db, uid);

  if (tokenDocuments.length === 0) {
    await completeClaim(
      db,
      uid,
      claim.receipt,
      {
        errorMessage: 'No web or native push tokens registered.',
        status: 'skipped',
      },
      now,
    );
    return { status: 'skipped' };
  }

  try {
    const response = await messaging.sendEach(
      tokenDocuments
        .slice(0, 500)
        .map((entry) =>
          isNativePlatform(entry.platform)
            ? buildNativeMessage(alert, entry.token, entry.platform)
            : buildWebMessage(alert, entry.token),
        ),
    );
    return handleProviderResponse({
      alert,
      claim,
      db,
      now,
      response,
      tokenDocuments,
      uid,
    });
  } catch (error) {
    logger?.warn?.('Push delivery failed; retry policy applied.', {
      alertId: alert.id,
      error: error instanceof Error ? error.message : String(error),
      uid,
    });
    return scheduleRetry({
      db,
      errorMessage: error instanceof Error ? error.message : String(error),
      now,
      receipt: claim.receipt,
      uid,
    });
  }
}

async function handleProviderResponse({
  claim,
  db,
  now,
  response,
  tokenDocuments,
  uid,
}) {
  const invalidDeletes = [];
  let transientFailureCount = 0;
  let permanentFailureCount = 0;

  response.responses.forEach((sendResponse, index) => {
    const code = sendResponse.error?.code || '';
    if (isInvalidFcmTokenCode(code)) {
      invalidDeletes.push(tokenDocuments[index].ref.delete());
    } else if (!sendResponse.success && isTransientFcmCode(code)) {
      transientFailureCount += 1;
    } else if (!sendResponse.success) {
      permanentFailureCount += 1;
    }
  });
  await Promise.all(invalidDeletes);

  if (response.successCount > 0) {
    await completeClaim(
      db,
      uid,
      claim.receipt,
      {
        deliveredAtIso: now.toISOString(),
        errorMessage:
          response.failureCount > 0
            ? `${response.failureCount} token deliveries failed; ${invalidDeletes.length} invalid tokens removed.`
            : null,
        invalidTokenCount: invalidDeletes.length,
        status: 'sent',
        successCount: response.successCount,
      },
      now,
    );
    return { status: 'sent', successCount: response.successCount };
  }
  if (transientFailureCount > 0) {
    return scheduleRetry({
      db,
      errorMessage: `${transientFailureCount} transient push failures.`,
      now,
      receipt: claim.receipt,
      uid,
    });
  }

  await completeClaim(
    db,
    uid,
    claim.receipt,
    {
      errorMessage: `${permanentFailureCount} permanent push failures; ${invalidDeletes.length} invalid tokens removed.`,
      invalidTokenCount: invalidDeletes.length,
      status: 'failed',
    },
    now,
  );
  return { status: 'failed' };
}

function skip(alert, db, now, uid, reason) {
  return recordDecision({
    alert,
    channel: 'push',
    db,
    now,
    reason,
    status: 'skipped',
    uid,
  });
}

function buildDataOnlyMessage(alert, tokens) {
  return {
    data: messageData(alert),
    tokens: tokens.slice(0, 500),
    webpush: {
      fcmOptions: { link: alert.deepLink },
      headers: { Urgency: alert.severity === 'warning' ? 'high' : 'normal' },
    },
  };
}

function buildWebMessage(alert, token) {
  const { tokens, ...message } = buildDataOnlyMessage(alert, [token]);
  return { ...message, token: tokens[0] };
}

function buildNativeMessage(alert, token, platform) {
  const message = {
    data: messageData(alert),
    notification: { body: alert.body, title: alert.title },
    token,
  };
  if (String(platform).endsWith('android')) {
    message.android = {
      collapseKey: alert.id,
      notification: { tag: alert.id },
      priority: 'high',
    };
  }
  if (String(platform).endsWith('ios')) {
    message.apns = {
      headers: {
        'apns-collapse-id': alert.id,
        'apns-priority': '10',
      },
      payload: { aps: { sound: 'default' } },
    };
  }
  return message;
}

async function loadActivePushTokens(db, uid) {
  const tokenSnapshot = await db
    .collection('users')
    .doc(uid)
    .collection('pushTokens')
    .get();
  return dedupeTokens(
    tokenSnapshot.docs.map((document) => ({
      installationId: document.data().installationId,
      lastSeenAtIso: document.data().lastSeenAtIso,
      platform: document.data().platform,
      ref: document.ref,
      status: document.data().status,
      token: document.data().token,
    })),
  );
}

function dedupeTokens(entries) {
  return [
    ...new Map(
      entries
        .filter(
          (entry) =>
            entry.status !== 'retired' &&
            typeof entry.token === 'string' &&
            entry.token,
        )
        .map((entry) => [entry.token, entry]),
    ).values(),
  ];
}

function messageData(alert) {
  return {
    alertId: alert.id,
    body: alert.body,
    link: alert.deepLink,
    title: alert.title,
    type: alert.type,
  };
}

function isNativePlatform(platform) {
  return ['android', 'ios', 'native-android', 'native-ios'].includes(platform);
}

function isInvalidFcmTokenCode(code) {
  return [
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
  ].includes(code);
}

function isTransientFcmCode(code) {
  return [
    'messaging/internal-error',
    'messaging/server-unavailable',
    'messaging/unknown-error',
    'messaging/quota-exceeded',
  ].includes(code);
}

module.exports = {
  buildDataOnlyMessage,
  buildNativeMessage,
  buildWebMessage,
  dedupeTokens,
  deliverPush,
  isNativePlatform,
  loadActivePushTokens,
};
