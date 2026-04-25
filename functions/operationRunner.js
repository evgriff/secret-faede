'use strict';

const { generateGardenOperations } = require('./gardenOperations');
const {
  formatLocalDate,
  getGardenTimezone,
  isUserDueForWateringCheck,
} = require('./operationTime');
const {
  buildWateringDedupeKey,
  buildWateringNotification,
} = require('./notificationLogic');
const { createBackendWeatherProvider } = require('./weatherProviders');

function createOperationRunner({ admin, db, dispatchNotification, logger }) {
  return async function runGardenOperationsForUser(uid, profile, options = {}) {
    const now = options.now ?? new Date();
    const gardenState = await loadGardenAggregate(db, uid);

    if (!gardenState) {
      return { generated: false, skipped: 'noGarden' };
    }

    if (!options.force && !isUserDueForWateringCheck(profile, now)) {
      return { generated: false, skipped: 'notDue' };
    }

    if (!options.force && wasGeneratedForLocalDate(gardenState, profile, now)) {
      return { generated: false, skipped: 'alreadyGenerated' };
    }

    const weatherProvider =
      options.weatherProvider ?? createBackendWeatherProvider(logger);
    const result = await generateGardenOperations({
      garden: gardenState.garden,
      logger,
      now,
      profile,
      weatherProvider,
    });
    const updatedGarden = {
      ...gardenState.garden,
      tasks: result.tasks,
      updatedAtIso: result.generatedAtIso,
      wateringSchedule: result.wateringSchedule,
      weatherSnapshots: result.weatherSnapshots,
    };

    await commitGardenOperations({
      admin,
      db,
      gardenState,
      profile,
      result,
      uid,
      updatedGarden,
      now,
    });
    logger.info('analytics event', {
      eventName: 'watering_schedule_generated',
      providerId: result.providerId,
      recommendationCount: result.recommendations.length,
      uid,
    });
    await dispatchWateringRecommendations({
      dispatchNotification,
      garden: updatedGarden,
      logger,
      now,
      profile,
      schedule: result.wateringSchedule,
      snapshot: result.snapshot,
      uid,
    });

    return {
      generated: true,
      generatedAtIso: result.generatedAtIso,
      providerId: result.providerId,
      recommendationCount: result.recommendations.length,
      taskCount: result.tasks.length,
    };
  };
}

async function loadGardenAggregate(db, uid) {
  const draftRef = getDraftRef(db, uid);
  const workspaceRef = getWorkspaceRef(db);
  const draftSnapshot = await draftRef.get();
  const draftData = draftSnapshot.exists ? draftSnapshot.data() : null;

  if (isRecord(draftData?.garden)) {
    return {
      baseRevisionId:
        typeof draftData.baseRevisionId === 'string'
          ? draftData.baseRevisionId
          : 'revision-initial',
      draftExists: true,
      garden: normalizeGardenForUser(draftData.garden, uid),
      operationsLastGeneratedLocalDate:
        typeof draftData.operationsLastGeneratedLocalDate === 'string'
          ? draftData.operationsLastGeneratedLocalDate
          : null,
      source: 'draft',
      suggestionDecisions: Array.isArray(draftData.suggestionDecisions)
        ? draftData.suggestionDecisions
        : [],
    };
  }

  const workspaceSnapshot = await workspaceRef.get();
  const workspaceData = workspaceSnapshot.exists
    ? workspaceSnapshot.data()
    : null;

  if (isRecord(workspaceData?.garden)) {
    return {
      baseRevisionId:
        typeof workspaceData.id === 'string'
          ? workspaceData.id
          : 'revision-initial',
      draftExists: false,
      garden: normalizeGardenForUser(workspaceData.garden, uid),
      operationsLastGeneratedLocalDate: null,
      source: 'published',
      suggestionDecisions: [],
    };
  }

  return loadLegacyGardenAggregate(db, uid);
}

async function loadLegacyGardenAggregate(db, uid) {
  const gardenRef = db.collection('gardens').doc(uid);
  const [
    gardenSnapshot,
    harvestEvents,
    journalEntries,
    notificationLogs,
    plantings,
    structures,
    tasks,
  ] = await Promise.all([
    gardenRef.get(),
    readNestedCollection(gardenRef, 'harvests'),
    readNestedCollection(gardenRef, 'journal'),
    readNestedCollection(gardenRef, 'notifications'),
    readNestedCollection(gardenRef, 'plantings'),
    readNestedCollection(gardenRef, 'structures'),
    readNestedCollection(gardenRef, 'tasks'),
  ]);

  if (!gardenSnapshot.exists) {
    return null;
  }

  const gardenData = gardenSnapshot.data();

  return {
    baseRevisionId: 'revision-initial',
    draftExists: false,
    garden: normalizeGardenForUser(
      {
        ...gardenData,
        harvestEvents,
        journalEntries,
        notificationLogs,
        plantings,
        structures,
        tasks,
      },
      uid,
    ),
    operationsLastGeneratedLocalDate:
      typeof gardenData.operationsLastGeneratedLocalDate === 'string'
        ? gardenData.operationsLastGeneratedLocalDate
        : null,
    source: 'legacy',
    suggestionDecisions: [],
  };
}

async function readNestedCollection(gardenRef, collectionName) {
  const snapshot = await gardenRef.collection(collectionName).get();

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

function normalizeGardenForUser(garden, uid) {
  const record = isRecord(garden) ? garden : {};
  const legacySchedule = Array.isArray(record.waterRecommendations)
    ? record.waterRecommendations
    : [];
  const wateringSchedule = Array.isArray(record.wateringSchedule)
    ? record.wateringSchedule
    : legacySchedule;

  return {
    ...record,
    harvestEvents: withGardenId(record.harvestEvents, uid),
    id: uid,
    journalEntries: withGardenId(record.journalEntries, uid),
    notificationLogs: asArray(record.notificationLogs).map((log) => ({
      ...log,
      gardenId: log?.gardenId ? uid : null,
      userId: uid,
    })),
    plantings: asArray(record.plantings),
    structures: asArray(record.structures),
    sunShadeLayers: withGardenId(record.sunShadeLayers, uid),
    tasks: withGardenId(record.tasks, uid),
    updatedAtIso:
      typeof record.updatedAtIso === 'string' ? record.updatedAtIso : null,
    userId: uid,
    wateringSchedule: withGardenId(wateringSchedule, uid),
    weatherSnapshots: withGardenId(record.weatherSnapshots, uid),
  };
}

function withGardenId(items, uid) {
  return asArray(items).map((item) => ({
    ...item,
    gardenId: uid,
  }));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function commitGardenOperations({
  admin,
  db,
  gardenState,
  profile,
  result,
  uid,
  updatedGarden,
  now,
}) {
  const draftRef = getDraftRef(db, uid);
  const timezone =
    profile.notificationPreference?.timezone ||
    getGardenTimezone(updatedGarden) ||
    'America/Detroit';
  const operationsMetadata = {
    operationsLastGeneratedAtIso: result.generatedAtIso,
    operationsLastGeneratedLocalDate: formatLocalDate(now, timezone),
    operationsLastProviderId: result.providerId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAtIso: result.generatedAtIso,
    userId: uid,
  };

  if (gardenState.draftExists) {
    await draftRef.set(
      {
        ...operationsMetadata,
        garden: {
          tasks: updatedGarden.tasks,
          updatedAtIso: updatedGarden.updatedAtIso,
          wateringSchedule: updatedGarden.wateringSchedule,
          weatherSnapshots: updatedGarden.weatherSnapshots,
        },
      },
      { merge: true },
    );
  } else {
    await draftRef.set({
      ...operationsMetadata,
      baseRevisionId: gardenState.baseRevisionId || 'revision-initial',
      garden: updatedGarden,
      suggestionDecisions: gardenState.suggestionDecisions,
    });
  }

  gardenState.draftExists = true;
  gardenState.garden = updatedGarden;
  gardenState.operationsLastGeneratedLocalDate =
    operationsMetadata.operationsLastGeneratedLocalDate;
  gardenState.source = 'draft';
}

async function dispatchWateringRecommendations({
  dispatchNotification,
  garden,
  logger,
  now,
  profile,
  schedule,
  snapshot,
  uid,
}) {
  const threshold = Number(
    profile.notificationPreference?.wateringAlertThresholdIn ?? 0.25,
  );
  const activeRecommendations = schedule
    .filter((recommendation) =>
      isAlertableWateringEntry(recommendation, now, threshold),
    )
    .sort(
      (left, right) =>
        urgencyRank(right.urgency) - urgencyRank(left.urgency) ||
        Number(right.targetAmountInches || 0) -
          Number(left.targetAmountInches || 0),
    )
    .slice(0, 5);

  for (const recommendation of activeRecommendations) {
    const notification = buildWateringNotification(recommendation, snapshot);

    await dispatchNotification({
      body: notification.body,
      dedupeKey: buildWateringDedupeKey(recommendation),
      garden,
      profile,
      title: notification.title,
      type: notification.type,
      uid,
    });
    logger.info('analytics event', {
      eventName: 'water_alert_sent',
      recommendationId: recommendation.id,
      targetType: recommendation.targetKind,
      uid,
    });
  }
}

function isAlertableWateringEntry(recommendation, now, threshold) {
  if (!['due', 'partial'].includes(recommendation.status)) {
    return false;
  }

  const targetAmount = Number(
    recommendation.targetAmountInches || recommendation.deficitInches || 0,
  );

  if (targetAmount < threshold) {
    return false;
  }

  const dueWindowStartMs = Date.parse(recommendation.dueWindowStartIso || '');

  if (Number.isFinite(dueWindowStartMs) && dueWindowStartMs > now.getTime()) {
    return false;
  }

  const dueWindowEndMs = Date.parse(recommendation.dueWindowEndIso || '');

  return !Number.isFinite(dueWindowEndMs) || dueWindowEndMs >= now.getTime();
}

function urgencyRank(urgency) {
  return urgency === 'high'
    ? 3
    : urgency === 'medium'
      ? 2
      : urgency === 'low'
        ? 1
        : 0;
}

function wasGeneratedForLocalDate(gardenState, profile, now) {
  const timezone =
    profile.notificationPreference?.timezone ||
    getGardenTimezone(gardenState.garden) ||
    'America/Detroit';

  return (
    gardenState.operationsLastGeneratedLocalDate ===
    formatLocalDate(now, timezone)
  );
}

function getDraftRef(db, uid) {
  return db
    .collection('gardenWorkspaces')
    .doc('main')
    .collection('drafts')
    .doc(uid);
}

function getWorkspaceRef(db) {
  return db.collection('gardenWorkspaces').doc('main');
}

module.exports = {
  createOperationRunner,
};
