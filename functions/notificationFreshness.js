'use strict';

const WATERING_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const WEATHER_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1000;

async function validateAlertFreshness({ alert, db, now = new Date() }) {
  if (!alert || alert.status !== 'active') {
    return stale('alertInactive');
  }
  if (!alert.workspaceRevisionId) {
    return stale('workspaceRevisionMissing');
  }

  const workspace = workspaceRef(db);
  const workspaceSnapshot = await workspace.get();
  const metadata = workspaceSnapshot.exists ? workspaceSnapshot.data() : null;
  if (metadata?.publishedRevisionId !== alert.workspaceRevisionId) {
    return stale('publishedRevisionChanged');
  }

  if (alert.type === 'watering') {
    return validateWateringAlert({ alert, db, now, workspace });
  }
  if (alert.type === 'taskDue') {
    return validateTaskAlert({ alert, workspace });
  }
  if (['frost', 'heatStress', 'severeWeather'].includes(alert.type)) {
    return validateWeatherAlert({ alert, now, workspace });
  }
  return stale('unsupportedAlertType');
}

async function validateWateringAlert({ alert, db, now, workspace }) {
  if (!alert.targetId || !alert.recommendationId) {
    return stale('wateringIdentityMissing');
  }
  const recommendationSnapshot = await workspace
    .collection('wateringRecommendations')
    .doc(alert.targetId)
    .get();
  if (!recommendationSnapshot.exists) {
    return stale('recommendationMissing');
  }
  const recommendation = recommendationSnapshot.data();
  const calculatedAtMs = Date.parse(recommendation.calculatedAtIso || '');
  if (
    recommendation.id !== alert.recommendationId ||
    recommendation.target?.cropGroupId !== alert.targetId
  ) {
    return stale('recommendationSuperseded');
  }
  if (recommendation.workspaceRevisionId !== alert.workspaceRevisionId) {
    return stale('recommendationRevisionChanged');
  }
  if (
    recommendation.status !== 'due' ||
    recommendation.actionable !== true ||
    !positiveFinite(recommendation.recommendedDepthInches)
  ) {
    return stale('recommendationNoLongerDue');
  }
  if (
    !Number.isFinite(calculatedAtMs) ||
    calculatedAtMs > now.getTime() + FUTURE_CLOCK_SKEW_MS ||
    now.getTime() - calculatedAtMs > WATERING_MAX_AGE_MS
  ) {
    return stale('recommendationExpired');
  }
  if (
    !positiveFinite(alert.amountInches) ||
    Math.abs(
      Number(alert.amountInches) -
        Number(recommendation.recommendedDepthInches),
    ) > 0.0005
  ) {
    return stale('recommendationAmountChanged');
  }

  const applicationsSnapshot = await workspace
    .collection('waterApplications')
    .get();
  const actedAfterRecommendation = applicationsSnapshot.docs.some(
    (document) => {
      const application = document.data();
      if (application.cropGroupId !== alert.targetId) return false;
      const recordedAtMs = Date.parse(application.recordedAtIso || '');
      return Number.isFinite(recordedAtMs) && recordedAtMs >= calculatedAtMs;
    },
  );
  if (actedAfterRecommendation) {
    return stale('wateringAlreadyRecorded');
  }

  return { fresh: true, reason: 'currentRecommendation' };
}

async function validateTaskAlert({ alert, workspace }) {
  if (!alert.taskId || !alert.dueOn) return stale('taskIdentityMissing');
  const taskSnapshot = await workspace
    .collection('tasks')
    .doc(alert.taskId)
    .get();
  if (!taskSnapshot.exists) return stale('taskMissing');
  const task = taskSnapshot.data();
  if (task.status !== 'open') return stale('taskNoLongerOpen');
  if (task.dueOn !== alert.dueOn) return stale('taskDueDateChanged');
  return { fresh: true, reason: 'currentTask' };
}

async function validateWeatherAlert({ alert, now, workspace }) {
  if (!alert.snapshotId) return stale('weatherSnapshotMissing');
  const snapshot = await workspace
    .collection('weatherSnapshots')
    .doc(alert.snapshotId)
    .get();
  if (!snapshot.exists) return stale('weatherSnapshotMissing');
  const capturedAtMs = Date.parse(snapshot.data().capturedAtIso || '');
  if (
    !Number.isFinite(capturedAtMs) ||
    capturedAtMs > now.getTime() + FUTURE_CLOCK_SKEW_MS ||
    now.getTime() - capturedAtMs > WEATHER_MAX_AGE_MS
  ) {
    return stale('weatherSnapshotExpired');
  }
  return { fresh: true, reason: 'currentWeatherSnapshot' };
}

async function supersedeGardenAlert(db, alert, reason, now = new Date()) {
  await workspaceRef(db).collection('alerts').doc(alert.id).set(
    {
      status: 'superseded',
      supersededAtIso: now.toISOString(),
      supersededReason: reason,
      updatedAtIso: now.toISOString(),
    },
    { merge: true },
  );
}

function workspaceRef(db) {
  return db.collection('gardenWorkspaces').doc('main');
}

function positiveFinite(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function stale(reason) {
  return { fresh: false, reason };
}

module.exports = {
  supersedeGardenAlert,
  validateAlertFreshness,
};
