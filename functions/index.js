'use strict';

const admin = require('firebase-admin');
const { logger } = require('firebase-functions');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const {
  createNotificationDeliveryPipeline,
} = require('./notificationDelivery');
const {
  CANONICAL_WEATHER_SNAPSHOT_PATH,
  buildWeatherGardenAlerts,
  createOperationRunner,
} = require('./operationRunner');
const { validateCanonicalWorkspace } = require('./operationValidation');
const { createBackendWeatherProvider } = require('./weatherProviders');
const { createWorkspaceMutationRunner } = require('./workspaceMutationHandler');

admin.initializeApp();

const auth = admin.auth();
const db = admin.firestore();
const messaging = admin.messaging();
const runWorkspaceMutation = createWorkspaceMutationRunner({ db });

function hasSecretFaeriesAccess(authContext) {
  return (
    authContext?.token?.gardenAccess === true &&
    authContext?.token?.secretFaeriesMember === true
  );
}

function createPipelines() {
  return {
    delivery: createNotificationDeliveryPipeline({
      auth,
      db,
      logger,
      messaging,
    }),
    runOperations: createOperationRunner({ admin, db, logger }),
  };
}

exports.dailyWateringCheck = onSchedule(
  {
    schedule: '0 * * * *',
    timeZone: 'UTC',
  },
  async () => {
    const pipelines = createPipelines();
    const now = new Date();
    const result = await pipelines.runOperations({
      force: true,
      now,
      weatherProvider: createBackendWeatherProvider(logger),
    });
    let recipientCount = 0;

    if (result.generated) {
      for (const alert of result.alerts) {
        const fanout = await pipelines.delivery.publishAndFanOutAlert(alert, {
          now,
        });
        recipientCount += fanout.recipientCount;
      }
    }

    const pending = await pipelines.delivery.processPendingDeliveries({ now });

    logger.info('Scheduled canonical garden operations completed.', {
      generated: result.generated,
      pendingDeliveryCount: pending.processedCount,
      recipientCount,
      skipped: result.skipped || null,
      workspaceRevisionId: result.workspaceRevisionId || null,
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

  const requestedUid =
    typeof request.data?.userId === 'string'
      ? request.data.userId
      : request.auth.uid;

  if (requestedUid !== request.auth.uid) {
    throw new HttpsError(
      'permission-denied',
      'You can only request a refresh as the signed-in account.',
    );
  }

  const pipelines = createPipelines();
  const now = new Date();
  const result = await pipelines.runOperations({
    force: true,
    now,
    weatherProvider: createBackendWeatherProvider(logger),
  });

  if (result.skipped === 'noPublishedGarden') {
    throw new HttpsError('not-found', 'No published garden workspace exists.');
  }
  if (result.skipped === 'invalidWorkspace') {
    throw new HttpsError(
      'failed-precondition',
      `The published garden cannot be refreshed: ${result.validationErrors.join(' ')}`,
    );
  }

  if (result.generated) {
    for (const alert of result.alerts) {
      await pipelines.delivery.publishAndFanOutAlert(alert, { now });
    }
  }

  return {
    generatedAtIso: result.generatedAtIso || null,
    ok: result.generated === true,
    providerId: result.providerId || null,
    recommendationCount: result.recommendationCount || 0,
    skipped: result.skipped || null,
    taskCount: result.taskCount || 0,
    workspaceRevisionId: result.workspaceRevisionId || null,
  };
});

exports.publishGardenDraftV2 = onCall((request) =>
  runWorkspaceMutation(request, 'publishDraft', {
    changeSummary: request.data?.changeSummary,
    expectedRevisionId: request.data?.expectedRevisionId,
  }),
);

exports.revertGardenPlanV2 = onCall((request) =>
  runWorkspaceMutation(request, 'revertPublished', {
    expectedRevisionId: request.data?.expectedRevisionId,
    revisionId: request.data?.revisionId,
  }),
);

exports.publishGardenSettingsV2 = onCall((request) =>
  runWorkspaceMutation(request, 'publishSharedSettings', {
    expectedRevisionId: request.data?.expectedRevisionId,
    plan: request.data?.plan,
  }),
);

exports.onGardenWeatherSnapshotUpdated = onDocumentCreated(
  CANONICAL_WEATHER_SNAPSHOT_PATH,
  async (event) => {
    const snapshot = event.data?.data();

    if (!snapshot) {
      return;
    }

    const workspaceRef = db.collection('gardenWorkspaces').doc('main');
    const [workspaceSnapshot, publishedSnapshot] = await Promise.all([
      workspaceRef.get(),
      workspaceRef.collection('plans').doc('published').get(),
    ]);
    const workspaceData = workspaceSnapshot.exists
      ? workspaceSnapshot.data()
      : null;
    const publishedData = publishedSnapshot.exists
      ? publishedSnapshot.data()
      : null;
    const validation = validateCanonicalWorkspace({
      metadata: workspaceData,
      published: publishedData,
    });

    if (!validation.valid) {
      logger.warn('Weather alert fanout skipped for invalid workspace.', {
        errors: validation.errors,
        snapshotId: event.params.snapshotId,
      });
      return;
    }

    const normalizedSnapshot = {
      ...snapshot,
      id: snapshot.id || event.params.snapshotId,
    };
    const alerts = buildWeatherGardenAlerts(
      validation.plan,
      normalizedSnapshot,
      validation.revisionId,
    );
    const delivery = createNotificationDeliveryPipeline({
      auth,
      db,
      logger,
      messaging,
    });

    for (const alert of alerts) {
      await delivery.publishAndFanOutAlert(alert, {
        now: new Date(),
      });
    }
  },
);
