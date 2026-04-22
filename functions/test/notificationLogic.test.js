'use strict';

const assert = require('node:assert/strict');
const {
  buildFrostNotification,
  buildHeatNotification,
  buildWateringNotification,
  createGrantedConsent,
  isQuietHours,
  redactPhone,
  shouldSendNotification,
} = require('../notificationLogic');
const {
  getSmsKeywordIntent,
  getSmsRateLimitDecision,
  isRetryableSmsProviderError,
} = require('../notificationCompliance');

const profile = {
  notificationPreference: {
    alertTypes: {
      frost: true,
      heatStress: true,
      severeWeather: true,
      taskDue: true,
      watering: true,
    },
    channelConsent: {
      push: createGrantedConsent('2026-04-20T11:00:00.000Z'),
      carrier messaging: createGrantedConsent('2026-04-20T11:00:00.000Z'),
    },
    channels: {
      email: false,
      inApp: true,
      push: true,
      carrier messaging: true,
    },
    phoneE164: '+17345550123',
    quietHours: {
      endLocalTime: '07:00',
      startLocalTime: '21:00',
    },
    timezone: 'America/Detroit',
  },
};

const garden = {
  plantings: [{ label: 'Basil' }, { label: 'Peppers' }, { label: 'Tomatoes' }],
  structures: [{ type: 'container' }],
};

assert.equal(
  buildWateringNotification(
    { deficitInches: 0.62, targetLabel: 'Tomatoes in Bed A' },
    { forecastRainNext24In: 0 },
  ).body,
  'Water Tomatoes in Bed A 0.62 in today. Rain is unlikely today.',
);

assert.match(buildFrostNotification(garden).body, /Cover Basil/);
assert.match(buildHeatNotification(garden).body, /Check water early/);
assert.equal(redactPhone('+17345550123'), '***0123');
assert.equal(getSmsKeywordIntent({ body: 'STOP', optOutType: '' }), 'stop');
assert.equal(getSmsKeywordIntent({ body: 'help', optOutType: '' }), 'help');
assert.equal(
  getSmsKeywordIntent({ body: 'hello', optOutType: 'START' }),
  'start',
);
assert.equal(isRetryableSmsProviderError({ status: 500 }), true);
assert.equal(
  getSmsRateLimitDecision(
    Array.from({ length: 3 }, (_, index) => ({
      channel: 'carrier messaging',
      createdAtIso: new Date(Date.now() - index * 1000).toISOString(),
      status: 'sent',
    })),
  ).allowed,
  false,
);

assert.equal(
  shouldSendNotification({
    channel: 'carrier messaging',
    now: new Date('2026-06-21T13:00:00-04:00'),
    profile,
    type: 'frost',
  }).allowed,
  true,
);

assert.equal(
  shouldSendNotification({
    channel: 'carrier messaging',
    now: new Date('2026-06-21T22:00:00-04:00'),
    profile,
    type: 'frost',
  }).allowed,
  false,
);

assert.equal(
  shouldSendNotification({
    channel: 'carrier messaging',
    now: new Date('2026-06-21T13:00:00-04:00'),
    profile,
    type: 'watering',
  }).allowed,
  false,
);

assert.equal(
  isQuietHours(
    new Date('2026-06-21T22:00:00-04:00'),
    profile.notificationPreference,
  ),
  true,
);

console.log('notificationLogic tests passed');
