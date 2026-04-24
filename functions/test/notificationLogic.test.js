'use strict';

const assert = require('node:assert/strict');
const {
  buildFrostNotification,
  buildHeatNotification,
  buildWateringDedupeKey,
  buildWateringNotification,
  createGrantedConsent,
  isQuietHours,
  shouldSendNotification,
} = require('../notificationLogic');

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
    },
    channels: {
      inApp: true,
      push: true,
    },
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
assert.equal(
  buildWateringDedupeKey({
    dueDate: '2026-06-21',
    targetId: 'bed-a',
    targetKind: 'bed',
  }),
  'watering:bed:bed-a:2026-06-21',
);

assert.match(buildFrostNotification(garden).body, /Cover Basil/);
assert.match(buildHeatNotification(garden).body, /Check water early/);

assert.equal(
  shouldSendNotification({
    channel: 'push',
    now: new Date('2026-06-21T13:00:00-04:00'),
    profile,
    type: 'frost',
  }).allowed,
  true,
);

assert.equal(
  shouldSendNotification({
    channel: 'push',
    now: new Date('2026-06-21T22:00:00-04:00'),
    profile,
    type: 'frost',
  }).allowed,
  false,
);

assert.equal(
  shouldSendNotification({
    channel: 'inApp',
    now: new Date('2026-06-21T13:00:00-04:00'),
    profile,
    type: 'watering',
  }).reason,
  'allowed',
);

assert.equal(
  shouldSendNotification({
    channel: 'inApp',
    now: new Date('2026-06-21T13:00:00-04:00'),
    profile: {
      notificationPreference: {
        ...profile.notificationPreference,
        channels: { inApp: false, push: false },
      },
    },
    type: 'watering',
  }).allowed,
  true,
);

assert.equal(
  isQuietHours(
    new Date('2026-06-21T22:00:00-04:00'),
    profile.notificationPreference,
  ),
  true,
);

console.log('notificationLogic tests passed');
