const nowIso = '2026-07-09T12:00:00.000Z';

export function productionFixture() {
  const tasks = Array.from({ length: 105 }, (_, index) => ({
    createdAtIso: nowIso,
    dueDate: '2026-07-10',
    id: `task-${index + 1}`,
    notes: '',
    plantingId: 'tomatoes',
    priority: 'medium',
    source: 'generated',
    status: 'open',
    title: `Inspect crop ${index + 1}`,
    type: 'inspect',
  }));
  const revisions = [
    'revision-1',
    'revision-2',
    'revision-3',
    'revision-live',
  ].map((id) => ({
    data: {
      action: id === 'revision-1' ? 'initial' : 'publish',
      garden: legacyGarden(`History ${id}`),
      id,
      publishedAtIso: nowIso,
      publishedByUserId: 'user-a',
    },
    id,
  }));
  return {
    collections: {
      drafts: ['user-a', 'user-b'].map((id) => ({
        data: {
          baseRevisionId: 'revision-live',
          garden: legacyGarden(`${id} draft`),
          userId: id,
        },
        id,
      })),
      harvests: [
        {
          data: {
            cropId: 'tomato',
            harvestedOn: '2026-07-08',
            id: 'harvest-1',
            plantingId: 'tomatoes',
            quantity: 3,
            unit: 'count',
          },
          id: 'harvest-1',
        },
      ],
      journal: [issue(), unknownWaterNote()].map((data) => ({
        data,
        id: data.id,
      })),
      notifications: [
        {
          data: { id: 'notification-1', status: 'sent' },
          id: 'notification-1',
        },
      ],
      profiles: ['user-a', 'user-b'].map((id) => ({
        data: { displayName: id, email: `${id}@example.com`, uid: id },
        id,
      })),
      revisions,
      tasks: tasks.map((data) => ({ data, id: data.id })),
      waterApplications: [],
      wateringRecommendations: [],
      wateringSchedule: [{ data: { id: 'schedule-1' }, id: 'schedule-1' }],
      weatherSnapshots: Array.from({ length: 8 }, (_, index) => ({
        data: {
          capturedAtIso: nowIso,
          id: `weather-${index}`,
          source: 'manual',
        },
        id: `weather-${index}`,
      })),
    },
    workspace: {
      garden: legacyGarden('Published garden'),
      id: 'revision-live',
      publishedAtIso: nowIso,
      publishedByUserId: 'user-a',
    },
  };
}

export function legacyGarden(name) {
  return {
    climateProfile: {
      firstFrostDate: '10-15',
      hardinessZone: '6b',
      lastFrostDate: '04-30',
    },
    harvestEvents: [],
    id: 'garden-main',
    journalEntries: [],
    name,
    notificationLogs: [],
    plantings: [
      {
        blockDepthFt: 1,
        blockWidthFt: 1,
        cropId: 'tomato',
        id: 'tomatoes',
        label: 'Tomatoes',
        xFt: 3,
        yFt: 3,
      },
    ],
    plot: {
      depthFt: 8,
      location: { timezone: 'America/Detroit' },
      widthFt: 12,
    },
    schemaVersion: 8,
    structures: [
      {
        depthFt: 6,
        id: 'bed-1',
        label: 'Main bed',
        type: 'raisedBed',
        widthFt: 10,
        xFt: 1,
        yFt: 1,
      },
    ],
    tasks: [],
    wateringSchedule: [],
    weatherSnapshots: [],
  };
}

export function v2Published() {
  return {
    plan: { id: 'garden-main', plantings: [], schemaVersion: 9 },
    publishedAtIso: nowIso,
    publishedByUserId: 'user-a',
    revisionId: 'revision-current',
  };
}

export function currentCollections(published) {
  return {
    drafts: [],
    harvests: [],
    journal: [],
    notifications: [],
    profiles: [],
    revisions: [
      {
        data: { ...published, changeSummary: 'Current' },
        id: published.revisionId,
      },
    ],
    tasks: [],
    waterApplications: [],
    wateringRecommendations: [],
    wateringSchedule: [],
    weatherSnapshots: [],
  };
}

function issue() {
  return {
    body: 'Aphids on leaves',
    createdAtIso: nowIso,
    createdByUserId: 'user-a',
    id: 'issue-1',
    issueCategory: 'pest',
    issueSeverity: 'high',
    issueStatus: 'open',
    occurredOn: '2026-07-08',
    photos: [
      {
        contentType: 'image/jpeg',
        fileName: 'photo.jpg',
        id: 'photo-1',
        sizeBytes: 1200,
        storagePath: 'gardenWorkspaces/main/journal/issue-1/user-a/photo.jpg',
        uploadedAtIso: nowIso,
      },
    ],
    plantingId: 'tomatoes',
    targetLabel: 'Tomatoes',
    title: 'Aphid issue',
    type: 'issue',
  };
}

function unknownWaterNote() {
  return {
    body: 'Watered by hand, amount unknown',
    createdAtIso: nowIso,
    id: 'water-unknown',
    occurredOn: '2026-07-08',
    plantingId: 'tomatoes',
    title: 'Watering note',
    type: 'note',
  };
}
