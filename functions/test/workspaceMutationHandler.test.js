'use strict';

const assert = require('node:assert/strict');
const { HttpsError } = require('firebase-functions/v2/https');
const { V2WorkspaceMutationError } = require('../v2PublishBoundary');
const {
  createWorkspaceMutationRunner,
} = require('../workspaceMutationHandler');

(async () => {
  await rejectsMissingAuthentication();
  await rejectsMissingAccessClaims();
  await trustsOnlyTheAuthenticatedActor();
  await mapsKnownBoundaryFailures();
  await preservesConflictResults();
  console.log('workspaceMutationHandler tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function rejectsMissingAuthentication() {
  const run = createRunner(() => ({}));
  await assert.rejects(
    run({ auth: null }, 'publishDraft', {}),
    (error) => error instanceof HttpsError && error.code === 'unauthenticated',
  );
}

async function rejectsMissingAccessClaims() {
  const run = createRunner(() => ({}));
  await assert.rejects(
    run(
      { auth: { token: { gardenAccess: true }, uid: 'user-a' } },
      'publishDraft',
      {},
    ),
    (error) =>
      error instanceof HttpsError && error.code === 'permission-denied',
  );
}

async function trustsOnlyTheAuthenticatedActor() {
  let received = null;
  const run = createRunner(() => ({
    async publishDraft(input) {
      received = input;
      return {
        committedAtIso: '2026-07-09T12:00:00.000Z',
        status: 'committed',
      };
    },
  }));
  const result = await run(request('trusted-user'), 'publishDraft', {
    actorUserId: 'spoofed-user',
    changeSummary: 'Verified publication',
    expectedRevisionId: 'revision-1',
  });
  assert.equal(received.actorUserId, 'trusted-user');
  assert.equal(received.expectedRevisionId, 'revision-1');
  assert.equal(result.status, 'committed');
}

async function mapsKnownBoundaryFailures() {
  const run = createRunner(() => ({
    async publishDraft() {
      throw new V2WorkspaceMutationError(
        'invalid-argument',
        'The publication input is invalid.',
      );
    },
  }));
  await assert.rejects(
    run(request('user-a'), 'publishDraft', {}),
    (error) =>
      error instanceof HttpsError &&
      error.code === 'invalid-argument' &&
      /invalid/.test(error.message),
  );
}

async function preservesConflictResults() {
  const conflict = {
    actualRevisionId: 'revision-2',
    expectedRevisionId: 'revision-1',
    status: 'conflict',
  };
  const run = createRunner(() => ({
    async publishDraft() {
      return conflict;
    },
  }));
  assert.deepEqual(await run(request('user-a'), 'publishDraft', {}), conflict);
}

function createRunner(createBoundary) {
  return createWorkspaceMutationRunner({ createBoundary, db: {} });
}

function request(uid) {
  return {
    auth: {
      token: { gardenAccess: true, secretFaeriesMember: true },
      uid,
    },
  };
}
