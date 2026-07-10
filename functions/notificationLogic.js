'use strict';

const {
  createGrantedConsent,
  isQuietHours,
  shouldSendNotification,
} = require('./notificationEligibility');

function buildWateringNotification(recommendation, snapshot = {}) {
  const deficit = Number(
    recommendation.recommendedDepthInches ||
      recommendation.targetAmountInches ||
      recommendation.deficitInches ||
      0,
  );
  const target =
    recommendation.target?.cropGroupLabel ||
    recommendation.target?.cropName ||
    recommendation.targetLabel ||
    'your garden';
  const amountPhrase = `${formatDepth(deficit)} in`;
  const precipitationStatus =
    snapshot.quality?.historical ||
    snapshot.precipitation?.status ||
    recommendation.precipitationStatus;
  const forecastRain = Number.isFinite(recommendation.forecastRainCreditInches)
    ? Math.max(0, recommendation.forecastRainCreditInches)
    : null;
  const rainPhrase =
    precipitationStatus &&
    !['current', 'fresh', 'cached'].includes(precipitationStatus)
      ? 'Recent rain evidence is incomplete, so confirm root-zone moisture.'
      : forecastRain === null
        ? 'Forecast uncertainty is included in the recommendation confidence.'
        : forecastRain <= 0.005
          ? 'No measurable rain is forecast before the next check.'
          : `${formatDepth(forecastRain)} in of probability- and capture-adjusted forecast rain was included and is not enough to defer watering.`;
  const checkSoil =
    recommendation.status === 'checkSoil' ||
    recommendation.pushEligible === false;

  return {
    body: checkSoil
      ? `Check root-zone soil moisture for ${target}. The available evidence does not support a safe watering amount.`
      : `Apply ${amountPhrase} to ${target} today. ${rainPhrase}`,
    dedupeKey: buildWateringDedupeKey(recommendation),
    deepLink:
      recommendation.target?.deepLink ||
      buildTodayDeepLink({
        cropGroupId:
          recommendation.target?.cropGroupId || recommendation.targetId,
        focus: 'watering',
      }),
    recommendationId: recommendation.id,
    severity: getWateringSeverity(recommendation),
    title: checkSoil ? `Check soil for ${target}` : `Water ${target}`,
    type: 'watering',
  };
}

function buildWateringDedupeKey(recommendation) {
  return [
    'watering',
    recommendation.target?.kind || recommendation.targetKind,
    recommendation.target?.cropGroupId || recommendation.targetId,
    recommendation.id,
  ].join(':');
}

function getWateringSeverity(recommendation) {
  const amount = Number(
    recommendation.recommendedDepthInches ||
      recommendation.targetAmountInches ||
      recommendation.deficitInches ||
      0,
  );

  if (recommendation.urgency === 'high' || amount >= 0.75) {
    return 'warning';
  }
  if (recommendation.urgency === 'medium' || amount >= 0.4) {
    return 'watch';
  }
  return 'advisory';
}

function buildFrostNotification(garden, snapshot = {}) {
  const tenderCrops = getTenderCropLabels(garden);
  const cropPhrase =
    tenderCrops.length > 0
      ? `Cover ${formatList(tenderCrops)} tonight`
      : 'Cover tender crops tonight';
  const severity = snapshot.frostRisk || 'watch';

  return {
    body: `${cropPhrase}; frost is possible.`,
    dedupeKey: `weather:frost:${snapshot.observedForDate || 'today'}:${severity}`,
    deepLink: buildTodayDeepLink({
      alertType: 'frost',
      focus: 'weather',
      snapshotId: snapshot.id,
    }),
    severity,
    snapshotId: snapshot.id,
    title: 'Frost risk tonight',
    type: 'frost',
  };
}

function buildHeatNotification(garden, snapshot = {}) {
  const containerTargets = getHeatStressLabels(garden);
  const targetPhrase =
    containerTargets.length > 0
      ? `for ${formatList(containerTargets)}`
      : 'for containers and shallow beds';
  const severity = snapshot.heatRisk || 'watch';

  return {
    body: `Check water early ${targetPhrase}; heat stress is likely tomorrow afternoon.`,
    dedupeKey: `weather:heat:${snapshot.observedForDate || 'today'}:${severity}`,
    deepLink: buildTodayDeepLink({
      alertType: 'heatStress',
      focus: 'weather',
      snapshotId: snapshot.id,
    }),
    severity,
    snapshotId: snapshot.id,
    title: 'Heat stress likely',
    type: 'heatStress',
  };
}

function buildSevereWeatherNotification(snapshot = {}) {
  const summary = Array.isArray(snapshot.alertSummaries)
    ? snapshot.alertSummaries[0]
    : null;
  const severity = snapshot.severeWeatherSeverity || 'warning';
  const fingerprint = stableHash(
    `${summary || 'severe-weather'}:${severity}`.toLowerCase(),
  );

  return {
    body: summary
      ? `Check covers and supports: ${summary}`
      : 'Check covers and supports; severe weather may affect your garden today.',
    dedupeKey: `weather:severe:${snapshot.observedForDate || 'today'}:${severity}:${fingerprint}`,
    deepLink: buildTodayDeepLink({
      alertType: 'severeWeather',
      focus: 'weather',
      snapshotId: snapshot.id,
    }),
    severity,
    snapshotId: snapshot.id,
    title: 'Severe weather alert',
    type: 'severeWeather',
  };
}

function buildTaskNotification(task) {
  const severity = task.priority === 'high' ? 'warning' : 'advisory';
  const dueOn = task.dueOn || task.dueDate || 'unscheduled';

  return {
    body: task.notes || `${task.title} is due.`,
    dedupeKey: `task:${task.id}:${dueOn}`,
    deepLink: buildTodayDeepLink({ focus: 'task', taskId: task.id }),
    dueOn,
    severity,
    taskId: task.id,
    title: task.title,
    type: 'taskDue',
  };
}

function createGardenAlert(notification, input = {}) {
  const createdAtIso = input.createdAtIso || new Date().toISOString();
  const dedupeKey =
    notification.dedupeKey ||
    `${notification.type}:${notification.title}:${notification.body}`;

  return {
    amountInches: input.amountInches ?? null,
    body: notification.body,
    createdAtIso,
    deepLink: notification.deepLink || '/app/today',
    dedupeKey,
    dueOn: notification.dueOn || input.dueOn || null,
    gardenId: 'main',
    id: `garden-alert-${stableHash(dedupeKey)}`,
    recommendationId:
      notification.recommendationId || input.recommendationId || null,
    severity: notification.severity || input.severity || 'advisory',
    snapshotId: notification.snapshotId || input.snapshotId || null,
    source: input.source || 'gardenOperations',
    status: 'active',
    targetId: input.targetId || null,
    taskId: notification.taskId || input.taskId || null,
    title: notification.title,
    type: notification.type,
    workspaceRevisionId: input.workspaceRevisionId || null,
  };
}

function buildTodayDeepLink({
  alertType,
  cropGroupId,
  focus,
  recommendationId,
  snapshotId,
  taskId,
}) {
  const parameters = new URLSearchParams();
  parameters.set('focus', focus);

  if (cropGroupId) {
    parameters.set('cropGroupId', cropGroupId);
  }
  if (recommendationId) {
    parameters.set('recommendationId', recommendationId);
  }
  if (snapshotId) {
    parameters.set('snapshotId', snapshotId);
  }
  if (alertType) {
    parameters.set('alertType', alertType);
  }
  if (taskId) {
    parameters.set('taskId', taskId);
  }

  return `/app/today?${parameters.toString()}`;
}

function formatDepth(value) {
  return Number(value.toFixed(2)).toString();
}

function getTenderCropLabels(garden = {}) {
  return (garden.plantings || [])
    .filter((planting) =>
      /basil|pepper|tomato|cucumber|eggplant/i.test(
        planting.cropName || planting.label || '',
      ),
    )
    .map((planting) => planting.cropName || planting.label)
    .slice(0, 3);
}

function getHeatStressLabels(garden = {}) {
  const containerIds = new Set(
    (garden.structures || [])
      .filter((structure) => structure.type === 'container')
      .map((structure) => structure.id),
  );
  const labels = (garden.plantings || [])
    .filter(
      (planting) =>
        /herb|basil|cilantro|parsley|mint|container/i.test(
          planting.cropName || planting.label || '',
        ) || containerIds.size > 0,
    )
    .map((planting) => planting.cropName || planting.label)
    .slice(0, 3);

  return labels.length > 0 ? labels : ['container herbs'];
}

function formatList(values) {
  if (values.length <= 1) {
    return values[0] || 'tender crops';
  }
  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`;
}

function stableHash(value) {
  let hash = 2166136261;

  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

module.exports = {
  buildFrostNotification,
  buildHeatNotification,
  buildSevereWeatherNotification,
  buildTaskNotification,
  buildTodayDeepLink,
  buildWateringDedupeKey,
  buildWateringNotification,
  createGardenAlert,
  createGrantedConsent,
  getWateringSeverity,
  isQuietHours,
  shouldSendNotification,
  stableHash,
};
