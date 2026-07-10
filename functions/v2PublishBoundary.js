'use strict';

const { assertValidV2Plan } = require('./v2PlanValidator');
const {
  assertIdentifier,
  assertV2DraftRecord,
  assertV2PublishedRecord,
  assertV2RevisionRecord,
  assertV2WorkspaceMetadata,
} = require('./v2WorkspaceRecordValidator');

class V2WorkspaceMutationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'V2WorkspaceMutationError';
    this.code = code;
  }
}

function createV2PublishBoundary({
  db,
  newRevisionId,
  now = () => new Date(),
  workspaceId = 'main',
}) {
  if (!db || typeof db.runTransaction !== 'function') {
    throw new V2WorkspaceMutationError(
      'invalid-argument',
      'A Firestore database is required.',
    );
  }
  assertIdentifier(workspaceId, 'workspaceId');
  const refs = createWorkspaceRefs(db, workspaceId);
  const context = { db, newRevisionId, now, refs, workspaceId };

  return {
    publishDraft: (input) => publishDraft(context, input),
    publishSharedSettings: (input) => publishSharedSettings(context, input),
    revertPublished: (input) => revertPublished(context, input),
  };
}

async function publishDraft(context, input) {
  const actorUserId = readActor(input);
  const expectedRevisionId = readExpectedRevision(input);
  const changeSummary = readChangeSummary(input?.changeSummary);
  const nowIso = readNowIso(context.now);
  const draftRef = context.refs.drafts.doc(actorUserId);
  const revisionRef = createRevisionRef(context, 'publishDraft', nowIso);

  return context.db.runTransaction(async (transaction) => {
    const [metadataSnapshot, publishedSnapshot, draftSnapshot, collision] =
      await Promise.all([
        transaction.get(context.refs.metadata),
        transaction.get(context.refs.published),
        transaction.get(draftRef),
        transaction.get(revisionRef),
      ]);
    const metadata = requireSnapshot(metadataSnapshot, 'workspace');
    assertV2WorkspaceMetadata(metadata, context.workspaceId);
    const mismatch = revisionConflict(metadata, expectedRevisionId);
    if (mismatch) return mismatch;
    const current = requireSnapshot(publishedSnapshot, 'published plan');
    assertV2PublishedRecord(current, metadata.publishedRevisionId);
    const draft = requireSnapshot(draftSnapshot, 'private draft');
    assertV2DraftRecord(draft, actorUserId);
    if (draft.baseRevisionId !== expectedRevisionId) {
      return draftConflict(metadata, expectedRevisionId, draft.baseRevisionId);
    }
    assertRevisionAvailable(collision, revisionRef.id);

    const plan = { ...draft.plan, updatedAtIso: nowIso };
    assertValidV2Plan(plan);
    const publication = buildPublication(
      plan,
      actorUserId,
      revisionRef.id,
      nowIso,
    );
    const revision = { ...publication, changeSummary };
    assertV2PublishedRecord(publication, revisionRef.id);
    assertV2RevisionRecord(revision, revisionRef.id);
    writePublication(
      transaction,
      context.refs,
      revisionRef,
      metadata,
      publication,
      revision,
    );
    transaction.delete(draftRef);
    return committed(nowIso, revisionRef.id);
  });
}

async function revertPublished(context, input) {
  const actorUserId = readActor(input);
  const expectedRevisionId = readExpectedRevision(input);
  const selectedRevisionId = readIdentifier(input?.revisionId, 'revisionId');
  const nowIso = readNowIso(context.now);
  const selectedRef = context.refs.revisions.doc(selectedRevisionId);
  const nextRevisionRef = createRevisionRef(context, 'revertPublished', nowIso);
  const draftRef = context.refs.drafts.doc(actorUserId);

  return context.db.runTransaction(async (transaction) => {
    const [metadataSnapshot, publishedSnapshot, selectedSnapshot, collision] =
      await Promise.all([
        transaction.get(context.refs.metadata),
        transaction.get(context.refs.published),
        transaction.get(selectedRef),
        transaction.get(nextRevisionRef),
      ]);
    const metadata = requireSnapshot(metadataSnapshot, 'workspace');
    assertV2WorkspaceMetadata(metadata, context.workspaceId);
    const mismatch = revisionConflict(metadata, expectedRevisionId);
    if (mismatch) return mismatch;
    const current = requireSnapshot(publishedSnapshot, 'published plan');
    assertV2PublishedRecord(current, metadata.publishedRevisionId);
    const selected = requireSnapshot(selectedSnapshot, 'selected revision');
    assertV2RevisionRecord(selected, selectedRevisionId);
    assertRevisionAvailable(collision, nextRevisionRef.id);

    const plan = { ...selected.plan, updatedAtIso: nowIso };
    assertValidV2Plan(plan);
    const publication = buildPublication(
      plan,
      actorUserId,
      nextRevisionRef.id,
      nowIso,
    );
    const revision = {
      ...publication,
      changeSummary: `Restored ${selectedRevisionId}`,
    };
    assertV2PublishedRecord(publication, nextRevisionRef.id);
    assertV2RevisionRecord(revision, nextRevisionRef.id);
    writePublication(
      transaction,
      context.refs,
      nextRevisionRef,
      metadata,
      publication,
      revision,
    );
    transaction.delete(draftRef);
    return committed(nowIso, nextRevisionRef.id);
  });
}

async function publishSharedSettings(context, input) {
  const actorUserId = readActor(input);
  const expectedRevisionId = readExpectedRevision(input);
  assertValidV2Plan(input?.plan);
  const nowIso = readNowIso(context.now);
  const draftRef = context.refs.drafts.doc(actorUserId);
  const revisionRef = createRevisionRef(
    context,
    'publishSharedSettings',
    nowIso,
  );

  return context.db.runTransaction(async (transaction) => {
    const [metadataSnapshot, publishedSnapshot, draftSnapshot, collision] =
      await Promise.all([
        transaction.get(context.refs.metadata),
        transaction.get(context.refs.published),
        transaction.get(draftRef),
        transaction.get(revisionRef),
      ]);
    const metadata = requireSnapshot(metadataSnapshot, 'workspace');
    assertV2WorkspaceMetadata(metadata, context.workspaceId);
    const mismatch = revisionConflict(metadata, expectedRevisionId);
    if (mismatch) return mismatch;
    const current = requireSnapshot(publishedSnapshot, 'published plan');
    assertV2PublishedRecord(current, metadata.publishedRevisionId);
    const draft = snapshotExists(draftSnapshot) ? draftSnapshot.data() : null;
    if (draft) {
      assertV2DraftRecord(draft, actorUserId);
      if (draft.baseRevisionId !== expectedRevisionId) {
        return draftConflict(
          metadata,
          expectedRevisionId,
          draft.baseRevisionId,
        );
      }
    }
    assertRevisionAvailable(collision, revisionRef.id);

    const plan = applySharedLocationClimate(current.plan, input.plan, nowIso);
    assertValidV2Plan(plan);
    const publication = buildPublication(
      plan,
      actorUserId,
      revisionRef.id,
      nowIso,
    );
    const revision = {
      ...publication,
      changeSummary: 'Updated shared garden location and climate',
    };
    assertV2PublishedRecord(publication, revisionRef.id);
    assertV2RevisionRecord(revision, revisionRef.id);
    writePublication(
      transaction,
      context.refs,
      revisionRef,
      metadata,
      publication,
      revision,
    );
    if (draft) {
      const rebasedPlan = applySharedLocationClimate(
        draft.plan,
        input.plan,
        nowIso,
      );
      assertValidV2Plan(rebasedPlan);
      const rebasedDraft = {
        ...draft,
        baseRevisionId: revisionRef.id,
        plan: rebasedPlan,
        updatedAtIso: nowIso,
      };
      assertV2DraftRecord(rebasedDraft, actorUserId);
      transaction.set(draftRef, rebasedDraft);
    }
    return committed(nowIso, revisionRef.id);
  });
}

function applySharedLocationClimate(base, supplied, updatedAtIso) {
  return {
    ...base,
    plot: {
      ...base.plot,
      climate: { ...supplied.plot.climate },
      location: {
        ...supplied.plot.location,
        coordinates: supplied.plot.location.coordinates
          ? { ...supplied.plot.location.coordinates }
          : null,
      },
    },
    updatedAtIso,
  };
}

function buildPublication(plan, actorUserId, revisionId, nowIso) {
  return {
    plan,
    publishedAtIso: nowIso,
    publishedByUserId: actorUserId,
    revisionId,
  };
}

function writePublication(
  transaction,
  refs,
  revisionRef,
  metadata,
  publication,
  revision,
) {
  transaction.set(refs.published, publication);
  transaction.set(revisionRef, revision);
  transaction.set(refs.metadata, {
    ...metadata,
    publishedRevisionId: revisionRef.id,
    updatedAtIso: publication.publishedAtIso,
  });
}

function createWorkspaceRefs(db, workspaceId) {
  const metadata = db.collection('gardenWorkspaces').doc(workspaceId);
  return {
    drafts: metadata.collection('drafts'),
    metadata,
    published: metadata.collection('plans').doc('published'),
    revisions: metadata.collection('revisions'),
  };
}

function createRevisionRef(context, operation, nowIso) {
  const requestedId = context.newRevisionId?.({ nowIso, operation });
  const ref = requestedId
    ? context.refs.revisions.doc(readIdentifier(requestedId, 'newRevisionId'))
    : context.refs.revisions.doc();
  assertIdentifier(ref.id, 'newRevisionId');
  return ref;
}

function readActor(input) {
  return readIdentifier(input?.actorUserId, 'actorUserId');
}

function readExpectedRevision(input) {
  return readIdentifier(input?.expectedRevisionId, 'expectedRevisionId');
}

function readIdentifier(value, label) {
  try {
    return assertIdentifier(value, label);
  } catch (error) {
    throw new V2WorkspaceMutationError('invalid-argument', error.message);
  }
}

function readChangeSummary(value) {
  if (typeof value !== 'string') {
    throw new V2WorkspaceMutationError(
      'invalid-argument',
      'changeSummary must be text.',
    );
  }
  const summary = value.trim() || 'Published garden plan';
  if (summary.length > 500) {
    throw new V2WorkspaceMutationError(
      'invalid-argument',
      'changeSummary must not exceed 500 characters.',
    );
  }
  return summary;
}

function readNowIso(now) {
  const value = now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new V2WorkspaceMutationError(
      'failed-precondition',
      'The server clock did not return a valid instant.',
    );
  }
  return value.toISOString();
}

function requireSnapshot(snapshot, label) {
  if (!snapshotExists(snapshot)) {
    throw new V2WorkspaceMutationError('not-found', `${label} was not found.`);
  }
  return snapshot.data();
}

function snapshotExists(snapshot) {
  return typeof snapshot?.exists === 'function'
    ? snapshot.exists()
    : snapshot?.exists === true;
}

function assertRevisionAvailable(snapshot, revisionId) {
  if (snapshotExists(snapshot)) {
    throw new V2WorkspaceMutationError(
      'already-exists',
      `Revision ${revisionId} already exists and cannot be overwritten.`,
    );
  }
}

function revisionConflict(metadata, expectedRevisionId) {
  if (metadata.publishedRevisionId === expectedRevisionId) return null;
  return {
    actualRevisionId: metadata.publishedRevisionId,
    expectedRevisionId,
    reason: 'published-revision-mismatch',
    status: 'conflict',
  };
}

function draftConflict(metadata, expectedRevisionId, draftBaseRevisionId) {
  return {
    actualRevisionId: metadata.publishedRevisionId,
    draftBaseRevisionId,
    expectedRevisionId,
    reason: 'draft-base-mismatch',
    status: 'conflict',
  };
}

function committed(committedAtIso, revisionId) {
  return { committedAtIso, revisionId, status: 'committed' };
}

module.exports = {
  V2WorkspaceMutationError,
  applySharedLocationClimate,
  createV2PublishBoundary,
};
