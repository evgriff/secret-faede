import {
  isV2Draft,
  isV2Revision,
} from './migrate-workspace-v2-plan-shapes.mjs';

export function preflightLegacyPlanSources({
  collections,
  coreCurrent,
  migrateGarden,
  now,
  publishedGarden,
}) {
  const blockers = [];
  const warnings = [];
  const inspect = (garden, scope, sourceNumber) => {
    if (!garden) {
      blockers.push({
        code: 'missing-legacy-source',
        scope,
        ...(sourceNumber ? { sourceNumber } : {}),
      });
      return null;
    }
    try {
      const result = migrateGarden(garden, now);
      if (!result?.plan) {
        blockers.push({
          code: 'invalid-plan',
          scope,
          ...(sourceNumber ? { sourceNumber } : {}),
        });
      }
      for (const blocker of result.blockers ?? []) {
        blockers.push({
          ...blocker,
          scope,
          ...(sourceNumber ? { sourceNumber } : {}),
        });
      }
      warnings.push(...(result.warnings ?? []));
      return result;
    } catch {
      blockers.push({
        code: 'migration-error',
        scope,
        ...(sourceNumber ? { sourceNumber } : {}),
      });
      return null;
    }
  };

  const publishedMigration = coreCurrent
    ? null
    : inspect(publishedGarden, 'published');
  const drafts = [...(collections.drafts ?? [])]
    .filter((draft) => draft.id && !isV2Draft(draft) && draft.data?.garden)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  drafts.forEach((draft, index) => {
    inspect(draft.data.garden, 'draft', index + 1);
  });
  const revisions = [...(collections.revisions ?? [])]
    .filter(
      (revision) =>
        revision.id &&
        !isV2Revision(revision) &&
        revision.data?.plan?.schemaVersion !== 9,
    )
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  revisions.forEach((revision, index) => {
    inspect(revision.data?.garden, 'revision', index + 1);
  });

  return { blockers, publishedMigration, warnings };
}
