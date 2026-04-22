'use strict';

const { generateGardenOperations } = require('./gardenOperations');
const {
  formatLocalDate,
  getGardenTimezone,
  isUserDueForWateringCheck,
} = require('./operationTime');
const { buildWateringNotification } = require('./notificationLogic');
const { createBackendWeatherProvider } = require('./weatherProviders');

function createOperationRunner({ admin, db, dispatchNotification, logger }) {
  return async function runGardenOperationsForUser(uid, profile, options = {}) {
    const now = options.now ?? new Date();
    const garden = await loadGardenAggregate(db, uid);

    if (!garden) {
      return { generated: false, skipped: 'noGarden' };
    }

    if (!options.force && !isUserDueForWateringCheck(profile, now)) {
      return { generated: false, skipped: 'notDue' };
    }

    if (!options.force && wasGeneratedForLocalDate(garden, profile, now)) {
      return { generated: false, skipped: 'alreadyGenerated' };
    }

    const weatherProvider =
      options.weatherProvider ?? createBackendWeatherProvider(logger);
    const result = await generateGardenOperations({
      garden,
      logger,
      now,
      profile,
      weatherProvider,
    });

    await commitGardenOperations({
      admin,
      db,
      garden,
      profile,
      result,
      uid,
      now,
    });
    logger.info('analytics event', {
      eventName: 'watering_recommendation_generated',
      providerId: result.providerId,
      recommendationCount: result.recommendations.length,
      uid,
    });
    await dispatchWateringRecommendations({
      dispatchNotification,
      garden: {
        ...garden,
        waterRecommendations: result.waterRecommendations,
        weatherSnapshots: result.weatherSnapshots,
      },
      logger,
      profile,
      recommendations: result.recommendations,
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
  const gardenRef = db.collection('gardens').doc(uid);
  const [gardenSnapshot, structures, plantings, tasks, journalEntries] =
    await Promise.all([
      gardenRef.get(),
      readNestedCollection(gardenRef, 'structures'),
      readNestedCollection(gardenRef, 'plantings'),
      readNestedCollection(gardenRef, 'tasks'),
      readNestedCollection(gardenRef, 'journal'),
    ]);

  if (!gardenSnapshot.exists) {
    return null;
  }

  const garden = gardenSnapshot.data();

  return {
    ...garden,
    id: garden.id || uid,
    journalEntries,
    plantings,
    structures,
    tasks,
    userId: garden.userId || uid,
  };
}

async function readNestedCollection(gardenRef, collectionName) {
  const snapshot = await gardenRef.collection(collectionName).get();

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

async function commitGardenOperations({
  admin,
  db,
  garden,
  profile,
  result,
  uid,
  now,
}) {
  const batch = db.batch();
  const gardenRef = db.collection('gardens').doc(uid);
  const timezone =
    profile.notificationPreference?.timezone ||
    getGardenTimezone(garden) ||
    'America/Detroit';

  batch.set(
    gardenRef,
    {
      operationsLastGeneratedAtIso: result.generatedAtIso,
      operationsLastGeneratedLocalDate: formatLocalDate(now, timezone),
      operationsLastProviderId: result.providerId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAtIso: result.generatedAtIso,
      waterRecommendations: result.waterRecommendations,
      weatherSnapshots: result.weatherSnapshots,
    },
    { merge: true },
  );

  for (const task of result.tasks) {
    batch.set(gardenRef.collection('tasks').doc(task.id), task, {
      merge: true,
    });
  }

  await batch.commit();
}

async function dispatchWateringRecommendations({
  dispatchNotification,
  garden,
  logger,
  profile,
  recommendations,
  snapshot,
  uid,
}) {
  const threshold = Number(
    profile.notificationPreference?.wateringAlertThresholdIn ?? 0.25,
  );
  const activeRecommendations = recommendations.filter(
    (recommendation) =>
      recommendation.status === 'active' &&
      Number(
        recommendation.deficitInches || recommendation.inchesNeeded || 0,
      ) >= threshold,
  );

  for (const recommendation of activeRecommendations.slice(0, 5)) {
    const notification = buildWateringNotification(recommendation, snapshot);

    await dispatchNotification({
      body: notification.body,
      garden,
      profile,
      title: notification.title,
      type: notification.type,
      uid,
    });
    logger.info('analytics event', {
      eventName: 'water_alert_sent',
      recommendationId: recommendation.id,
      targetType: recommendation.targetType,
      uid,
    });
  }
}

function wasGeneratedForLocalDate(garden, profile, now) {
  const timezone =
    profile.notificationPreference?.timezone ||
    getGardenTimezone(garden) ||
    'America/Detroit';

  return (
    garden.operationsLastGeneratedLocalDate === formatLocalDate(now, timezone)
  );
}

module.exports = {
  createOperationRunner,
};
