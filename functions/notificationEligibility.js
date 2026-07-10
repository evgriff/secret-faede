'use strict';

const {
  resolveQuietHoursEndIso,
  resolveWateringCheckDelayIso,
} = require('./operationTime');

const consentCopyVersion = '2026-04-20';
const alertTypeByNotificationType = {
  frost: 'frost',
  heatStress: 'heatStress',
  severeWeather: 'severeWeather',
  task: 'taskDue',
  taskDue: 'taskDue',
  watering: 'watering',
};

function shouldSendNotification({ channel, now = new Date(), profile, type }) {
  const preference = profile?.notificationPreference || {};
  const alertType = alertTypeByNotificationType[type] || type;

  if (channel !== 'inApp' && !preference.channels?.[channel]) {
    return { allowed: false, reason: `${channel} disabled` };
  }
  if (preference.alertTypes?.[alertType] === false) {
    return { allowed: false, reason: `${alertType} alerts disabled` };
  }

  const quietHoursEndIso =
    channel === 'inApp' ? null : resolveQuietHoursEndIso(now, preference);
  const wateringCheckIso =
    channel === 'push' && type === 'watering'
      ? resolveWateringCheckDelayIso(now, preference)
      : null;
  const deferUntilIso = latestIso(quietHoursEndIso, wateringCheckIso);
  if (deferUntilIso) {
    return {
      allowed: false,
      deferUntilIso,
      reason:
        deferUntilIso === quietHoursEndIso
          ? 'quiet hours'
          : 'daily watering check',
    };
  }

  if (
    channel === 'push' &&
    preference.channelConsent?.push?.status !== 'granted'
  ) {
    return { allowed: false, reason: 'push consent not granted' };
  }
  return { allowed: true, reason: 'allowed' };
}

function isQuietHours(now, preference) {
  return Boolean(resolveQuietHoursEndIso(now, preference));
}

function createGrantedConsent(now = new Date().toISOString()) {
  return {
    consentCopyVersion,
    grantedAtIso: now,
    revokedAtIso: null,
    status: 'granted',
  };
}

function latestIso(...values) {
  return (
    values
      .filter((value) => typeof value === 'string')
      .sort()
      .at(-1) ?? null
  );
}

module.exports = {
  createGrantedConsent,
  isQuietHours,
  shouldSendNotification,
};
