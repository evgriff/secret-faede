import type {
  GardenIssue,
  HarvestRecord,
  JournalEntry,
  PhotoAttachment,
} from '../../domain';
import type {
  AppliedWaterApplication,
  PartialWaterApplication,
  SkippedWaterApplication,
  WateringRecommendation,
} from '../../domain/watering';
import {
  buildFeedActivity,
  createFeedComposerDraft,
  createFeedEntryInput,
  filterFeedActivity,
  summarizeFeed,
  validateFeedDraft,
} from './feedModel';
import type { FeedTargetOption } from './types';

const gardenTarget: FeedTargetOption = {
  cropId: null,
  deepLink: '/app/plan',
  target: { id: null, kind: 'garden', label: 'Whole garden' },
  value: 'garden',
};
const tomatoTarget: FeedTargetOption = {
  cropId: 'tomato',
  deepLink: '/app/plan?plantingId=p1',
  target: { id: 'p1', kind: 'plantingGroup', label: 'Tomatoes' },
  value: 'planting:p1',
};
const photo: PhotoAttachment = {
  contentType: 'image/jpeg',
  fileName: 'tomatoes.jpg',
  height: 800,
  id: 'photo-1',
  sizeBytes: 1000,
  storagePath: '/tomatoes.jpg',
  uploadedAtIso: '2026-07-07T12:00:00.000Z',
  width: 1200,
};

describe('feedModel', () => {
  it('builds and summarizes journal, harvest, and structured watering activity', () => {
    const items = buildFeedActivity({
      harvests: [harvest()],
      journalEntries: [note(), issue(), photoEntry()],
      targets: [gardenTarget, tomatoTarget],
      wateringActivity: [
        { kind: 'recommendation', recommendation: recommendation() },
        {
          application: skippedApplication(),
          cropName: 'Tomatoes',
          kind: 'application',
          target: tomatoTarget,
        },
      ],
    });

    expect(items.map((item) => item.type)).toEqual([
      'watering',
      'watering',
      'harvest',
      'photo',
      'issue',
      'note',
    ]);
    expect(items[0]).toMatchObject({
      body: 'Rain is unlikely before the root zone reaches the trigger.',
      status: 'due',
      targetDeepLink: '/app/plan?plantingId=p1',
      title: 'Water Tomatoes',
    });
    expect(items[1]).toMatchObject({
      body: 'Soil was already wet.',
      status: 'skipped',
      title: 'Skipped watering for Tomatoes',
    });
    expect(items[1]?.meta).toContain('zero water credited');
    expect(summarizeFeed(items)).toEqual({
      harvests: 1,
      memories: 6,
      openIssues: 1,
      photos: 1,
      watering: 2,
    });
  });

  it('filters across text, target, type, and issue/watering status', () => {
    const items = buildFeedActivity({
      harvests: [harvest()],
      journalEntries: [issue(), note()],
      targets: [gardenTarget, tomatoTarget],
      wateringActivity: [
        {
          application: appliedApplication(),
          cropName: 'Tomatoes',
          kind: 'application',
          target: tomatoTarget,
        },
      ],
    });

    expect(
      filterFeedActivity(items, {
        query: 'aphids',
        status: 'all',
        targetValue: 'all',
        type: 'all',
      }).map((item) => item.title),
    ).toEqual(['Aphids found']);
    expect(
      filterFeedActivity(items, {
        query: '',
        status: 'applied',
        targetValue: 'planting:p1',
        type: 'watering',
      }),
    ).toHaveLength(1);
    expect(
      filterFeedActivity(items, {
        query: '',
        status: 'resolved',
        targetValue: 'all',
        type: 'issue',
      }),
    ).toHaveLength(0);
  });

  it('keeps partial water distinct and attributes human logs to their recorder', () => {
    const items = buildFeedActivity({
      harvests: [],
      journalEntries: [],
      targets: [gardenTarget, tomatoTarget],
      wateringActivity: [
        {
          application: partialApplication(),
          cropName: 'Tomatoes',
          kind: 'application',
          target: tomatoTarget,
        },
      ],
    });

    expect(items[0]).toMatchObject({
      createdByUserId: 'user-2',
      status: 'partial',
      title: 'Partially watered Tomatoes',
    });
    expect(items[0]?.meta).toEqual(
      expect.arrayContaining([
        'partial amount credited',
        'corrected revision 2',
      ]),
    );
    expect(
      filterFeedActivity(items, {
        query: '',
        status: 'partial',
        targetValue: 'all',
        type: 'watering',
      }),
    ).toHaveLength(1);
  });

  it('validates each composer mode and creates domain-oriented commands', () => {
    const noteDraft = {
      ...createFeedComposerDraft('2026-07-09', gardenTarget.value),
      body: 'Mulch is holding moisture.',
      files: [new File(['photo'], 'mulch.jpg', { type: 'image/jpeg' })],
      title: 'Mulch check',
    };
    expect(validateFeedDraft(noteDraft, [gardenTarget])).toEqual({});
    expect(createFeedEntryInput(noteDraft, gardenTarget, true)).toMatchObject({
      files: [],
      kind: 'note',
      target: gardenTarget.target,
    });

    const invalidPhoto = {
      ...noteDraft,
      files: [],
      mode: 'photo' as const,
    };
    expect(validateFeedDraft(invalidPhoto, [gardenTarget])).toMatchObject({
      files: expect.stringContaining('photo'),
    });

    const harvestDraft = {
      ...createFeedComposerDraft('2026-07-09', tomatoTarget.value),
      harvestAmount: '2.5',
      harvestUnit: 'lb' as const,
      mode: 'harvest' as const,
    };
    expect(validateFeedDraft(harvestDraft, [tomatoTarget])).toEqual({});
    expect(createFeedEntryInput(harvestDraft, tomatoTarget)).toMatchObject({
      amount: 2.5,
      cropId: 'tomato',
      kind: 'harvest',
      plantingGroupId: 'p1',
      unit: 'lb',
    });
    expect(
      validateFeedDraft({ ...harvestDraft, harvestAmount: '0' }, [
        tomatoTarget,
      ]),
    ).toHaveProperty('harvestAmount');
    expect(validateFeedDraft(harvestDraft, [gardenTarget])).toHaveProperty(
      'targetValue',
    );
  });
});

function note(): JournalEntry {
  return {
    body: 'Mulch is holding moisture.',
    createdAtIso: '2026-07-02T12:00:00.000Z',
    createdByUserId: 'user-1',
    id: 'note-1',
    occurredOn: '2026-07-02',
    photos: [],
    target: gardenTarget.target,
    title: 'Mulch check',
    type: 'note',
  };
}

function issue(): GardenIssue {
  return {
    ...note(),
    body: 'A few aphids are visible under leaves.',
    category: 'pest',
    createdAtIso: '2026-07-03T12:00:00.000Z',
    id: 'issue-1',
    resolvedAtIso: null,
    severity: 'medium',
    status: 'open',
    target: tomatoTarget.target,
    title: 'Aphids found',
    type: 'issue',
  };
}

function photoEntry(): JournalEntry {
  return {
    ...note(),
    createdAtIso: '2026-07-04T12:00:00.000Z',
    id: 'photo-entry-1',
    photos: [photo],
    target: tomatoTarget.target,
    title: 'First red tomato',
    type: 'photo',
  };
}

function harvest(): HarvestRecord {
  return {
    amount: 3,
    createdAtIso: '2026-07-05T12:00:00.000Z',
    createdByUserId: 'user-1',
    cropId: 'tomato',
    id: 'harvest-1',
    notes: 'Three ripe fruit.',
    occurredOn: '2026-07-05',
    plantingGroupId: 'p1',
    unit: 'count',
  };
}

function skippedApplication(): SkippedWaterApplication {
  return {
    appliedAtIso: '2026-07-08T12:00:00.000Z',
    cropGroupId: 'p1',
    id: 'water-skip-1',
    method: 'hand',
    outcome: 'skipped',
    recordedAtIso: '2026-07-08T12:01:00.000Z',
    recordedByUserId: 'user-2',
    revision: 1,
    skipReason: 'Soil was already wet.',
  };
}

function appliedApplication(): AppliedWaterApplication {
  return {
    amount: { depthInches: 0.4, unit: 'inches' },
    appliedAtIso: '2026-07-08T12:00:00.000Z',
    cropGroupId: 'p1',
    efficiency: {
      confidence: 'medium',
      fraction: 0.8,
      source: 'estimated',
    },
    id: 'water-1',
    method: 'hand',
    outcome: 'applied',
    recordedAtIso: '2026-07-08T12:01:00.000Z',
    recordedByUserId: 'user-1',
    revision: 1,
  };
}

function partialApplication(): PartialWaterApplication {
  return {
    ...appliedApplication(),
    id: 'water-partial-1',
    outcome: 'partial',
    recordedByUserId: 'user-2',
    revision: 2,
  };
}

function recommendation(): WateringRecommendation {
  return {
    action: 'waterNow',
    actionable: true,
    balance: {
      applicationLedger: [],
      asOfIso: '2026-07-09T11:00:00.000Z',
      calculationRevision: 1,
      cropGroupId: 'p1',
      depletionInches: 0.4,
      modelVersion: 'crop-water-balance-v2',
      profileFingerprint: 'tomato-profile',
    },
    basis: {
      area: { reliability: 'geometry', squareFeet: 8 },
      cropProfile: {
        baseWeeklyInches: 1,
        confidence: 'high',
        depletionFraction: 0.5,
        rootDepthInches: 18,
        source: 'curated',
        sourceVersion: '1',
        stage: 'fruiting',
        stageCoefficient: 1.15,
        stageSource: 'lifecycleFallback',
      },
      structure: null,
    },
    calculatedAtIso: '2026-07-09T12:00:00.000Z',
    calculationRevision: 1,
    confidence: 'high',
    dataQuality: 'fresh',
    forecastRainCreditInches: 0,
    id: 'recommendation-1',
    modelVersion: 'crop-water-balance-v2',
    projectedDepletionInches: 0.5,
    reasonCodes: ['BALANCE_AT_OR_ABOVE_TRIGGER'],
    reasonDetails: [
      {
        amountInches: 0.5,
        code: 'BALANCE_AT_OR_ABOVE_TRIGGER',
        message: 'Rain is unlikely before the root zone reaches the trigger.',
        sourceIds: [],
      },
    ],
    recommendedDepthInches: 0.5,
    recommendedGallons: 2.49,
    recheckAtIso: '2026-07-10T11:00:00.000Z',
    rootZoneCapacityInches: 1.4,
    scheduledForIso: '2026-07-09T12:00:00.000Z',
    status: 'due',
    suppressedUntilIso: null,
    target: {
      cropGroupId: 'p1',
      cropId: 'tomato',
      cropName: 'Tomatoes',
      deepLink: '/app/plan?plantingId=p1',
      kind: 'cropGroup',
      plantingIds: ['p1'],
      structureId: 'bed-1',
    },
    triggerDepletionInches: 0.4,
  };
}
