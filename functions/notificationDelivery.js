'use strict';

const {
  MAX_DELIVERY_ATTEMPTS,
  claimDelivery,
  completeClaim,
  getDeliveryCollection,
  getDeliveryId,
  isReceiptDue,
} = require('./deliveryReceipts');
const {
  buildDataOnlyMessage,
  buildNativeMessage,
  buildWebMessage,
  deliverPush,
  loadActivePushTokens,
} = require('./pushDelivery');
const {
  supersedeGardenAlert,
  validateAlertFreshness,
} = require('./notificationFreshness');

function createNotificationDeliveryPipeline({ auth, db, logger, messaging }) {
  async function publishAndFanOutAlert(alert, options = {}) {
    const now = options.now || new Date();
    const storedAlert = await publishGardenAlert(db, alert, now);
    const freshness = await validateAlertFreshness({
      alert: storedAlert,
      db,
      now,
    });
    if (!freshness.fresh) {
      await supersedeGardenAlert(db, storedAlert, freshness.reason, now);
      return {
        alert: { ...storedAlert, status: 'superseded' },
        recipientCount: 0,
      };
    }
    const users = options.authorizedUsers || (await listAuthorizedUsers(auth));
    const tokenOwnership = await resolvePushTokenOwnership(db, users);
    await Promise.all(
      users.map((user) =>
        deliverAlertToAuthorizedUser({
          alert: storedAlert,
          authorizedUser: user,
          db,
          logger,
          messaging,
          now,
          tokenDocuments: tokenOwnership.get(user.uid) || [],
        }),
      ),
    );
    return { alert: storedAlert, recipientCount: users.length };
  }

  async function processPendingDeliveries(options = {}) {
    const now = options.now || new Date();
    const users = await listAuthorizedUsers(auth);
    const tokenOwnership = await resolvePushTokenOwnership(db, users);
    let processedCount = 0;

    for (const user of users) {
      const deliveriesSnapshot = await getDeliveryCollection(
        db,
        user.uid,
      ).get();
      const dueReceipts = deliveriesSnapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .filter((receipt) => isReceiptDue(receipt, now));

      for (const receipt of dueReceipts) {
        const alertSnapshot = await getAlertRef(db, receipt.alertId).get();
        if (!alertSnapshot.exists) {
          await getDeliveryCollection(db, user.uid).doc(receipt.id).set(
            {
              errorMessage: 'Shared garden alert no longer exists.',
              status: 'failed',
              updatedAtIso: now.toISOString(),
            },
            { merge: true },
          );
          continue;
        }

        await deliverAlertToAuthorizedUser({
          alert: { id: receipt.alertId, ...alertSnapshot.data() },
          authorizedUser: user,
          channels: [receipt.channel],
          db,
          logger,
          messaging,
          now,
          tokenDocuments: tokenOwnership.get(user.uid) || [],
        });
        processedCount += 1;
      }
    }
    return { processedCount, userCount: users.length };
  }

  return { processPendingDeliveries, publishAndFanOutAlert };
}

async function publishGardenAlert(db, alert, now = new Date()) {
  const alertRef = getAlertRef(db, alert.id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(alertRef);
    const current = snapshot.exists ? snapshot.data() : null;
    const payload = {
      ...alert,
      channel: 'inApp',
      createdAtIso: alert.createdAtIso || now.toISOString(),
      decisionReason: 'shared garden alert',
      provider: 'inApp',
      publishedAtIso: current?.publishedAtIso || now.toISOString(),
      recipientRedacted: 'authorized garden members',
      status: 'active',
      supersededAtIso: null,
      supersededReason: null,
      updatedAtIso: now.toISOString(),
      userId: 'shared',
    };
    transaction.set(alertRef, payload, { merge: snapshot.exists });
    return { id: alert.id, ...payload };
  });
}

async function deliverAlertToAuthorizedUser({
  alert,
  authorizedUser,
  channels = ['inApp', 'push'],
  db,
  logger,
  messaging,
  now = new Date(),
  tokenDocuments,
}) {
  if (!isAuthorizedUser(authorizedUser)) {
    return { skipped: 'notAuthorized' };
  }
  const profileSnapshot = await db
    .collection('users')
    .doc(authorizedUser.uid)
    .get();
  const profile = profileSnapshot.exists ? profileSnapshot.data() : null;
  const results = [];

  for (const channel of channels) {
    if (channel === 'inApp') {
      results.push(
        await recordInAppReceipt(db, authorizedUser.uid, alert, now),
      );
    } else if (channel === 'push') {
      results.push(
        await deliverPush({
          alert,
          db,
          logger,
          messaging,
          now,
          profile,
          tokenDocuments,
          uid: authorizedUser.uid,
        }),
      );
    }
  }
  return { results };
}

async function resolvePushTokenOwnership(db, users) {
  const ownership = new Map();
  const ownersByToken = new Map();
  const candidates = await Promise.all(
    users.map(async (user) => ({
      tokens: await loadActivePushTokens(db, user.uid),
      uid: user.uid,
    })),
  );

  for (const candidate of candidates) {
    for (const tokenDocument of candidate.tokens) {
      const ownershipKey = pushOwnershipKey(tokenDocument);
      const existing = ownersByToken.get(ownershipKey);
      if (existing && !isNewerOwner(candidate.uid, tokenDocument, existing)) {
        continue;
      }
      ownersByToken.set(ownershipKey, {
        tokenDocument,
        uid: candidate.uid,
      });
    }
  }
  for (const owner of ownersByToken.values()) {
    const entries = ownership.get(owner.uid) || [];
    entries.push(owner.tokenDocument);
    ownership.set(owner.uid, entries);
  }
  return ownership;
}

function pushOwnershipKey(tokenDocument) {
  return typeof tokenDocument.installationId === 'string' &&
    tokenDocument.installationId
    ? `installation:${tokenDocument.installationId}`
    : `token:${tokenDocument.token}`;
}

function isNewerOwner(uid, tokenDocument, existing) {
  const candidateTime = Date.parse(tokenDocument.lastSeenAtIso || '');
  const existingTime = Date.parse(existing.tokenDocument.lastSeenAtIso || '');
  const normalizedCandidate = Number.isFinite(candidateTime)
    ? candidateTime
    : 0;
  const normalizedExisting = Number.isFinite(existingTime) ? existingTime : 0;
  return (
    normalizedCandidate > normalizedExisting ||
    (normalizedCandidate === normalizedExisting && uid > existing.uid)
  );
}

async function recordInAppReceipt(db, uid, alert, now) {
  const claim = await claimDelivery({ alert, channel: 'inApp', db, now, uid });
  if (!claim.claimed) return claim;
  await completeClaim(
    db,
    uid,
    claim.receipt,
    { deliveredAtIso: now.toISOString(), status: 'sent' },
    now,
  );
  return { status: 'sent' };
}

async function listAuthorizedUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    users.push(...page.users.filter(isAuthorizedUser));
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

function isAuthorizedUser(user) {
  return (
    Boolean(user?.uid) &&
    user.disabled !== true &&
    user.customClaims?.gardenAccess === true &&
    user.customClaims?.secretFaeriesMember === true
  );
}

function getAlertRef(db, alertId) {
  return db
    .collection('gardenWorkspaces')
    .doc('main')
    .collection('alerts')
    .doc(alertId);
}

module.exports = {
  MAX_DELIVERY_ATTEMPTS,
  buildDataOnlyMessage,
  buildNativeMessage,
  buildWebMessage,
  createNotificationDeliveryPipeline,
  deliverAlertToAuthorizedUser,
  getDeliveryId,
  isAuthorizedUser,
  listAuthorizedUsers,
  publishGardenAlert,
  resolvePushTokenOwnership,
};
