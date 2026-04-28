'use strict';

const assert = require('node:assert/strict');
const { createOperationRunner } = require('../operationRunner');

const uid = 'user-a';
const now = new Date('2026-06-21T12:00:00.000Z');
const baseGarden = {
  harvestEvents: [],
  journalEntries: [],
  notificationLogs: [],
  plantings: [
    {
      id: 'tomato-1',
      label: 'Tomato',
      plantedOn: '2026-06-01',
      status: 'harvest-ready',
      weeklyWaterNeedInches: 1.3,
      xFt: 2,
      yFt: 2,
    },
  ],
  plot: {
    location: {
      latitude: 42.3314,
      locationName: 'Detroit, MI',
      longitude: -83.0458,
      timezone: 'America/Detroit',
    },
  },
  structures: [
    {
      depthFt: 4,
      drainageProfile: 'fast',
      id: 'bed-a',
      irrigationZone: 'Zone 1',
      label: 'Bed A',
      mulched: true,
      soilType: 'sandy',
      type: 'raisedBed',
      widthFt: 8,
      xFt: 0,
      yFt: 0,
    },
  ],
  sunShadeLayers: [],
  tasks: [],
  updatedAtIso: now.toISOString(),
  wateringSchedule: [],
  weatherSnapshots: [],
};

const weatherProvider = {
  id: 'nationalWeatherService',
  label: 'National Weather Service',
  getCurrentConditions: () =>
    Promise.resolve({
      capturedAtIso: now.toISOString(),
      conditionSummary: 'Hot',
      feelsLikeF: 96,
      humidityPercent: 55,
      observationTimeIso: now.toISOString(),
      precipitationLastHourIn: 0,
      providerId: 'nationalWeatherService',
      sourceLabel: 'National Weather Service',
      temperatureF: 92,
      windMph: 5,
    }),
  getForecast: () =>
    Promise.resolve({
      dailyHighF: 92,
      days: [
        {
          conditionSummary: 'Hot',
          date: '2026-06-21',
          expectedRainIn: 0,
          highF: 92,
          precipitationChancePercent: null,
        },
      ],
      generatedAtIso: now.toISOString(),
      next24hPrecipIn: 0,
      next48hPrecipIn: 0,
      nextRainIso: null,
      overnightLowF: 68,
      periods: [{ startIso: now.toISOString(), temperatureF: 92 }],
      providerId: 'nationalWeatherService',
      summary: 'Hot',
    }),
  getOptionalAgricultureMetrics: () =>
    Promise.resolve({
      evapotranspirationIn: 0.18,
      evapotranspirationNext24hIn: 0.18,
      generatedAtIso: now.toISOString(),
      notes: [],
      providerId: 'nationalWeatherService',
    }),
  getRecentPrecipitation: () =>
    Promise.resolve({
      generatedAtIso: now.toISOString(),
      hours: 72,
      last24hIn: 0,
      last72hIn: 0,
      observations: [],
      providerId: 'nationalWeatherService',
      totalIn: 0,
    }),
  getWeatherAlerts: () => Promise.resolve([]),
};

const dueProfile = {
  notificationPreference: {
    defaultWateringCheckTime: '07:30',
    timezone: 'America/Detroit',
    wateringAlertThresholdIn: 0.25,
  },
  timezone: 'America/Detroit',
};

const scheduledProfile = {
  notificationPreference: {
    defaultWateringCheckTime: '09:00',
    timezone: 'America/Detroit',
    wateringAlertThresholdIn: 0.25,
  },
  timezone: 'America/Detroit',
};

function createSnapshot(data) {
  return {
    data: () => data,
    exists: data !== null,
  };
}

function deepMerge(target, source) {
  if (!isRecord(target) || !isRecord(source)) {
    return source;
  }

  const merged = { ...target };

  for (const [key, value] of Object.entries(source)) {
    merged[key] =
      isRecord(value) && isRecord(merged[key])
        ? deepMerge(merged[key], value)
        : value;
  }

  return merged;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createMockDb({
  drafts = {},
  legacy = {},
  shared = {},
  workspace = null,
} = {}) {
  const state = {
    drafts: { ...drafts },
    legacy: { ...legacy },
    shared: {
      harvests: [],
      journal: [],
      notifications: [],
      tasks: [],
      wateringSchedule: [],
      weatherSnapshots: [],
      ...shared,
    },
    workspace,
  };

  return {
    state,
    batch() {
      const operations = [];

      return {
        delete(ref) {
          operations.push(() => ref.delete());
        },
        set(ref, value, options) {
          operations.push(() => ref.set(value, options));
        },
        async commit() {
          await Promise.all(operations.map((operation) => operation()));
        },
      };
    },
    collection(name) {
      if (name === 'gardenWorkspaces') {
        return {
          doc(id) {
            assert.equal(id, 'main');
            return {
              collection(child) {
                if (child !== 'drafts') {
                  return {
                    doc(docId) {
                      return createSharedDocRef(state, child, docId);
                    },
                    async get() {
                      const items = Array.isArray(state.shared[child])
                        ? state.shared[child]
                        : [];

                      return {
                        docs: items.map((item) => ({
                          data: () => item,
                          id: item.id,
                        })),
                      };
                    },
                  };
                }

                return {
                  doc(docId) {
                    return {
                      async get() {
                        return createSnapshot(state.drafts[docId] ?? null);
                      },
                      async set(value, options = {}) {
                        const current = state.drafts[docId] ?? null;
                        state.drafts[docId] =
                          options.merge && current
                            ? deepMerge(current, value)
                            : value;
                      },
                    };
                  },
                };
              },
              async get() {
                return createSnapshot(state.workspace);
              },
              async set(value, options = {}) {
                state.workspace =
                  options.merge && state.workspace
                    ? deepMerge(state.workspace, value)
                    : value;
              },
            };
          },
        };
      }

      if (name === 'gardens') {
        return {
          doc(docId) {
            return {
              async get() {
                return createSnapshot(state.legacy[docId] ?? null);
              },
              collection(child) {
                return {
                  async get() {
                    const items =
                      state.legacy[docId]?.[child] &&
                      Array.isArray(state.legacy[docId][child])
                        ? state.legacy[docId][child]
                        : [];
                    return {
                      docs: items.map((item) => ({
                        data: () => item,
                        id: item.id,
                      })),
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unsupported collection ${name}`);
    },
  };
}

function createSharedDocRef(state, collectionName, docId) {
  return {
    async delete() {
      state.shared[collectionName] = (
        state.shared[collectionName] || []
      ).filter((item) => item.id !== docId);
    },
    async set(value) {
      const items = state.shared[collectionName] || [];
      const nextValue = { id: docId, ...value };

      state.shared[collectionName] = [
        nextValue,
        ...items.filter((item) => item.id !== docId),
      ];
    },
  };
}

function createRunner(db, dispatchNotification) {
  return createOperationRunner({
    admin: {
      firestore: {
        FieldValue: {
          serverTimestamp: () => '__SERVER_TIMESTAMP__',
        },
      },
    },
    db,
    dispatchNotification,
    logger: {
      info() {},
      warn() {},
    },
  });
}

(async () => {
  const publishedDb = createMockDb({
    workspace: {
      garden: {
        ...baseGarden,
        id: 'published-garden',
        userId: 'shared',
      },
      id: 'revision-1',
    },
  });
  const publishedAlerts = [];
  const publishedRunner = createRunner(publishedDb, async (notification) => {
    publishedAlerts.push(notification);
  });
  const publishedResult = await publishedRunner(uid, dueProfile, {
    force: true,
    now,
    weatherProvider,
  });
  const publishedDraft = publishedDb.state.drafts[uid];

  assert.equal(publishedResult.generated, true);
  assert.equal(publishedDraft.baseRevisionId, 'revision-1');
  assert.equal(publishedDraft.garden.id, uid);
  assert.equal(publishedDraft.garden.userId, uid);
  assert.equal(publishedDraft.garden.wateringSchedule.length, 0);
  assert.equal(publishedDb.state.shared.wateringSchedule.length, 1);
  assert.equal(publishedDb.state.shared.wateringSchedule[0].status, 'due');
  assert.equal(publishedAlerts.length, 1);

  const scheduledDb = createMockDb({
    drafts: {
      [uid]: {
        baseRevisionId: 'revision-1',
        garden: {
          ...baseGarden,
          id: uid,
          userId: uid,
        },
        suggestionDecisions: [],
        userId: uid,
      },
    },
  });
  const scheduledAlerts = [];
  const scheduledRunner = createRunner(scheduledDb, async (notification) => {
    scheduledAlerts.push(notification);
  });
  await scheduledRunner(uid, scheduledProfile, {
    force: true,
    now,
    weatherProvider,
  });

  assert.equal(
    scheduledDb.state.shared.wateringSchedule[0].status,
    'scheduled',
  );
  assert.equal(scheduledAlerts.length, 0);

  const snoozedId = 'water-bed-bed-a-2026-06-21';
  const snoozedDb = createMockDb({
    drafts: {
      [uid]: {
        baseRevisionId: 'revision-1',
        garden: {
          ...baseGarden,
          id: uid,
          userId: uid,
          wateringSchedule: [
            {
              appliedAmountInches: null,
              createdAtIso: '2026-06-21T10:00:00.000Z',
              deficitInches: 0.8,
              dueDate: '2026-06-21',
              dueWindowEndIso: '2026-06-22T12:00:00.000Z',
              dueWindowStartIso: '2026-06-21T22:00:00.000Z',
              gardenId: uid,
              id: snoozedId,
              lastWateredAtIso: null,
              nextRecalculationAtIso: '2026-06-22T12:00:00.000Z',
              reasonDetails: ['Moved to tonight.'],
              reasonSummary: 'Moved to tonight.',
              source: 'client',
              status: 'snoozed',
              targetAmountInches: 0.8,
              targetId: 'bed-a',
              targetKind: 'bed',
              targetLabel: 'Bed A',
              updatedAtIso: '2026-06-21T10:00:00.000Z',
              urgency: 'high',
              wateringZoneId: 'Zone 1',
              weatherSnapshotId: 'weather-old',
            },
          ],
        },
        suggestionDecisions: [],
        userId: uid,
      },
    },
  });
  const snoozedAlerts = [];
  const snoozedRunner = createRunner(snoozedDb, async (notification) => {
    snoozedAlerts.push(notification);
  });
  await snoozedRunner(uid, dueProfile, {
    force: true,
    now,
    weatherProvider,
  });

  assert.equal(snoozedDb.state.shared.wateringSchedule[0].status, 'snoozed');
  assert.equal(snoozedAlerts.length, 0);

  console.log('operationRunner tests passed');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
