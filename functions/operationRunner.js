'use strict';

const { generateGardenOperations } = require('./gardenOperations');
const {
  buildFrostNotification,
  buildHeatNotification,
  buildSevereWeatherNotification,
  buildTaskNotification,
  buildWateringNotification,
  createGardenAlert,
} = require('./notificationLogic');
const {
  claimCanonicalOperationRun,
  commitCanonicalOperations,
  loadSharedOperations,
  preserveConcurrentAction,
  releaseOperationClaim,
} = require('./operationStore');
const { createBackendWeatherProvider } = require('./weatherProviders');

const CANONICAL_WORKSPACE_ID = 'main';
const CANONICAL_WEATHER_SNAPSHOT_PATH =
  'gardenWorkspaces/main/weatherSnapshots/{snapshotId}';

function createOperationRunner({ admin, db, logger }) {
  return async function runCanonicalGardenOperations(options = {}) {
    const now = options.now || new Date();
    const runId =
      options.runId ||
      `garden-operations-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
    const claim = await claimCanonicalOperationRun({
      db,
      force: options.force === true,
      now,
      runId,
    });

    if (!claim.claimed) {
      return {
        generated: false,
        skipped: claim.reason,
        validationErrors: claim.validationErrors || [],
      };
    }

    try {
      const sharedOperations = await loadSharedOperations(db);
      const weatherProvider =
        options.weatherProvider || createBackendWeatherProvider(logger);
      const result = await generateGardenOperations({
        logger,
        now,
        operationsSettings: claim.operationsSettings,
        plan: claim.plan,
        sharedOperations,
        validationWarnings: claim.validationWarnings,
        weatherProvider,
      });
      const commit = await commitCanonicalOperations({
        admin,
        claim,
        db,
        result,
        shared: sharedOperations,
      });

      if (!commit.committed) {
        return { generated: false, skipped: commit.reason };
      }

      const alerts = [
        ...buildWateringGardenAlerts({
          recommendations: result.recommendations,
          revisionId: claim.revisionId,
          snapshot: result.snapshot,
        }),
        ...buildTaskGardenAlerts({
          createdAtIso: result.generatedAtIso,
          dueOnOrBefore: claim.localDate,
          revisionId: claim.revisionId,
          tasks: commit.tasks || result.tasks,
        }),
      ];
      logger?.info?.('Canonical crop-group operations generated.', {
        alertCount: alerts.length,
        providerId: result.providerId,
        recommendationCount: result.recommendations.length,
        revisionId: claim.revisionId,
        runId,
      });
      return {
        alerts,
        generated: true,
        generatedAtIso: result.generatedAtIso,
        providerId: result.providerId,
        recommendationCount: result.recommendations.length,
        snapshotId: result.snapshot.id,
        taskCount: result.tasks.length,
        workspaceRevisionId: claim.revisionId,
      };
    } catch (error) {
      await releaseOperationClaim({ db, error, now, runId });
      throw error;
    }
  };
}

function buildTaskGardenAlerts({
  createdAtIso,
  dueOnOrBefore,
  revisionId,
  tasks,
}) {
  return tasks
    .filter(
      (task) =>
        task.status === 'open' &&
        typeof task.dueOn === 'string' &&
        task.dueOn <= dueOnOrBefore &&
        !/^(watering|weather):/.test(task.sourceId || ''),
    )
    .map((task) =>
      createGardenAlert(buildTaskNotification(task), {
        createdAtIso,
        source: 'taskDue',
        taskId: task.id,
        targetId: task.target?.id || null,
        workspaceRevisionId: revisionId,
      }),
    );
}

function buildWateringGardenAlerts({ recommendations, revisionId, snapshot }) {
  return recommendations
    .filter(
      (recommendation) =>
        recommendation.actionable &&
        recommendation.status === 'due' &&
        Number(recommendation.recommendedDepthInches || 0) > 0,
    )
    .map((recommendation) => {
      const notification = buildWateringNotification(recommendation, snapshot);
      return createGardenAlert(notification, {
        amountInches: recommendation.recommendedDepthInches,
        createdAtIso: recommendation.calculatedAtIso,
        recommendationId: recommendation.id,
        snapshotId: snapshot.id,
        source: 'wateringRecommendation',
        targetId: recommendation.target.cropGroupId,
        workspaceRevisionId: revisionId,
      });
    });
}

function buildWeatherGardenAlerts(plan, snapshot, revisionId) {
  const notifications = [];
  if (snapshot.frostRisk && snapshot.frostRisk !== 'none') {
    notifications.push(buildFrostNotification(plan, snapshot));
  }
  if (snapshot.heatRisk && snapshot.heatRisk !== 'none') {
    notifications.push(buildHeatNotification(plan, snapshot));
  }
  if ((snapshot.alerts || []).length > 0) {
    notifications.push(buildSevereWeatherNotification(snapshot));
  }
  return notifications.map((notification) =>
    createGardenAlert(notification, {
      createdAtIso: snapshot.capturedAtIso,
      snapshotId: snapshot.id,
      source: 'weatherSnapshot',
      workspaceRevisionId: revisionId,
    }),
  );
}

module.exports = {
  CANONICAL_WEATHER_SNAPSHOT_PATH,
  CANONICAL_WORKSPACE_ID,
  buildTaskGardenAlerts,
  buildWateringGardenAlerts,
  buildWeatherGardenAlerts,
  createOperationRunner,
  preserveConcurrentAction,
};
