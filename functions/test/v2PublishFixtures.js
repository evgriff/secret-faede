'use strict';

const initialIso = '2026-07-01T12:00:00.000Z';

function createV2Plan(overrides = {}) {
  const plan = {
    createdAtIso: '2026-06-01T12:00:00.000Z',
    id: 'garden-main',
    name: 'Home garden',
    plantings: [createPlanting()],
    plot: {
      climate: {
        firstFrost: '10-15',
        hardinessZone: '6b',
        lastFrost: '04-30',
      },
      depthFt: 10,
      location: {
        coordinates: { latitude: 42.3314, longitude: -83.0458 },
        label: 'Detroit garden',
        query: 'Detroit, MI',
        timezone: 'America/Detroit',
      },
      northDegrees: 0,
      snapFt: 0.125,
      widthFt: 12,
    },
    reviewDecisions: [
      {
        decision: 'accepted',
        issueId: 'water-confidence:tomato-group',
        updatedAtIso: initialIso,
      },
    ],
    schemaVersion: 9,
    setupCompleted: true,
    structures: [createBed()],
    updatedAtIso: initialIso,
  };
  return { ...plan, ...structuredClone(overrides) };
}

function createBed(overrides = {}) {
  return {
    depthFt: 6,
    drainage: 'moderate',
    id: 'bed-a',
    irrigationZoneId: 'zone-a',
    label: 'Raised bed',
    locked: false,
    mulched: true,
    notes: '',
    rotationDegrees: 0,
    soilDepthInches: 18,
    soilType: 'loam',
    type: 'raisedBed',
    widthFt: 8,
    xFt: 1,
    yFt: 1,
    ...structuredClone(overrides),
  };
}

function createPlanting(overrides = {}) {
  return {
    arrangement: 'cluster',
    cropId: 'tomato',
    cropName: 'Tomato',
    depthFt: 2,
    growingAreaStructureId: 'bed-a',
    id: 'tomato-group',
    instances: [
      { id: 'tomato-1', label: 'Tomato 1', xFt: 2.5, yFt: 3 },
      { id: 'tomato-2', label: 'Tomato 2', xFt: 3.5, yFt: 3 },
    ],
    irrigationZoneId: 'zone-a',
    lifecycle: 'growing',
    locked: false,
    mulched: true,
    notes: '',
    plantedOn: '2026-05-20',
    plannedFor: '2026-05-18',
    spacingInches: 18,
    sun: 'fullSun',
    waterProfile: {
      baseWeeklyInches: 1.3,
      confidence: 'high',
      depletionFraction: 0.45,
      rootDepthInches: 24,
      source: 'curated',
      sourceVersion: 'extension-2026.1',
      stageCoefficients: {
        establishing: 1.2,
        flowering: 1.1,
        fruiting: 1.2,
        mature: 1,
      },
    },
    wateringStage: 'fruiting',
    wateringStageSource: 'manual',
    widthFt: 2,
    xFt: 3,
    yFt: 3,
    ...structuredClone(overrides),
  };
}

function createWorkspaceDocuments() {
  const plan = createV2Plan();
  const publication = {
    plan,
    publishedAtIso: initialIso,
    publishedByUserId: 'user-a',
    revisionId: 'revision-1',
  };
  return {
    'gardenWorkspaces/main': {
      id: 'main',
      operationsAutomation: { checkTimeLocal: '07:00' },
      publishedRevisionId: 'revision-1',
      schemaVersion: 2,
      updatedAtIso: initialIso,
    },
    'gardenWorkspaces/main/drafts/user-a': {
      baseRevisionId: 'revision-1',
      plan: { ...structuredClone(plan), name: 'Private user A garden' },
      updatedAtIso: initialIso,
      userId: 'user-a',
    },
    'gardenWorkspaces/main/drafts/user-b': {
      baseRevisionId: 'revision-1',
      plan: { ...structuredClone(plan), name: 'Private user B garden' },
      updatedAtIso: initialIso,
      userId: 'user-b',
    },
    'gardenWorkspaces/main/plans/published': publication,
    'gardenWorkspaces/main/revisions/revision-1': {
      ...structuredClone(publication),
      changeSummary: 'Initial publication',
    },
  };
}

module.exports = {
  createBed,
  createPlanting,
  createV2Plan,
  createWorkspaceDocuments,
  initialIso,
};
