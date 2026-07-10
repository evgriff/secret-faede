'use strict';

const { stableHash } = require('./notificationLogic');

const MAX_DELIVERY_ATTEMPTS = 3;
const DELIVERY_LEASE_MS = 5 * 60 * 1000;
const retryDelayMinutes = [5, 30, 120];

async function claimDelivery({ alert, channel, db, now, uid }) {
  const deliveryId = getDeliveryId(alert.id, channel);
  const ref = getDeliveryCollection(db, uid).doc(deliveryId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? snapshot.data() : null;
    const dueAtMs = Date.parse(
      current?.deliverAfterIso || current?.nextAttemptAtIso || '',
    );
    const leaseUntilMs = Date.parse(current?.leaseUntilIso || '');

    if (['sent', 'skipped', 'failed'].includes(current?.status)) {
      return { claimed: false, reason: 'terminal', status: current.status };
    }
    if (current?.status === 'pending' && leaseUntilMs > now.getTime()) {
      return { claimed: false, reason: 'leased', status: 'pending' };
    }
    if (
      ['deferred', 'retrying'].includes(current?.status) &&
      Number.isFinite(dueAtMs) &&
      dueAtMs > now.getTime()
    ) {
      return { claimed: false, reason: 'notDue', status: current.status };
    }

    const attemptCount = Number(current?.attemptCount || 0) + 1;
    if (attemptCount > MAX_DELIVERY_ATTEMPTS) {
      transaction.set(
        ref,
        {
          errorMessage: 'Delivery retry limit reached.',
          leaseUntilIso: null,
          status: 'failed',
          updatedAtIso: now.toISOString(),
        },
        { merge: true },
      );
      return { claimed: false, reason: 'retryLimit', status: 'failed' };
    }

    const attemptId = `${now.getTime()}-${stableHash(`${uid}:${alert.id}:${channel}:${attemptCount}`)}`;
    const receipt = {
      alertId: alert.id,
      amountInches: alert.amountInches ?? null,
      attemptCount,
      attemptId,
      body: alert.body,
      channel,
      createdAtIso: current?.createdAtIso || now.toISOString(),
      deepLink: alert.deepLink,
      decisionReason: 'allowed',
      deliverAfterIso: null,
      id: deliveryId,
      leaseUntilIso: new Date(now.getTime() + DELIVERY_LEASE_MS).toISOString(),
      nextAttemptAtIso: null,
      status: 'pending',
      title: alert.title,
      type: alert.type,
      updatedAtIso: now.toISOString(),
      userId: uid,
    };
    transaction.set(ref, receipt, { merge: true });
    return { claimed: true, receipt };
  });
}

async function recordDecision({
  alert,
  channel,
  db,
  deliverAfterIso = null,
  now,
  reason,
  status,
  uid,
}) {
  const deliveryId = getDeliveryId(alert.id, channel);
  const ref = getDeliveryCollection(db, uid).doc(deliveryId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? snapshot.data() : null;
    if (['sent', 'skipped', 'failed'].includes(current?.status)) {
      return { reason: 'terminal', status: current.status };
    }
    if (
      current?.status === 'deferred' &&
      Date.parse(current.deliverAfterIso || '') > now.getTime()
    ) {
      return { reason: 'notDue', status: 'deferred' };
    }

    transaction.set(
      ref,
      {
        alertId: alert.id,
        amountInches: alert.amountInches ?? null,
        attemptCount: Number(current?.attemptCount || 0),
        body: alert.body,
        channel,
        createdAtIso: current?.createdAtIso || now.toISOString(),
        decisionReason: reason,
        deepLink: alert.deepLink,
        deliverAfterIso,
        id: deliveryId,
        leaseUntilIso: null,
        nextAttemptAtIso: null,
        status,
        title: alert.title,
        type: alert.type,
        updatedAtIso: now.toISOString(),
        userId: uid,
      },
      { merge: true },
    );
    return { reason, status };
  });
}

async function recordTerminalSkip({ alert, channel, db, now, reason, uid }) {
  const deliveryId = getDeliveryId(alert.id, channel);
  const ref = getDeliveryCollection(db, uid).doc(deliveryId);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? snapshot.data() : null;
    if (['sent', 'skipped', 'failed'].includes(current?.status)) {
      return { reason: 'terminal', status: current.status };
    }
    transaction.set(
      ref,
      {
        alertId: alert.id,
        amountInches: alert.amountInches ?? null,
        attemptCount: Number(current?.attemptCount || 0),
        body: alert.body,
        channel,
        createdAtIso: current?.createdAtIso || now.toISOString(),
        decisionReason: reason,
        deepLink: alert.deepLink,
        deliverAfterIso: null,
        errorMessage: null,
        id: deliveryId,
        leaseUntilIso: null,
        nextAttemptAtIso: null,
        status: 'skipped',
        title: alert.title,
        type: alert.type,
        updatedAtIso: now.toISOString(),
        userId: uid,
      },
      { merge: true },
    );
    return { reason, status: 'skipped' };
  });
}

async function reopenThresholdDecision({ alert, db, now, uid }) {
  if (alert.type !== 'watering') return false;
  const ref = getDeliveryCollection(db, uid).doc(
    getDeliveryId(alert.id, 'push'),
  );
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return false;
    const current = snapshot.data();
    if (
      current.status !== 'skipped' ||
      current.decisionReason !== 'below user watering threshold' ||
      Number(current.amountInches) === Number(alert.amountInches)
    ) {
      return false;
    }
    transaction.set(
      ref,
      {
        amountInches: alert.amountInches ?? null,
        decisionReason: 'watering amount updated',
        deliverAfterIso: null,
        errorMessage: null,
        leaseUntilIso: null,
        nextAttemptAtIso: now.toISOString(),
        status: 'retrying',
        updatedAtIso: now.toISOString(),
      },
      { merge: true },
    );
    return true;
  });
}

async function completeClaim(db, uid, receipt, update, now = new Date()) {
  const ref = getDeliveryCollection(db, uid).doc(receipt.id);
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.exists ? snapshot.data() : null;
    if (current?.attemptId !== receipt.attemptId) return false;
    transaction.set(
      ref,
      {
        ...update,
        leaseUntilIso: null,
        updatedAtIso: now.toISOString(),
      },
      { merge: true },
    );
    return true;
  });
}

async function scheduleRetry({ db, errorMessage, now, receipt, uid }) {
  if (receipt.attemptCount >= MAX_DELIVERY_ATTEMPTS) {
    await completeClaim(
      db,
      uid,
      receipt,
      { errorMessage, status: 'failed' },
      now,
    );
    return { status: 'failed' };
  }
  const nextAttemptAtIso = new Date(
    now.getTime() + retryDelayMinutes[receipt.attemptCount - 1] * 60_000,
  ).toISOString();
  await completeClaim(
    db,
    uid,
    receipt,
    { errorMessage, nextAttemptAtIso, status: 'retrying' },
    now,
  );
  return { nextAttemptAtIso, status: 'retrying' };
}

function isReceiptDue(receipt, now) {
  if (!['deferred', 'retrying'].includes(receipt.status)) return false;
  const dueAtMs = Date.parse(
    receipt.deliverAfterIso || receipt.nextAttemptAtIso || '',
  );
  return Number.isFinite(dueAtMs) && dueAtMs <= now.getTime();
}

function getDeliveryCollection(db, uid) {
  return db.collection('users').doc(uid).collection('notificationDeliveries');
}

function getDeliveryId(alertId, channel) {
  return `${channel}-${stableHash(alertId)}`;
}

module.exports = {
  MAX_DELIVERY_ATTEMPTS,
  claimDelivery,
  completeClaim,
  getDeliveryCollection,
  getDeliveryId,
  isReceiptDue,
  recordDecision,
  recordTerminalSkip,
  reopenThresholdDecision,
  scheduleRetry,
};
