'use strict';

const assert = require('node:assert/strict');
const {
  CANONICAL_WEATHER_SNAPSHOT_PATH,
  createOperationRunner,
} = require('../operationRunner');
const { createMemoryFirestore } = require('./testFirestore');
const { validateCanonicalWorkspace } = require('../operationValidation');
const { balance, now, plan, provider, shared } = require('./v2Fixtures');

const manualTask = {
  completedAtIso: null,
  createdAtIso: '2026-06-21T10:00:00.000Z',
  dueOn: '2026-06-21',
  id: 'manual-task',
  kind: 'inspect',
  notes: '',
  priority: 'medium',
  reason: 'Manual field check',
  sourceId: null,
  status: 'open',
  target: { id: 'tomato-group', kind: 'plantingGroup', label: 'Tomato' },
  title: 'Inspect tomato support',
  updatedAtIso: '2026-06-21T10:00:00.000Z',
};

function createDb() {
  const initial = {
    'gardenWorkspaces/main': {
      id: 'main',
      publishedRevisionId: 'revision-1',
      schemaVersion: 2,
      updatedAtIso: now.toISOString(),
    },
    'gardenWorkspaces/main/drafts/user-a': {
      baseRevisionId: 'revision-1',
      plan: { ...plan, name: 'Private A' },
      userId: 'user-a',
    },
    'gardenWorkspaces/main/drafts/user-b': {
      baseRevisionId: 'revision-1',
      plan: { ...plan, name: 'Private B' },
      userId: 'user-b',
    },
    'gardenWorkspaces/main/plans/published': {
      plan,
      publishedAtIso: now.toISOString(),
      publishedByUserId: 'user-a',
      revisionId: 'revision-1',
    },
    'gardenWorkspaces/main/tasks/manual-task': manualTask,
    'gardenWorkspaces/main/waterBalances/tomato-group': balance('tomato-group'),
    'gardenWorkspaces/main/waterBalances/lettuce-group':
      balance('lettuce-group'),
    'users/user-a': { schemaVersion: 2 },
    'users/user-b': { schemaVersion: 2 },
  };
  for (const application of shared().waterApplications) {
    initial[`gardenWorkspaces/main/waterApplications/${application.id}`] =
      application;
  }
  return createMemoryFirestore(initial);
}

function createRunner(db) {
  return createOperationRunner({
    admin: {
      firestore: {
        FieldValue: { serverTimestamp: () => '__SERVER_TIMESTAMP__' },
      },
    },
    db,
    logger: { info() {}, warn() {} },
  });
}

(async () => {
  assert.equal(
    CANONICAL_WEATHER_SNAPSHOT_PATH,
    'gardenWorkspaces/main/weatherSnapshots/{snapshotId}',
  );

  const db = createDb();
  const draftA = structuredClone(
    db.dump()['gardenWorkspaces/main/drafts/user-a'],
  );
  const draftB = structuredClone(
    db.dump()['gardenWorkspaces/main/drafts/user-b'],
  );
  let actionApplied = false;
  const weather = provider({
    onRead: async () => {
      if (actionApplied) return;
      actionApplied = true;
      await db
        .collection('gardenWorkspaces')
        .doc('main')
        .collection('tasks')
        .doc('manual-task')
        .set(
          {
            completedAtIso: '2026-06-21T12:00:30.000Z',
            dueOn: '2026-06-28',
            status: 'done',
            updatedAtIso: '2026-06-21T12:00:30.000Z',
          },
          { merge: true },
        );
    },
  });
  const runner = createRunner(db);
  const [first, second] = await Promise.all([
    runner({ now, runId: 'run-user-a', weatherProvider: weather }),
    runner({ now, runId: 'run-user-b', weatherProvider: weather }),
  ]);
  const generated = [first, second].filter((result) => result.generated);
  const skipped = [first, second].filter((result) => !result.generated);

  assert.equal(generated.length, 1);
  assert.equal(skipped[0].skipped, 'runInProgress');
  assert.equal(
    weather.readCount,
    1,
    'operations run once, never once per user',
  );
  assert.deepEqual(db.dump()['gardenWorkspaces/main/drafts/user-a'], draftA);
  assert.deepEqual(db.dump()['gardenWorkspaces/main/drafts/user-b'], draftB);
  assert.equal(
    db.dump()['gardenWorkspaces/main/tasks/manual-task'].status,
    'done',
    'transactional merge preserves concurrent Today actions',
  );
  assert.equal(
    db.dump()['gardenWorkspaces/main/tasks/manual-task'].dueOn,
    '2026-06-28',
    'transactional merge preserves a concurrent Today reschedule',
  );
  assert.equal(
    generated[0].alerts.some((alert) => alert.taskId === 'manual-task'),
    false,
    'a task completed during generation must not emit a stale due alert',
  );
  assert.ok(db.dump()['gardenWorkspaces/main/waterBalances/tomato-group']);
  assert.ok(
    db.dump()['gardenWorkspaces/main/wateringRecommendations/tomato-group'],
  );
  assert.ok(
    Object.keys(db.dump()).some((path) =>
      path.startsWith('gardenWorkspaces/main/weatherSnapshots/weather:'),
    ),
  );
  assert.equal(generated[0].alerts[0].targetId, 'tomato-group');
  assert.equal(
    generated[0].alerts[0].deepLink,
    '/app/today?focus=watering&cropGroupId=tomato-group',
  );

  const idempotent = await runner({
    now,
    runId: 'run-again',
    weatherProvider: weather,
  });
  assert.equal(idempotent.generated, false);
  assert.equal(idempotent.skipped, 'alreadyGenerated');
  assert.equal(weather.readCount, 1);

  const taskDb = createDb();
  const taskResult = await createRunner(taskDb)({
    force: true,
    now,
    runId: 'task-due',
    weatherProvider: provider(),
  });
  const taskAlert = taskResult.alerts.find(
    (candidate) => candidate.taskId === 'manual-task',
  );
  assert.equal(taskAlert.type, 'taskDue');
  assert.equal(taskAlert.deepLink, '/app/today?focus=task&taskId=manual-task');
  assert.match(taskAlert.dedupeKey, /task:manual-task:2026-06-21/);

  const applicationDb = createDb();
  const applicationProvider = provider({
    onRead: () =>
      applicationDb
        .collection('gardenWorkspaces')
        .doc('main')
        .collection('waterApplications')
        .doc('concurrent-water')
        .set({
          amount: { depthInches: 0.4, unit: 'inches' },
          appliedAtIso: now.toISOString(),
          cropGroupId: 'tomato-group',
          efficiency: { confidence: 'high', fraction: 1, source: 'manual' },
          id: 'concurrent-water',
          method: 'hose',
          outcome: 'applied',
          recordedAtIso: now.toISOString(),
          recordedByUserId: 'user-a',
          revision: 1,
        }),
  });
  const applicationConflict = await createRunner(applicationDb)({
    force: true,
    now,
    runId: 'application-conflict',
    weatherProvider: applicationProvider,
  });
  assert.equal(applicationConflict.generated, false);
  assert.equal(applicationConflict.skipped, 'sharedOperationsChanged');

  const revisionDb = createDb();
  const revisionProvider = provider({
    onRead: () =>
      revisionDb
        .collection('gardenWorkspaces')
        .doc('main')
        .set({ publishedRevisionId: 'revision-2' }, { merge: true }),
  });
  const revisionConflict = await createRunner(revisionDb)({
    force: true,
    now,
    runId: 'revision-conflict',
    weatherProvider: revisionProvider,
  });
  assert.equal(revisionConflict.generated, false);
  assert.equal(revisionConflict.skipped, 'revisionChanged');

  const invalidDb = createDb();
  await invalidDb
    .collection('gardenWorkspaces')
    .doc('main')
    .collection('plans')
    .doc('published')
    .set(
      {
        plan: {
          ...plan,
          plot: {
            ...plan.plot,
            location: {
              ...plan.plot.location,
              coordinates: { latitude: 999, longitude: -83 },
            },
          },
        },
      },
      { merge: true },
    );
  const invalid = await createRunner(invalidDb)({
    force: true,
    now,
    weatherProvider: provider(),
  });
  assert.equal(invalid.generated, false);
  assert.equal(invalid.skipped, 'invalidWorkspace');
  assert.match(invalid.validationErrors.join(' '), /latitude/);

  const noCoordinatesDb = createDb();
  await noCoordinatesDb
    .collection('gardenWorkspaces')
    .doc('main')
    .collection('plans')
    .doc('published')
    .set(
      {
        plan: {
          ...plan,
          plot: {
            ...plan.plot,
            location: { ...plan.plot.location, coordinates: null },
          },
        },
      },
      { merge: true },
    );
  const noCoordinatesProvider = provider();
  const noCoordinates = await createRunner(noCoordinatesDb)({
    force: true,
    now,
    runId: 'no-coordinates',
    weatherProvider: noCoordinatesProvider,
  });
  assert.equal(noCoordinates.generated, true);
  assert.equal(noCoordinates.providerId, 'unavailable');
  assert.equal(noCoordinatesProvider.readCount, 0, 'weather is not requested');
  const noCoordinateRecommendations = Object.entries(noCoordinatesDb.dump())
    .filter(([path]) =>
      path.startsWith('gardenWorkspaces/main/wateringRecommendations/'),
    )
    .map(([, value]) => value);
  assert.ok(
    noCoordinateRecommendations.every(
      (item) =>
        item.status === 'checkSoil' &&
        item.confidence === 'low' &&
        item.recommendedDepthInches === null,
    ),
  );
  assert.equal(
    noCoordinates.alerts.some((alert) =>
      ['frost', 'heatStress', 'severeWeather', 'watering'].includes(alert.type),
    ),
    false,
    'missing coordinates never produce weather or automatic watering pushes',
  );

  const invalidProfilePlan = structuredClone(plan);
  invalidProfilePlan.plantings[0].waterProfile = {
    ...invalidProfilePlan.plantings[0].waterProfile,
    stageCoefficients: {
      ...invalidProfilePlan.plantings[0].waterProfile.stageCoefficients,
      fruiting: null,
    },
  };
  const profileValidation = validateCanonicalWorkspace({
    metadata: {
      publishedRevisionId: 'revision-1',
      schemaVersion: 2,
    },
    published: { plan: invalidProfilePlan, revisionId: 'revision-1' },
  });
  assert.equal(profileValidation.valid, false);
  assert.match(
    profileValidation.errors.join(' '),
    /stageCoefficients\.fruiting/,
  );

  console.log('operationRunner tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
