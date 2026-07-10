'use strict';

const { assertValidV2Plan } = require('./v2PlanValidator');
const { isCanonicalIso, isRecord } = require('./v2PlanValidationSupport');

class V2WorkspaceRecordValidationError extends Error {
  constructor(path, message) {
    super(`${path}: ${message}`);
    this.name = 'V2WorkspaceRecordValidationError';
    this.path = path;
  }
}

function assertV2WorkspaceMetadata(value, workspaceId = 'main') {
  assertRecord(value, 'workspace');
  if (value.schemaVersion !== 2) {
    fail('workspace.schemaVersion', 'Must be workspace schema 2.');
  }
  if (value.id !== workspaceId) {
    fail('workspace.id', 'Workspace id does not match the canonical path.');
  }
  assertIdentifier(value.publishedRevisionId, 'workspace.publishedRevisionId');
  assertIso(value.updatedAtIso, 'workspace.updatedAtIso');
  return value;
}

function assertV2PublishedRecord(value, expectedRevisionId) {
  assertExactRecord(value, 'published', [
    'plan',
    'publishedAtIso',
    'publishedByUserId',
    'revisionId',
  ]);
  assertIdentifier(value.revisionId, 'published.revisionId');
  assertIdentifier(value.publishedByUserId, 'published.publishedByUserId');
  assertIso(value.publishedAtIso, 'published.publishedAtIso');
  if (expectedRevisionId && value.revisionId !== expectedRevisionId) {
    fail(
      'published.revisionId',
      'Published record does not match workspace metadata.',
    );
  }
  assertValidV2Plan(value.plan);
  return value;
}

function assertV2DraftRecord(value, actorUserId) {
  assertExactRecord(value, 'draft', [
    'baseRevisionId',
    'plan',
    'updatedAtIso',
    'userId',
  ]);
  assertIdentifier(value.baseRevisionId, 'draft.baseRevisionId');
  assertIdentifier(value.userId, 'draft.userId');
  assertIso(value.updatedAtIso, 'draft.updatedAtIso');
  if (value.userId !== actorUserId) {
    fail('draft.userId', 'Draft owner does not match the authenticated actor.');
  }
  assertValidV2Plan(value.plan);
  return value;
}

function assertV2RevisionRecord(value, expectedRevisionId) {
  assertExactRecord(value, 'revision', [
    'changeSummary',
    'plan',
    'publishedAtIso',
    'publishedByUserId',
    'revisionId',
  ]);
  assertIdentifier(value.revisionId, 'revision.revisionId');
  assertIdentifier(value.publishedByUserId, 'revision.publishedByUserId');
  assertIso(value.publishedAtIso, 'revision.publishedAtIso');
  if (expectedRevisionId && value.revisionId !== expectedRevisionId) {
    fail('revision.revisionId', 'Revision id does not match its path.');
  }
  assertValidV2Plan(value.plan);
  assertText(value.changeSummary, 'revision.changeSummary', 1, 500);
  return value;
}

function assertIdentifier(value, path) {
  assertText(value, path, 1, 128);
  if (value.includes('/')) fail(path, 'Must not contain a path separator.');
  return value;
}

function assertIso(value, path) {
  if (!isCanonicalIso(value)) {
    fail(path, 'Must be a canonical UTC ISO instant with milliseconds.');
  }
  return value;
}

function assertText(value, path, minimum, maximum) {
  if (
    typeof value !== 'string' ||
    value.length < minimum ||
    value.length > maximum ||
    (minimum > 0 && value.trim().length === 0)
  ) {
    fail(path, `Must be text between ${minimum} and ${maximum} characters.`);
  }
  return value;
}

function assertExactRecord(value, path, keys) {
  assertRecord(value, path);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(path, `Must contain exactly: ${expected.join(', ')}.`);
  }
}

function assertRecord(value, path) {
  if (!isRecord(value)) fail(path, 'Must be an object.');
}

function fail(path, message) {
  throw new V2WorkspaceRecordValidationError(path, message);
}

module.exports = {
  V2WorkspaceRecordValidationError,
  assertIdentifier,
  assertV2DraftRecord,
  assertV2PublishedRecord,
  assertV2RevisionRecord,
  assertV2WorkspaceMetadata,
};
