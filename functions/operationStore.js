'use strict';

const {
  formatLocalDate,
  isUserDueForWateringCheck,
} = require('./operationTime');
const { validateCanonicalWorkspace } = require('./operationValidation');

const RUN_LEASE_MS = 15 * 60 * 1000;
const collectionNames = [
  'alerts',
  'tasks',
  'waterApplications',
  'waterBalances',
  'wateringRecommendations',
  'weatherSnapshots',
];
const taskActionFields = ['completedAtIso', 'dueOn', 'status', 'updatedAtIso'];

async function claimCanonicalOperationRun({ db, force, now, runId }) {
  const metadataRef = getMetadataRef(db);
  const publishedRef = getPublishedRef(db);

  return db.runTransaction(async (transaction) => {
    const [metadataSnapshot, publishedSnapshot] = await Promise.all([
      transaction.get(metadataRef),
      transaction.get(publishedRef),
    ]);
    const metadata = metadataSnapshot.exists ? metadataSnapshot.data() : null;
    const published = publishedSnapshot.exists
      ? publishedSnapshot.data()
      : null;
    const validation = validateCanonicalWorkspace({ metadata, published });

    if (!validation.valid) {
      return {
        claimed: false,
        reason:
          metadata || published ? 'invalidWorkspace' : 'noPublishedGarden',
        validationErrors: validation.errors,
      };
    }

    const timezone = validation.operationsSettings.timezone;
    const localDate = formatLocalDate(now, timezone);
    const automation = isRecord(metadata.operationsAutomation)
      ? metadata.operationsAutomation
      : {};
    const activeRun = isRecord(automation.activeRun)
      ? automation.activeRun
      : null;

    if (Date.parse(activeRun?.leaseUntilIso || '') > now.getTime()) {
      return { claimed: false, reason: 'runInProgress' };
    }
    if (
      !force &&
      !isUserDueForWateringCheck(
        {
          notificationPreference: {
            defaultWateringCheckTime:
              validation.operationsSettings.defaultWateringCheckTime,
            timezone,
          },
        },
        now,
      )
    ) {
      return { claimed: false, reason: 'notDue' };
    }
    if (!force && automation.lastGeneratedLocalDate === localDate) {
      return { claimed: false, reason: 'alreadyGenerated' };
    }

    transaction.set(
      metadataRef,
      {
        operationsAutomation: {
          ...automation,
          activeRun: {
            claimedAtIso: now.toISOString(),
            leaseUntilIso: new Date(now.getTime() + RUN_LEASE_MS).toISOString(),
            localDate,
            revisionId: validation.revisionId,
            runId,
          },
          checkTimeLocal:
            validation.operationsSettings.defaultWateringCheckTime,
        },
      },
      { merge: true },
    );
    return {
      claimed: true,
      localDate,
      operationsSettings: validation.operationsSettings,
      plan: validation.plan,
      revisionId: validation.revisionId,
      runId,
      validationWarnings: validation.warnings,
    };
  });
}

async function loadSharedOperations(db) {
  const entries = await Promise.all(
    collectionNames.map(async (name) => [name, await readCollection(db, name)]),
  );
  return Object.fromEntries(entries);
}

async function commitCanonicalOperations({ admin, claim, db, result, shared }) {
  const metadataRef = getMetadataRef(db);
  const taskInputs = uniqueById(result.tasks);
  const balances = uniqueById(result.waterBalances, 'cropGroupId');
  const recommendations = uniqueById(
    result.recommendations.map((recommendation) => ({
      ...recommendation,
      workspaceRevisionId: claim.revisionId,
    })),
    (item) => item.target.cropGroupId,
  );
  const taskRefs = taskInputs.map((item) => getDocRef(db, 'tasks', item.id));
  const balanceRefs = balances.map((item) =>
    getDocRef(db, 'waterBalances', item.cropGroupId),
  );
  const recommendationRefs = recommendations.map((item) =>
    getDocRef(db, 'wateringRecommendations', item.target.cropGroupId),
  );

  return db.runTransaction(async (transaction) => {
    const metadataSnapshot = await transaction.get(metadataRef);
    const metadata = metadataSnapshot.exists ? metadataSnapshot.data() : null;
    const activeRun = metadata?.operationsAutomation?.activeRun;

    if (
      metadata?.publishedRevisionId !== claim.revisionId ||
      activeRun?.runId !== claim.runId
    ) {
      await clearConflictInTransaction(
        transaction,
        metadataRef,
        metadata,
        claim.runId,
        result.generatedAtIso,
      );
      return { committed: false, reason: 'revisionChanged' };
    }

    const [applicationSnapshot, taskSnapshots, balanceSnapshots, recSnapshots] =
      await Promise.all([
        transaction.get(getCollectionRef(db, 'waterApplications')),
        Promise.all(taskRefs.map((ref) => transaction.get(ref))),
        Promise.all(balanceRefs.map((ref) => transaction.get(ref))),
        Promise.all(recommendationRefs.map((ref) => transaction.get(ref))),
      ]);
    const currentApplications = applicationSnapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    }));

    if (
      applicationFingerprint(currentApplications) !==
      applicationFingerprint(shared.waterApplications)
    ) {
      transaction.set(
        metadataRef,
        {
          operationsAutomation: {
            ...metadata.operationsAutomation,
            activeRun: null,
            lastConflictAtIso: result.generatedAtIso,
            lastConflictReason: 'waterApplicationsChanged',
          },
        },
        { merge: true },
      );
      return { committed: false, reason: 'sharedOperationsChanged' };
    }

    const baseTasks = mapById(shared.tasks);
    const committedTasks = [];
    taskInputs.forEach((next, index) => {
      const snapshot = taskSnapshots[index];
      const current = snapshot.exists
        ? { id: next.id, ...snapshot.data() }
        : null;
      const committedTask = pruneUndefined(
        preserveConcurrentAction(
          baseTasks.get(next.id),
          current,
          next,
          taskActionFields,
        ),
      );
      committedTasks.push(committedTask);
      transaction.set(taskRefs[index], committedTask);
    });
    balances.forEach((balance, index) => {
      const current = balanceSnapshots[index].exists
        ? balanceSnapshots[index].data()
        : null;
      transaction.set(
        balanceRefs[index],
        pruneUndefined(current?.asOfIso > balance.asOfIso ? current : balance),
      );
    });
    recommendations.forEach((recommendation, index) => {
      const current = recSnapshots[index].exists
        ? recSnapshots[index].data()
        : null;
      transaction.set(
        recommendationRefs[index],
        pruneUndefined(
          current?.calculatedAtIso > recommendation.calculatedAtIso
            ? current
            : recommendation,
        ),
      );
    });
    transaction.set(
      getDocRef(db, 'weatherSnapshots', result.snapshot.id),
      pruneUndefined(result.snapshot),
    );
    transaction.set(
      metadataRef,
      {
        operationsAutomation: {
          ...metadata.operationsAutomation,
          activeRun: null,
          lastGeneratedAtIso: result.generatedAtIso,
          lastGeneratedLocalDate: claim.localDate,
          lastProviderId: result.providerId,
          lastRevisionId: claim.revisionId,
        },
        sharedOperationsUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        sharedOperationsUpdatedAtIso: result.generatedAtIso,
      },
      { merge: true },
    );
    return { committed: true, tasks: committedTasks };
  });
}

async function releaseOperationClaim({ db, error, now, runId }) {
  const ref = getMetadataRef(db);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return;
    const metadata = snapshot.data();
    if (metadata.operationsAutomation?.activeRun?.runId !== runId) return;
    transaction.set(
      ref,
      {
        operationsAutomation: {
          ...metadata.operationsAutomation,
          activeRun: null,
          lastErrorAtIso: now.toISOString(),
          lastErrorMessage:
            error instanceof Error ? error.message : String(error),
        },
      },
      { merge: true },
    );
  });
}

function preserveConcurrentAction(base, current, next, fields) {
  if (!current) return next;
  const changed =
    !base ||
    fields.some(
      (field) => JSON.stringify(current[field]) !== JSON.stringify(base[field]),
    );
  if (!changed) return next;
  return fields.reduce(
    (merged, field) =>
      current[field] === undefined
        ? merged
        : { ...merged, [field]: current[field] },
    { ...next },
  );
}

async function clearConflictInTransaction(
  transaction,
  ref,
  metadata,
  runId,
  nowIso,
) {
  if (metadata?.operationsAutomation?.activeRun?.runId === runId) {
    transaction.set(
      ref,
      {
        operationsAutomation: {
          ...metadata.operationsAutomation,
          activeRun: null,
          lastConflictAtIso: nowIso,
          lastConflictReason: 'publishedRevisionChanged',
        },
      },
      { merge: true },
    );
  }
}

async function readCollection(db, name) {
  const snapshot = await getCollectionRef(db, name).get();
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

function applicationFingerprint(applications) {
  return applications
    .map((item) => `${item.id}:${item.revision}:${item.recordedAtIso}`)
    .sort()
    .join('|');
}

function uniqueById(items, key = 'id') {
  const getId = typeof key === 'function' ? key : (item) => item[key];
  return [...new Map(items.map((item) => [getId(item), item])).values()];
}

function mapById(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function pruneUndefined(value) {
  if (Array.isArray(value)) return value.map(pruneUndefined);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, pruneUndefined(entry)]),
  );
}

function getMetadataRef(db) {
  return db.collection('gardenWorkspaces').doc('main');
}

function getPublishedRef(db) {
  return getMetadataRef(db).collection('plans').doc('published');
}

function getCollectionRef(db, name) {
  return getMetadataRef(db).collection(name);
}

function getDocRef(db, name, id) {
  return getCollectionRef(db, name).doc(id);
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

module.exports = {
  claimCanonicalOperationRun,
  commitCanonicalOperations,
  loadSharedOperations,
  preserveConcurrentAction,
  pruneUndefined,
  releaseOperationClaim,
};
