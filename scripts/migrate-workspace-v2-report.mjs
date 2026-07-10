export function buildMigrationReport({
  applyStatus,
  backupPath,
  options,
  plan,
}) {
  const blockers = plan.blockers ?? [];
  return {
    actionPlan: summarizeActions(plan.actions ?? []),
    alreadyCurrent: plan.alreadyCurrent,
    applyStatus,
    archivedLegacy: plan.archivedLegacy,
    backupPath,
    blockerCount: blockers.length,
    blockerSummary: summarizeBlockers(blockers),
    canApply: plan.canApply !== false && blockers.length === 0,
    dryRun: options.dryRun,
    projectId: options.projectId,
    revisionPlanned: Boolean(plan.revisionId),
    warningCount: (plan.warnings ?? []).length,
    warningSummary: summarizeWarnings(plan.warnings ?? []),
  };
}

export function summarizeActions(actions) {
  const summaries = new Map();
  for (const action of actions) {
    const phase = action.phase ?? 'data';
    const target = redactActionTarget(action.path);
    const key = `${phase}\u0000${action.kind}\u0000${target}`;
    const current = summaries.get(key);
    if (current) current.count += 1;
    else summaries.set(key, { count: 1, kind: action.kind, phase, target });
  }
  return [...summaries.values()].sort((left, right) =>
    `${left.phase}/${left.kind}/${left.target}`.localeCompare(
      `${right.phase}/${right.kind}/${right.target}`,
    ),
  );
}

export function summarizeBlockers(blockers) {
  const summaries = new Map();
  for (const blocker of blockers) {
    const scope = blocker.scope ?? 'published';
    const sourceNumber = blocker.sourceNumber ?? null;
    const key = `${scope}\u0000${sourceNumber ?? ''}\u0000${blocker.code}`;
    const current = summaries.get(key) ?? {
      code: blocker.code,
      count: 0,
      plantingNumbers: [],
      scope,
      ...(sourceNumber ? { sourceNumber } : {}),
    };
    current.count += 1;
    if (
      blocker.plantingNumber &&
      !current.plantingNumbers.includes(blocker.plantingNumber)
    ) {
      current.plantingNumbers.push(blocker.plantingNumber);
    }
    summaries.set(key, current);
  }
  return [...summaries.values()]
    .map((summary) => ({
      ...summary,
      plantingNumbers: summary.plantingNumbers.sort(
        (left, right) => left - right,
      ),
    }))
    .sort((left, right) =>
      `${left.scope}/${left.sourceNumber ?? 0}/${left.code}`.localeCompare(
        `${right.scope}/${right.sourceNumber ?? 0}/${right.code}`,
      ),
    );
}

export function summarizeWarnings(warnings) {
  const counts = new Map();
  for (const warning of warnings) {
    const category = warningCategory(String(warning));
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => left.category.localeCompare(right.category));
}

function redactActionTarget(path) {
  const parts = String(path).split('/').filter(Boolean);
  if (parts[0] === 'gardenWorkspaces' && parts[1] === 'main') {
    if (parts.length === 2) return 'gardenWorkspaces/main';
    if (parts[2] === 'plans' && parts[3] === 'published') {
      return 'gardenWorkspaces/main/plans/published';
    }
    return `gardenWorkspaces/main/${parts[2] ?? 'unknown'}/<redacted>`;
  }
  if (parts[0] === 'users') return 'users/<redacted>';
  return `${parts[0] ?? 'unknown'}/<redacted>`;
}

function warningCategory(warning) {
  if (/coordinate/i.test(warning)) return 'coordinates-cleared';
  if (/timezone/i.test(warning)) return 'timezone-replaced';
  if (/photo|storage path|content type/i.test(warning)) {
    return 'legacy-photo-archived';
  }
  if (/skip\/rain|skipped water/i.test(warning)) {
    return 'skipped-water-uncredited';
  }
  if (/explicit amount|not credited|not assigned/i.test(warning)) {
    return 'unmeasured-water-uncredited';
  }
  if (/footprint was minimally expanded/i.test(warning)) {
    return 'planting-footprint-expanded';
  }
  if (/revision/i.test(warning)) return 'legacy-revision-archived';
  if (/archived|non-authoritative/i.test(warning)) {
    return 'legacy-records-archived';
  }
  return 'other';
}
