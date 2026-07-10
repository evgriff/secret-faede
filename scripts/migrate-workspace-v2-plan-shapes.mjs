export function migrateLegacyProfile(value, userId, nowIso) {
  const legacy = record(value);
  const preferences = record(legacy.notificationPreference);
  const alerts = record(preferences.alertTypes);
  const channels = record(preferences.channels);
  const quiet = record(preferences.quietHours);
  return {
    displayName: text(legacy.displayName) || 'Gardener',
    email: validEmail(legacy.email) || `${userId}@example.invalid`,
    notificationPreferences: {
      alertKinds: {
        frost: bool(alerts.frost, true),
        heat: bool(alerts.heat ?? alerts.heatStress, true),
        severeWeather: bool(alerts.severeWeather, true),
        taskDue: bool(alerts.taskDue, true),
        watering: bool(alerts.watering, true),
      },
      dailyCheckTime: localTime(preferences.defaultWateringCheckTime, '07:00'),
      minimumWateringDeficitInches: threshold(
        preferences.wateringAlertThresholdIn,
        0.25,
      ),
      pushEnabled: bool(channels.push, false),
      quietHours: {
        end: localTime(quiet.endLocalTime, '07:00'),
        start: localTime(quiet.startLocalTime, '21:00'),
      },
    },
    schemaVersion: 2,
    timezone: validTimezone(legacy.timezone) || 'UTC',
    updatedAtIso: nowIso,
    userId,
  };
}

export function collectionsAreCurrent(collections, revisionId) {
  return (
    (collections.revisions ?? []).some(
      (item) => item.id === revisionId && isV2Revision(item),
    ) &&
    (collections.revisions ?? []).every(isV2Revision) &&
    (collections.drafts ?? []).every(isV2Draft) &&
    (collections.profiles ?? []).every((item) => isV2Profile(item.data)) &&
    (collections.journal ?? []).every((item) => isV2Journal(item.data)) &&
    (collections.harvests ?? []).every((item) => isV2Harvest(item.data)) &&
    (collections.tasks ?? []).every((item) => isV2Task(item.data)) &&
    (collections.waterApplications ?? []).every((item) =>
      isV2WaterApplication(item.data),
    ) &&
    (collections.wateringRecommendations ?? []).every((item) =>
      isV2Recommendation(item.data),
    ) &&
    (collections.notifications ?? []).length === 0 &&
    (collections.wateringSchedule ?? []).length === 0 &&
    (collections.weatherSnapshots ?? []).every((item) => isV2Weather(item.data))
  );
}

export function isCurrentCore(workspace, published) {
  return (
    workspace?.schemaVersion === 2 &&
    typeof workspace.publishedRevisionId === 'string' &&
    isCurrentPlan(published?.plan) &&
    published.revisionId === workspace.publishedRevisionId
  );
}

export function isV2Revision(item) {
  return (
    isCurrentPlan(item?.data?.plan) &&
    item.data.revisionId === item.id &&
    typeof item.data.changeSummary === 'string'
  );
}
export function isV2Draft(item) {
  return isCurrentPlan(item?.data?.plan) && item.data.userId === item.id;
}
export function isV2Profile(data) {
  return data?.schemaVersion === 2 && data.notificationPreferences?.alertKinds;
}
export function isV2WaterApplication(data) {
  return (
    typeof data?.cropGroupId === 'string' &&
    typeof data?.recordedByUserId === 'string' &&
    Boolean(data.recordedByUserId.trim()) &&
    Number.isInteger(data?.revision) &&
    ['applied', 'partial', 'skipped'].includes(data?.outcome)
  );
}
export function addMigrationActorToWaterApplication(data) {
  if (
    typeof data?.cropGroupId !== 'string' ||
    !Number.isInteger(data?.revision) ||
    !['applied', 'partial', 'skipped'].includes(data?.outcome)
  ) {
    return null;
  }
  return { ...data, recordedByUserId: 'migration' };
}
export function isV2Recommendation(data) {
  return (
    data?.modelVersion === 'crop-water-balance-v2' &&
    data?.target?.kind === 'cropGroup' &&
    typeof data?.workspaceRevisionId === 'string' &&
    Number.isFinite(data?.forecastRainCreditInches)
  );
}
export function isV2Weather(data) {
  return (
    data?.forecastWeather &&
    data?.historicalWeather &&
    typeof data?.providerId === 'string'
  );
}

export function readLegacyPublication(workspace, published) {
  if (workspace?.garden) return workspace;
  if (workspace?.published?.garden) return workspace.published;
  if (published?.garden) return published;
  return null;
}

function isCurrentPlan(plan) {
  return (
    plan?.schemaVersion === 9 &&
    Array.isArray(plan.plantings) &&
    plan.plantings.every(
      (planting) =>
        ['establishing', 'flowering', 'fruiting', 'mature'].includes(
          planting?.wateringStage,
        ) &&
        ['manual', 'plantingEvent', 'lifecycleFallback'].includes(
          planting?.wateringStageSource,
        ),
    )
  );
}

export function revisionSummary(data) {
  const items = data?.changesetSummary?.summaryItems;
  if (Array.isArray(items) && items.length)
    return items.join('; ').slice(0, 500);
  return (
    text(data?.changeSummary) ||
    `Migrated ${text(data?.action) || 'legacy'} revision`
  );
}

export function orderActions(actions) {
  const weight = { archive: 0, delete: 1, data: 2, core: 3, metadata: 4 };
  return actions
    .map((action, index) => ({ ...action, index }))
    .sort(
      (left, right) =>
        weight[left.phase] - weight[right.phase] || left.index - right.index,
    )
    .map(({ index: _index, ...action }) => action);
}

export function write(path, data, phase = 'data') {
  return { data, kind: 'write', path, phase };
}
export function remove(path) {
  return { kind: 'delete', path, phase: 'delete' };
}
export function emptyPlan() {
  return {
    actions: [],
    alreadyCurrent: true,
    archivedLegacy: {
      notifications: 0,
      recommendations: 0,
      revisions: 0,
      waterApplications: 0,
      wateringSchedule: 0,
      weatherSnapshots: 0,
    },
    blockers: [],
    canApply: true,
    warnings: [],
  };
}
export function safeId(value) {
  return (
    String(value)
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 100) || 'legacy'
  );
}
export function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}
export function iso(value, fallback) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? value
    : fallback;
}

function isV2Journal(data) {
  return (
    ['issue', 'note', 'photo'].includes(data?.type) &&
    ['garden', 'plantingGroup', 'structure'].includes(data?.target?.kind)
  );
}
function isV2Harvest(data) {
  return (
    typeof data?.occurredOn === 'string' &&
    typeof data?.plantingGroupId === 'string'
  );
}
function isV2Task(data) {
  return (
    typeof data?.dueOn === 'string' && typeof data?.target?.kind === 'string'
  );
}
function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}
function validEmail(value) {
  const email = text(value);
  return /^\S+@\S+\.\S+$/.test(email) ? email : '';
}
function bool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}
function localTime(value, fallback) {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
    ? value
    : fallback;
}
function threshold(value, fallback) {
  return typeof value === 'number' && value >= 0.05 && value <= 2
    ? value
    : fallback;
}
function validTimezone(value) {
  const timezone = text(value);
  try {
    if (timezone) new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch {
    return '';
  }
}
