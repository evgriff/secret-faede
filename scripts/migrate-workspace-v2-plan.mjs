import {
  addDeprecatedCollectionActions,
  addDraftWrites,
  addOperationWrites,
  addProfileWrites,
  addRevisionActions,
  addWaterCandidateWrites,
  ensureCurrentRevision,
  mergeOperationSources,
} from './migrate-workspace-v2-plan-actions.mjs';
import {
  collectionsAreCurrent,
  emptyPlan,
  isCurrentCore,
  orderActions,
  readLegacyPublication,
  safeId,
  write,
} from './migrate-workspace-v2-plan-shapes.mjs';
import { preflightLegacyPlanSources } from './migrate-workspace-v2-preflight.mjs';

export { migrateLegacyProfile } from './migrate-workspace-v2-plan-shapes.mjs';

export async function buildMigrationPlan({
  collections = {},
  migrateGarden,
  migrateOperations,
  nowIso,
  publishedDocument,
  workspace,
}) {
  const coreCurrent = isCurrentCore(workspace, publishedDocument);
  const currentRevisionId = workspace?.publishedRevisionId;
  if (coreCurrent && collectionsAreCurrent(collections, currentRevisionId)) {
    return emptyPlan();
  }

  const sourcePublication = readLegacyPublication(workspace, publishedDocument);
  const now = new Date(nowIso);
  const revisionId = coreCurrent
    ? currentRevisionId
    : `migration-v2-${safeId(sourcePublication?.id || 'published')}`;
  const rawOperations = mergeOperationSources(
    collections.drafts ?? [],
    sourcePublication?.garden,
    collections,
  );
  const preflight = preflightLegacyPlanSources({
    collections,
    coreCurrent,
    migrateGarden,
    now,
    publishedGarden: sourcePublication?.garden
      ? { ...sourcePublication.garden, ...rawOperations }
      : null,
  });
  const migrated =
    preflight.publishedMigration ?? migrateOperations(rawOperations, now);
  const actions = [];
  const warnings = coreCurrent
    ? [...(migrated.warnings ?? [])]
    : [...(preflight.warnings ?? [])];
  const archivedLegacy = {
    notifications:
      migrated.archived?.notifications ?? rawOperations.notificationLogs.length,
    recommendations: 0,
    revisions: 0,
    waterApplications: 0,
    wateringSchedule:
      migrated.archived?.wateringSchedule ??
      rawOperations.wateringSchedule.length,
    weatherSnapshots:
      migrated.archived?.weatherSnapshots ??
      rawOperations.weatherSnapshots.length,
  };
  for (const [label, count] of [
    ['notification records', archivedLegacy.notifications],
    ['watering schedule records', archivedLegacy.wateringSchedule],
    ['weather snapshots', archivedLegacy.weatherSnapshots],
  ]) {
    if (count > 0) {
      warnings.push(
        `${count} legacy ${label} are archived/non-authoritative and are not v2 model state.`,
      );
    }
  }

  if (preflight.blockers.length > 0) {
    return {
      actions: [],
      alreadyCurrent: false,
      archivedLegacy,
      blockers: preflight.blockers,
      canApply: false,
      revisionId,
      warnings,
    };
  }

  addOperationWrites(actions, migrated.operations);
  addWaterCandidateWrites(
    actions,
    migrated.waterApplications,
    nowIso,
    warnings,
  );
  addDraftWrites(
    actions,
    collections.drafts ?? [],
    migrateGarden,
    revisionId,
    now,
    warnings,
  );
  addProfileWrites(actions, collections.profiles ?? [], nowIso);
  addRevisionActions(
    actions,
    collections.revisions ?? [],
    migrateGarden,
    now,
    nowIso,
    warnings,
    archivedLegacy,
  );
  addDeprecatedCollectionActions(actions, collections, nowIso, archivedLegacy);

  if (coreCurrent) {
    ensureCurrentRevision(
      actions,
      collections.revisions ?? [],
      publishedDocument,
    );
  } else {
    const published = {
      plan: migrated.plan,
      publishedAtIso: nowIso,
      publishedByUserId: sourcePublication.publishedByUserId || 'migration',
      revisionId,
    };
    actions.push(
      write('gardenWorkspaces/main/plans/published', published, 'core'),
      write(
        `gardenWorkspaces/main/revisions/${revisionId}`,
        {
          ...published,
          changeSummary: 'Migrated legacy published garden to schema 9',
        },
        'core',
      ),
      write(
        'gardenWorkspaces/main',
        {
          ...(workspace?.operationsAutomation
            ? { operationsAutomation: workspace.operationsAutomation }
            : {}),
          id: 'main',
          publishedRevisionId: revisionId,
          schemaVersion: 2,
          updatedAtIso: nowIso,
        },
        'metadata',
      ),
    );
  }
  return {
    actions: orderActions(actions),
    alreadyCurrent: false,
    archivedLegacy,
    blockers: [],
    canApply: true,
    revisionId,
    warnings,
  };
}
