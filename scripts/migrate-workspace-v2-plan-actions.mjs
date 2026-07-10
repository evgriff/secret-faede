import {
  addMigrationActorToWaterApplication,
  iso,
  isV2Draft,
  isV2Profile,
  isV2Recommendation,
  isV2Revision,
  isV2WaterApplication,
  isV2Weather,
  migrateLegacyProfile,
  remove,
  revisionSummary,
  safeId,
  text,
  write,
} from './migrate-workspace-v2-plan-shapes.mjs';

export function addOperationWrites(actions, operations) {
  for (const [collection, items] of [
    ['journal', operations.journal],
    ['harvests', operations.harvests],
    ['tasks', operations.tasks],
    ['waterApplications', operations.waterApplications],
  ]) {
    for (const item of items ?? []) {
      actions.push(
        write(`gardenWorkspaces/main/${collection}/${item.id}`, item),
      );
    }
  }
}

export function addWaterCandidateWrites(actions, candidates, nowIso, warnings) {
  const seen = new Set();
  for (const candidate of candidates ?? []) {
    if (!candidate.plantingGroupId) {
      warnings.push(
        `${candidate.legacyJournalId}: explicit water was not assigned to one crop group and was not credited.`,
      );
      continue;
    }
    const id = `migration-${safeId(candidate.legacyJournalId)}`;
    if (seen.has(id)) continue;
    seen.add(id);
    actions.push(
      write(`gardenWorkspaces/main/waterApplications/${id}`, {
        amount: { depthInches: candidate.actualAmountInches, unit: 'inches' },
        appliedAtIso: `${candidate.occurredOn}T12:00:00.000Z`,
        cropGroupId: candidate.plantingGroupId,
        efficiency: { confidence: 'low', fraction: 1, source: 'estimated' },
        id,
        method: 'other',
        outcome: 'applied',
        recordedAtIso: nowIso,
        recordedByUserId: 'migration',
        revision: 1,
      }),
    );
  }
}

export function addDraftWrites(
  actions,
  drafts,
  migrateGarden,
  revisionId,
  now,
  warnings,
) {
  for (const draft of drafts) {
    if (!draft.id || isV2Draft(draft)) continue;
    if (!draft.data?.garden) {
      archiveAndDelete(
        actions,
        'drafts',
        draft,
        now.toISOString(),
        'invalid draft',
      );
      continue;
    }
    const migrated = migrateGarden(draft.data.garden, now);
    actions.push(
      write(`gardenWorkspaces/main/drafts/${draft.id}`, {
        baseRevisionId: revisionId,
        plan: migrated.plan,
        updatedAtIso: now.toISOString(),
        userId: draft.id,
      }),
    );
    warnings.push(
      ...(migrated.warnings ?? []).map((item) => `${draft.id}: ${item}`),
    );
  }
}

export function addProfileWrites(actions, profiles, nowIso) {
  for (const profile of profiles) {
    if (!profile.id || isV2Profile(profile.data)) continue;
    actions.push(
      write(
        `users/${profile.id}`,
        migrateLegacyProfile(profile.data, profile.id, nowIso),
      ),
    );
  }
}

export function addRevisionActions(
  actions,
  revisions,
  migrateGarden,
  now,
  nowIso,
  warnings,
  archived,
) {
  for (const revision of revisions) {
    if (!revision.id || isV2Revision(revision)) continue;
    archived.revisions += 1;
    archiveDocument(
      actions,
      'revisions',
      revision,
      nowIso,
      'exact legacy revision archived before schema 9 conversion',
    );
    try {
      const plan =
        revision.data?.plan?.schemaVersion === 9
          ? revision.data.plan
          : migrateGarden(revision.data?.garden, now).plan;
      actions.push(
        write(`gardenWorkspaces/main/revisions/${revision.id}`, {
          changeSummary: revisionSummary(revision.data),
          plan,
          publishedAtIso: iso(revision.data?.publishedAtIso, nowIso),
          publishedByUserId:
            text(revision.data?.publishedByUserId) || 'migration',
          revisionId: revision.id,
        }),
      );
    } catch (error) {
      warnings.push(
        `${revision.id}: revision was archived because conversion failed (${String(error)}).`,
      );
      actions.push(remove(`gardenWorkspaces/main/revisions/${revision.id}`));
    }
  }
}

export function addDeprecatedCollectionActions(
  actions,
  collections,
  nowIso,
  archived,
) {
  for (const collection of ['notifications', 'wateringSchedule']) {
    for (const document of collections[collection] ?? []) {
      archiveAndDelete(
        actions,
        collection,
        document,
        nowIso,
        'retired v1 operation',
      );
    }
  }
  for (const document of collections.weatherSnapshots ?? []) {
    if (!isV2Weather(document.data)) {
      archiveAndDelete(
        actions,
        'weatherSnapshots',
        document,
        nowIso,
        'legacy weather',
      );
    }
  }
  for (const [collection, predicate, countKey] of [
    ['waterApplications', isV2WaterApplication, 'waterApplications'],
    ['wateringRecommendations', isV2Recommendation, 'recommendations'],
  ]) {
    for (const document of collections[collection] ?? []) {
      if (predicate(document.data)) continue;
      if (collection === 'waterApplications') {
        const upgraded = addMigrationActorToWaterApplication(document.data);
        if (upgraded) {
          const path = `gardenWorkspaces/main/waterApplications/${document.id}`;
          if (
            !actions.some(
              (action) => action.kind === 'write' && action.path === path,
            )
          ) {
            actions.push(write(path, upgraded));
          }
          continue;
        }
      }
      archived[countKey] += 1;
      archiveAndDelete(
        actions,
        collection,
        document,
        nowIso,
        'incompatible v1 data',
      );
    }
  }
}

export function ensureCurrentRevision(actions, revisions, published) {
  const path = `gardenWorkspaces/main/revisions/${published.revisionId}`;
  if (
    actions.some((action) => action.kind === 'write' && action.path === path) ||
    revisions.some(
      (item) => item.id === published.revisionId && isV2Revision(item),
    )
  ) {
    return;
  }
  actions.push(
    write(path, {
      ...published,
      changeSummary: 'Recovered current schema 9 publication',
    }),
  );
}

export function mergeOperationSources(drafts, publishedGarden, collections) {
  const draftGardens = [...drafts]
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    .map((item) => item.data?.garden)
    .filter(Boolean);
  const sources = [
    ...draftGardens,
    publishedGarden ?? {},
    collectionSource(collections),
  ];
  return {
    harvestEvents: mergeRecords(sources.map((item) => item.harvestEvents)),
    journalEntries: mergeRecords(sources.map((item) => item.journalEntries)),
    notificationLogs: mergeRecords(
      sources.map((item) => item.notificationLogs),
    ),
    tasks: mergeRecords(sources.map((item) => item.tasks)),
    waterApplications: mergeRecords(
      sources.map((item) => item.waterApplications),
    ),
    wateringRecommendations: mergeRecords(
      sources.map((item) => item.wateringRecommendations),
    ),
    wateringSchedule: mergeRecords(
      sources.map((item) => item.wateringSchedule),
    ),
    weatherSnapshots: mergeRecords(
      sources.map((item) => item.weatherSnapshots),
    ),
  };
}

function collectionSource(collections) {
  const data = (name) =>
    (collections[name] ?? []).map((item) => ({
      ...item.data,
      id: text(item.data?.id) || item.id,
    }));
  return {
    harvestEvents: data('harvests'),
    journalEntries: data('journal'),
    notificationLogs: data('notifications'),
    tasks: data('tasks'),
    waterApplications: data('waterApplications'),
    wateringRecommendations: data('wateringRecommendations'),
    wateringSchedule: data('wateringSchedule'),
    weatherSnapshots: data('weatherSnapshots'),
  };
}

function mergeRecords(sources) {
  const byId = new Map();
  for (const source of sources) {
    for (const value of source ?? []) {
      const id = text(value?.id);
      if (id) byId.set(id, value);
    }
  }
  return [...byId.values()].sort((left, right) =>
    String(left.id).localeCompare(String(right.id)),
  );
}

function archiveAndDelete(actions, collection, document, nowIso, reason) {
  archiveDocument(actions, collection, document, nowIso, reason);
  if (!document.id) return;
  actions.push(remove(`gardenWorkspaces/main/${collection}/${document.id}`));
}

function archiveDocument(actions, collection, document, nowIso, reason) {
  if (!document.id) return;
  const archiveCollection =
    collection === 'revisions'
      ? 'legacyRevisionArchive'
      : 'legacyOperationArchive';
  const archiveId = `${safeId(collection)}--${safeId(document.id)}`;
  actions.push(
    write(
      `gardenWorkspaces/main/${archiveCollection}/${archiveId}`,
      {
        archivedAtIso: nowIso,
        legacyData: document.data ?? {},
        reason,
        sourceCollection: collection,
        sourceId: document.id,
      },
      'archive',
    ),
  );
}
