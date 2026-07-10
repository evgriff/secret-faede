'use strict';

const assert = require('node:assert/strict');
const {
  buildFrostNotification,
  buildHeatNotification,
  buildTodayDeepLink,
  buildWateringDedupeKey,
  buildWateringNotification,
  createGardenAlert,
  createGrantedConsent,
  isQuietHours,
  shouldSendNotification,
} = require('../notificationLogic');
const {
  resolveLocalDateTimeIso,
  resolveQuietHoursEndIso,
} = require('../operationTime');

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
    channels: { inApp: true, push: true },
    defaultWateringCheckTime: '07:00',
    quietHours: { endLocalTime: '07:00', startLocalTime: '21:00' },
    timezone: 'America/Detroit',
  },
};
const garden = {
  plantings: [{ label: 'Basil' }, { label: 'Peppers' }, { label: 'Tomatoes' }],
  structures: [{ type: 'container' }],
};
const recommendation = {
  forecastRainCreditInches: 0,
  id: 'watering:tomato-group:2026-06-21:r1',
  recommendedDepthInches: 0.62,
  status: 'due',
  target: {
    cropGroupId: 'tomato-group',
    cropName: 'Tomato',
    deepLink: '/app/today?focus=watering&cropGroupId=tomato-group',
    kind: 'cropGroup',
  },
};
const wateringNotification = buildWateringNotification(recommendation, {
  forecastRainNext24In: 0,
  precipitation: { status: 'current' },
});

assert.equal(
  wateringNotification.body,
  'Apply 0.62 in to Tomato today. No measurable rain is forecast before the next check.',
);
assert.equal(
  buildWateringNotification(
    {
      ...recommendation,
      forecastRainCreditInches: 0.12,
      recommendedDepthInches: 0.75,
    },
    {
      capturedAtIso: '2026-06-21T12:00:00.000Z',
      forecastWeather: {
        periods: [
          {
            endIso: '2026-06-22T12:00:00.000Z',
            expectedRainInches: 1,
            precipitationProbabilityPercent: 30,
            startIso: '2026-06-21T12:00:00.000Z',
          },
        ],
      },
      quality: { historical: 'fresh' },
    },
  ).body,
  'Apply 0.75 in to Tomato today. 0.12 in of probability- and capture-adjusted forecast rain was included and is not enough to defer watering.',
);
assert.equal(
  wateringNotification.deepLink,
  '/app/today?focus=watering&cropGroupId=tomato-group',
);
const beforeWateringCheck = shouldSendNotification({
  channel: 'push',
  now: new Date('2026-06-21T06:30:00-04:00'),
  profile: {
    notificationPreference: {
      ...profile.notificationPreference,
      defaultWateringCheckTime: '08:15',
      quietHours: { endLocalTime: '06:00', startLocalTime: '22:00' },
    },
  },
  type: 'watering',
});
assert.equal(beforeWateringCheck.allowed, false);
assert.equal(beforeWateringCheck.reason, 'daily watering check');
assert.equal(beforeWateringCheck.deferUntilIso, '2026-06-21T12:15:00.000Z');
assert.equal(
  buildWateringNotification({
    ...recommendation,
    target: {
      ...recommendation.target,
      cropGroupId: 'tomato group/1',
      deepLink: undefined,
    },
  }).deepLink,
  '/app/today?focus=watering&cropGroupId=tomato+group%2F1',
);
assert.equal(
  buildWateringDedupeKey(recommendation),
  'watering:cropGroup:tomato-group:watering:tomato-group:2026-06-21:r1',
);
assert.equal(
  buildWateringDedupeKey(recommendation),
  buildWateringDedupeKey({
    ...recommendation,
    recommendedDepthInches: 0.9,
  }),
  'amount and severity updates must replace the active alert without duplication',
);

const frostWatch = buildFrostNotification(garden, {
  frostRisk: 'watch',
  id: 'weather-a',
  observedForDate: '2026-06-21',
});
const frostWarning = buildFrostNotification(garden, {
  frostRisk: 'warning',
  id: 'weather-a',
  observedForDate: '2026-06-21',
});
assert.match(frostWatch.body, /Cover Basil/);
assert.notEqual(frostWatch.dedupeKey, frostWarning.dedupeKey);
assert.match(buildHeatNotification(garden).body, /Check water early/);
assert.equal(
  createGardenAlert(wateringNotification).deepLink,
  wateringNotification.deepLink,
);

assert.equal(
  buildTodayDeepLink({
    alertType: 'frost',
    focus: 'weather',
    snapshotId: 'weather:1',
  }),
  '/app/today?focus=weather&snapshotId=weather%3A1&alertType=frost',
);
assert.equal(
  buildTodayDeepLink({ focus: 'task', taskId: 'task-a' }),
  '/app/today?focus=task&taskId=task-a',
);

assert.equal(
  shouldSendNotification({
    channel: 'push',
    now: new Date('2026-06-21T13:00:00-04:00'),
    profile,
    type: 'frost',
  }).allowed,
  true,
);
const quietDecision = shouldSendNotification({
  channel: 'push',
  now: new Date('2026-06-21T22:00:00-04:00'),
  profile,
  type: 'frost',
});
assert.equal(quietDecision.allowed, false);
assert.equal(quietDecision.reason, 'quiet hours');
assert.equal(quietDecision.deferUntilIso, '2026-06-22T11:00:00.000Z');
assert.equal(
  shouldSendNotification({
    channel: 'inApp',
    now: new Date('2026-06-21T22:00:00-04:00'),
    profile,
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

// DST-safe local scheduling: a nonexistent 02:30 advances to 03:00, while
// quiet hours end at the real 07:00 local instant on both transition days.
assert.equal(
  resolveLocalDateTimeIso('2026-03-08', '02:30', 'America/Detroit'),
  '2026-03-08T07:00:00.000Z',
);
assert.equal(
  resolveQuietHoursEndIso(
    new Date('2026-03-08T06:30:00.000Z'),
    profile.notificationPreference,
  ),
  '2026-03-08T11:00:00.000Z',
);
assert.equal(
  resolveQuietHoursEndIso(
    new Date('2026-11-01T05:30:00.000Z'),
    profile.notificationPreference,
  ),
  '2026-11-01T12:00:00.000Z',
);

console.log('notificationLogic tests passed');
