'use strict';

const consentCopyVersion = '2026-04-20';
const alertTypeByNotificationType = {
  frost: 'frost',
  heatStress: 'heatStress',
  severeWeather: 'severeWeather',
  taskDue: 'taskDue',
  watering: 'watering',
};

function buildWateringNotification(recommendation, snapshot = {}) {
  const deficit = Number(
    recommendation.deficitInches || recommendation.inchesNeeded || 0,
  );
  const rainPhrase =
    Number(snapshot.forecastRainNext24In || 0) < 0.1
      ? 'Rain is unlikely today.'
      : `${Number(snapshot.forecastRainNext24In || 0).toFixed(1)} in of rain may arrive today.`;
  const target = recommendation.targetLabel || 'Your garden';

  return {
    body: `${target} are short ${deficit.toFixed(1)} in of water. ${rainPhrase}`,
    title: 'Watering recommended',
    type: 'watering',
  };
}

function buildFrostNotification(garden, snapshot = {}) {
  const tenderCrops = getTenderCropLabels(garden);
  const cropPhrase =
    tenderCrops.length > 0
      ? `Protect ${formatList(tenderCrops)}.`
      : 'Protect tender crops.';

  return {
    body: `Frost risk tonight. ${cropPhrase}`,
    title: 'Frost risk tonight',
    type: 'frost',
    urgency: snapshot.frostRisk || 'watch',
  };
}

function buildHeatNotification(garden, snapshot = {}) {
  const containerTargets = getHeatStressLabels(garden);
  const targetPhrase =
    containerTargets.length > 0
      ? `for ${formatList(containerTargets)}`
      : 'for containers and shallow beds';

  return {
    body: `Heat stress likely tomorrow afternoon ${targetPhrase}.`,
    title: 'Heat stress likely',
    type: 'heatStress',
    urgency: snapshot.heatRisk || 'watch',
  };
}

function buildSevereWeatherNotification(snapshot = {}) {
  const summary = Array.isArray(snapshot.alertSummaries)
    ? snapshot.alertSummaries[0]
    : null;

  return {
    body: summary || 'Severe weather may affect your garden today.',
    title: 'Severe weather alert',
    type: 'severeWeather',
  };
}

function shouldSendNotification({ channel, now = new Date(), profile, type }) {
  const preference = profile.notificationPreference || {};
  const alertType = alertTypeByNotificationType[type] || type;

  if (!preference.channels?.[channel]) {
    return { allowed: false, reason: `${channel} disabled` };
  }

  if (preference.alertTypes?.[alertType] === false) {
    return { allowed: false, reason: `${alertType} alerts disabled` };
  }

  if (isQuietHours(now, preference) && channel !== 'inApp') {
    return { allowed: false, reason: 'quiet hours' };
  }

  if (channel === 'carrier messaging') {
    const consent = preference.channelConsent?.carrier messaging;

    if (!preference.phoneE164) {
      return { allowed: false, reason: 'missing carrier messaging phone' };
    }

    if (consent?.status !== 'granted') {
      return { allowed: false, reason: 'carrier messaging consent not granted' };
    }
  }

  if (channel === 'push') {
    const consent = preference.channelConsent?.push;

    if (consent?.status !== 'granted') {
      return { allowed: false, reason: 'push consent not granted' };
    }
  }

  return { allowed: true, reason: 'allowed' };
}

function isQuietHours(now, preference) {
  const quietHours = preference.quietHours;

  if (!quietHours?.startLocalTime || !quietHours?.endLocalTime) {
    return false;
  }

  const timezone = preference.timezone || 'America/Detroit';
  const localTime = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    timeZone: timezone,
  }).format(now);
  const current = minutesFromTime(localTime);
  const start = minutesFromTime(quietHours.startLocalTime);
  const end = minutesFromTime(quietHours.endLocalTime);

  if (start === end) {
    return false;
  }

  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

function createNotificationLog({
  body,
  channel,
  dryRun = false,
  errorMessage = null,
  gardenId,
  provider = null,
  recipientRedacted,
  status,
  title,
  type,
  userId,
}) {
  const now = new Date().toISOString();

  return {
    body,
    channel,
    createdAtIso: now,
    dryRun,
    errorMessage,
    gardenId,
    id: `${channel}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    messageSummary: title ? `${title}: ${body}` : body,
    provider,
    recipientRedacted,
    sentAtIso: status === 'sent' ? now : null,
    status,
    taskId: null,
    type,
    userId,
  };
}

function redactPhone(value) {
  if (!value) {
    return '';
  }

  const digits = String(value).replace(/\D/g, '');
  return digits.length >= 4 ? `***${digits.slice(-4)}` : '***';
}

function createGrantedConsent(now = new Date().toISOString()) {
  return {
    consentCopyVersion,
    grantedAtIso: now,
    revokedAtIso: null,
    status: 'granted',
  };
}

function minutesFromTime(value) {
  const [hours = '0', minutes = '0'] = String(value).split(':');
  return Number(hours) * 60 + Number(minutes);
}

function getTenderCropLabels(garden = {}) {
  return (garden.plantings || [])
    .filter((planting) =>
      /basil|pepper|tomato|cucumber|eggplant/i.test(planting.label || ''),
    )
    .map((planting) => planting.label)
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
          planting.label || '',
        ) || containerIds.size > 0,
    )
    .map((planting) => planting.label)
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

module.exports = {
  buildFrostNotification,
  buildHeatNotification,
  buildSevereWeatherNotification,
  buildWateringNotification,
  createGrantedConsent,
  createNotificationLog,
  isQuietHours,
  redactPhone,
  shouldSendNotification,
};
