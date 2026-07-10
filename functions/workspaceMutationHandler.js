'use strict';

const { HttpsError } = require('firebase-functions/v2/https');
const {
  V2WorkspaceMutationError,
  createV2PublishBoundary,
} = require('./v2PublishBoundary');
const { V2PlanValidationError } = require('./v2PlanValidator');
const {
  V2WorkspaceRecordValidationError,
} = require('./v2WorkspaceRecordValidator');

function createWorkspaceMutationRunner({
  createBoundary = createV2PublishBoundary,
  db,
}) {
  return async function runWorkspaceMutation(request, method, input) {
    if (!request.auth?.uid) {
      throw new HttpsError(
        'unauthenticated',
        'Sign in before changing the shared garden.',
      );
    }
    if (!hasSecretFaeriesAccess(request.auth)) {
      throw new HttpsError(
        'permission-denied',
        'This account is not provisioned for Secret Faeries.',
      );
    }

    try {
      const boundary = createBoundary({ db });
      const mutation = boundary[method];
      if (typeof mutation !== 'function') {
        throw new V2WorkspaceMutationError(
          'invalid-argument',
          'The requested garden mutation is not supported.',
        );
      }
      return await mutation({ ...input, actorUserId: request.auth.uid });
    } catch (error) {
      if (error instanceof V2WorkspaceMutationError) {
        throw new HttpsError(toHttpsErrorCode(error.code), error.message);
      }
      if (
        error instanceof V2PlanValidationError ||
        error instanceof V2WorkspaceRecordValidationError
      ) {
        throw new HttpsError('failed-precondition', error.message);
      }
      throw error;
    }
  };
}

function hasSecretFaeriesAccess(authContext) {
  return (
    authContext?.token?.gardenAccess === true &&
    authContext?.token?.secretFaeriesMember === true
  );
}

function toHttpsErrorCode(code) {
  return [
    'already-exists',
    'failed-precondition',
    'invalid-argument',
    'not-found',
  ].includes(code)
    ? code
    : 'internal';
}

module.exports = {
  createWorkspaceMutationRunner,
  hasSecretFaeriesAccess,
  toHttpsErrorCode,
};
