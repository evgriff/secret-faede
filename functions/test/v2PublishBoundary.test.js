'use strict';

const assert = require('node:assert/strict');
const { V2PlanValidationError } = require('../v2PlanValidator');
const {
  V2WorkspaceMutationError,
  createV2PublishBoundary,
} = require('../v2PublishBoundary');
const {
  V2WorkspaceRecordValidationError,
} = require('../v2WorkspaceRecordValidator');
const {
  createV2Plan,
  createWorkspaceDocuments,
} = require('./v2PublishFixtures');
const { createV2PublishTestFirestore } = require('./v2PublishTestFirestore');

const commitDate = new Date('2026-07-09T14:30:00.000Z');
const commitIso = commitDate.toISOString();

(async () => {
  await publishesOnePrivateDraft();
  await returnsOptimisticConflictsWithoutWriting();
  await rejectsInvalidDraftsAndRevisionCollisions();
  await revertsThroughANewImmutableRevision();
  await publishesOnlySharedSettingsAndRebasesActorDraft();
  await publishesSharedSettingsWithoutInventingADraft();
  await rejectsStaleSharedSettingsAndInvalidRecords();
  await serializesConcurrentPublishers();
  console.log('v2 publish boundary tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function publishesOnePrivateDraft() {
  const initial = createWorkspaceDocuments();
  const db = createV2PublishTestFirestore(initial);
  const boundary = createBoundary(db, ['revision-2']);
  const result = await boundary.publishDraft({
    actorUserId: 'user-a',
    changeSummary: '  Added summer crops  ',
    expectedRevisionId: 'revision-1',
  });
  assert.deepEqual(result, {
    committedAtIso: commitIso,
    revisionId: 'revision-2',
    status: 'committed',
  });

  const data = db.dump();
  assert.equal(data['gardenWorkspaces/main'].publishedRevisionId, 'revision-2');
  assert.deepEqual(data['gardenWorkspaces/main'].operationsAutomation, {
    checkTimeLocal: '07:00',
  });
  assert.equal(
    data['gardenWorkspaces/main/plans/published'].plan.name,
    'Private user A garden',
  );
  assert.equal(
    data['gardenWorkspaces/main/plans/published'].plan.updatedAtIso,
    commitIso,
  );
  assert.equal(
    data['gardenWorkspaces/main/revisions/revision-2'].changeSummary,
    'Added summer crops',
  );
  assert.equal(data['gardenWorkspaces/main/drafts/user-a'], undefined);
  assert.deepEqual(
    data['gardenWorkspaces/main/drafts/user-b'],
    initial['gardenWorkspaces/main/drafts/user-b'],
  );
  assert.deepEqual(
    data['gardenWorkspaces/main/revisions/revision-1'],
    initial['gardenWorkspaces/main/revisions/revision-1'],
    'the prior revision remains immutable',
  );
}

async function returnsOptimisticConflictsWithoutWriting() {
  const staleDb = createV2PublishTestFirestore(createWorkspaceDocuments());
  const before = staleDb.dump();
  const stale = await createBoundary(staleDb, ['revision-2']).publishDraft({
    actorUserId: 'user-a',
    changeSummary: '',
    expectedRevisionId: 'revision-stale',
  });
  assert.deepEqual(stale, {
    actualRevisionId: 'revision-1',
    expectedRevisionId: 'revision-stale',
    reason: 'published-revision-mismatch',
    status: 'conflict',
  });
  assert.deepEqual(staleDb.dump(), before);

  const documents = createWorkspaceDocuments();
  documents['gardenWorkspaces/main/drafts/user-a'].baseRevisionId =
    'revision-stale';
  const staleDraftDb = createV2PublishTestFirestore(documents);
  const draftBefore = staleDraftDb.dump();
  const staleDraft = await createBoundary(staleDraftDb, [
    'revision-2',
  ]).publishDraft({
    actorUserId: 'user-a',
    changeSummary: '',
    expectedRevisionId: 'revision-1',
  });
  assert.equal(staleDraft.status, 'conflict');
  assert.equal(staleDraft.reason, 'draft-base-mismatch');
  assert.equal(staleDraft.draftBaseRevisionId, 'revision-stale');
  assert.deepEqual(staleDraftDb.dump(), draftBefore);
}

async function rejectsInvalidDraftsAndRevisionCollisions() {
  const invalidDocuments = createWorkspaceDocuments();
  delete invalidDocuments['gardenWorkspaces/main/drafts/user-a'].plan
    .plantings[0].wateringStage;
  const invalidDb = createV2PublishTestFirestore(invalidDocuments);
  const invalidBefore = invalidDb.dump();
  await assert.rejects(
    createBoundary(invalidDb, ['revision-2']).publishDraft({
      actorUserId: 'user-a',
      changeSummary: 'Unsafe plan',
      expectedRevisionId: 'revision-1',
    }),
    V2PlanValidationError,
  );
  assert.deepEqual(invalidDb.dump(), invalidBefore);

  const collisionDb = createV2PublishTestFirestore(createWorkspaceDocuments());
  const collisionBefore = collisionDb.dump();
  await assert.rejects(
    createBoundary(collisionDb, ['revision-1']).publishDraft({
      actorUserId: 'user-a',
      changeSummary: '',
      expectedRevisionId: 'revision-1',
    }),
    (error) =>
      error instanceof V2WorkspaceMutationError &&
      error.code === 'already-exists',
  );
  assert.deepEqual(collisionDb.dump(), collisionBefore);

  const noDraft = createWorkspaceDocuments();
  delete noDraft['gardenWorkspaces/main/drafts/user-a'];
  await assert.rejects(
    createBoundary(createV2PublishTestFirestore(noDraft), [
      'revision-2',
    ]).publishDraft({
      actorUserId: 'user-a',
      changeSummary: '',
      expectedRevisionId: 'revision-1',
    }),
    (error) =>
      error instanceof V2WorkspaceMutationError && error.code === 'not-found',
  );
}

async function revertsThroughANewImmutableRevision() {
  const initial = createWorkspaceDocuments();
  const db = createV2PublishTestFirestore(initial);
  const result = await createBoundary(db, ['revision-2']).revertPublished({
    actorUserId: 'user-a',
    expectedRevisionId: 'revision-1',
    revisionId: 'revision-1',
  });
  assert.equal(result.revisionId, 'revision-2');
  const data = db.dump();
  assert.equal(
    data['gardenWorkspaces/main/revisions/revision-2'].changeSummary,
    'Restored revision-1',
  );
  assert.equal(
    data['gardenWorkspaces/main/plans/published'].publishedByUserId,
    'user-a',
  );
  assert.equal(data['gardenWorkspaces/main/drafts/user-a'], undefined);
  assert.deepEqual(
    data['gardenWorkspaces/main/drafts/user-b'],
    initial['gardenWorkspaces/main/drafts/user-b'],
  );
  assert.deepEqual(
    data['gardenWorkspaces/main/revisions/revision-1'],
    initial['gardenWorkspaces/main/revisions/revision-1'],
  );

  const invalidRevisionDocuments = createWorkspaceDocuments();
  invalidRevisionDocuments[
    'gardenWorkspaces/main/revisions/revision-1'
  ].plan.untrusted = true;
  const invalidRevisionDb = createV2PublishTestFirestore(
    invalidRevisionDocuments,
  );
  const before = invalidRevisionDb.dump();
  await assert.rejects(
    createBoundary(invalidRevisionDb, ['revision-2']).revertPublished({
      actorUserId: 'user-a',
      expectedRevisionId: 'revision-1',
      revisionId: 'revision-1',
    }),
    V2PlanValidationError,
  );
  assert.deepEqual(invalidRevisionDb.dump(), before);
}

async function publishesOnlySharedSettingsAndRebasesActorDraft() {
  const initial = createWorkspaceDocuments();
  initial['gardenWorkspaces/main/drafts/user-a'].plan.plantings[0].notes =
    'Keep this private spacing experiment';
  const supplied = createV2Plan({ name: 'Must not replace published name' });
  supplied.plot.climate = {
    firstFrost: '10-20',
    hardinessZone: '7a',
    lastFrost: '04-20',
  };
  supplied.plot.location = {
    coordinates: { latitude: 42.28, longitude: -83.74 },
    label: 'Back garden',
    query: 'Ann Arbor, MI',
    timezone: 'America/Detroit',
  };

  const db = createV2PublishTestFirestore(initial);
  const result = await createBoundary(db, [
    'revision-settings',
  ]).publishSharedSettings({
    actorUserId: 'user-a',
    expectedRevisionId: 'revision-1',
    plan: supplied,
  });
  assert.equal(result.revisionId, 'revision-settings');
  const data = db.dump();
  const published = data['gardenWorkspaces/main/plans/published'];
  const draftA = data['gardenWorkspaces/main/drafts/user-a'];
  assert.equal(published.plan.name, 'Home garden');
  assert.deepEqual(published.plan.plot.location, supplied.plot.location);
  assert.deepEqual(published.plan.plot.climate, supplied.plot.climate);
  assert.equal(
    published.plan.plantings[0].notes,
    createV2Plan().plantings[0].notes,
  );
  assert.equal(draftA.plan.name, 'Private user A garden');
  assert.equal(
    draftA.plan.plantings[0].notes,
    'Keep this private spacing experiment',
  );
  assert.deepEqual(draftA.plan.plot.location, supplied.plot.location);
  assert.deepEqual(draftA.plan.plot.climate, supplied.plot.climate);
  assert.equal(draftA.baseRevisionId, 'revision-settings');
  assert.equal(draftA.updatedAtIso, commitIso);
  assert.deepEqual(
    data['gardenWorkspaces/main/drafts/user-b'],
    initial['gardenWorkspaces/main/drafts/user-b'],
  );
}

async function publishesSharedSettingsWithoutInventingADraft() {
  const documents = createWorkspaceDocuments();
  delete documents['gardenWorkspaces/main/drafts/user-a'];
  const db = createV2PublishTestFirestore(documents);
  await createBoundary(db, ['revision-settings']).publishSharedSettings({
    actorUserId: 'user-a',
    expectedRevisionId: 'revision-1',
    plan: createV2Plan(),
  });
  assert.equal(db.dump()['gardenWorkspaces/main/drafts/user-a'], undefined);
}

async function rejectsStaleSharedSettingsAndInvalidRecords() {
  const staleDocuments = createWorkspaceDocuments();
  staleDocuments['gardenWorkspaces/main/drafts/user-a'].baseRevisionId =
    'revision-old';
  const staleDb = createV2PublishTestFirestore(staleDocuments);
  const staleBefore = staleDb.dump();
  const result = await createBoundary(staleDb, [
    'revision-settings',
  ]).publishSharedSettings({
    actorUserId: 'user-a',
    expectedRevisionId: 'revision-1',
    plan: createV2Plan(),
  });
  assert.equal(result.reason, 'draft-base-mismatch');
  assert.deepEqual(staleDb.dump(), staleBefore);

  const invalidInput = createV2Plan();
  invalidInput.plot.climate.firstFrost = '02-31';
  const inputDb = createV2PublishTestFirestore(createWorkspaceDocuments());
  const inputBefore = inputDb.dump();
  await assert.rejects(
    createBoundary(inputDb, ['revision-settings']).publishSharedSettings({
      actorUserId: 'user-a',
      expectedRevisionId: 'revision-1',
      plan: invalidInput,
    }),
    V2PlanValidationError,
  );
  assert.deepEqual(inputDb.dump(), inputBefore);

  const corruptDocuments = createWorkspaceDocuments();
  corruptDocuments['gardenWorkspaces/main/plans/published'].extra = true;
  const corruptDb = createV2PublishTestFirestore(corruptDocuments);
  const corruptBefore = corruptDb.dump();
  await assert.rejects(
    createBoundary(corruptDb, ['revision-2']).publishDraft({
      actorUserId: 'user-a',
      changeSummary: '',
      expectedRevisionId: 'revision-1',
    }),
    V2WorkspaceRecordValidationError,
  );
  assert.deepEqual(corruptDb.dump(), corruptBefore);
}

async function serializesConcurrentPublishers() {
  const db = createV2PublishTestFirestore(createWorkspaceDocuments());
  const boundary = createBoundary(db, ['revision-a', 'revision-b']);
  const [userA, userB] = await Promise.all([
    boundary.publishDraft({
      actorUserId: 'user-a',
      changeSummary: 'User A publish',
      expectedRevisionId: 'revision-1',
    }),
    boundary.publishDraft({
      actorUserId: 'user-b',
      changeSummary: 'User B publish',
      expectedRevisionId: 'revision-1',
    }),
  ]);
  assert.equal(userA.status, 'committed');
  assert.equal(userB.status, 'conflict');
  assert.equal(userB.actualRevisionId, 'revision-a');
  const data = db.dump();
  assert.ok(data['gardenWorkspaces/main/revisions/revision-a']);
  assert.equal(data['gardenWorkspaces/main/revisions/revision-b'], undefined);
  assert.ok(data['gardenWorkspaces/main/drafts/user-b']);
}

function createBoundary(db, ids) {
  const queue = [...ids];
  return createV2PublishBoundary({
    db,
    newRevisionId: () => queue.shift(),
    now: () => commitDate,
  });
}
