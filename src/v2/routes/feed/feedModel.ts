import type {
  GardenIssue,
  HarvestRecord,
  JournalEntry,
  OperationTarget,
} from '../../domain';
import type { AppliedWaterAmount } from '../../domain/watering';
import type {
  FeedActivityItem,
  FeedCreateEntryInput,
  FeedEntryMode,
  FeedFiltersValue,
  FeedSummary,
  FeedTargetOption,
  FeedWateringActivity,
} from './types';

export const emptyFeedFilters: FeedFiltersValue = {
  query: '',
  status: 'all',
  targetValue: 'all',
  type: 'all',
};

export interface FeedComposerDraft {
  body: string;
  files: readonly File[];
  freeformAmount: string;
  harvestAmount: string;
  harvestUnit: HarvestRecord['unit'];
  issueCategory: GardenIssue['category'];
  issueSeverity: GardenIssue['severity'];
  issueStatus: GardenIssue['status'];
  mode: FeedEntryMode;
  occurredOn: string;
  targetValue: string;
  title: string;
}

export function createFeedComposerDraft(
  occurredOn: string,
  targetValue: string,
): FeedComposerDraft {
  return {
    body: '',
    files: [],
    freeformAmount: '',
    harvestAmount: '',
    harvestUnit: 'count',
    issueCategory: 'general',
    issueSeverity: 'medium',
    issueStatus: 'open',
    mode: 'note',
    occurredOn,
    targetValue,
    title: '',
  };
}

export function buildFeedActivity(input: {
  harvests: readonly HarvestRecord[];
  journalEntries: readonly (GardenIssue | JournalEntry)[];
  targets: readonly FeedTargetOption[];
  wateringActivity: readonly FeedWateringActivity[];
}): FeedActivityItem[] {
  const targets = new Map(
    input.targets.map((option) => [option.value, option]),
  );
  const targetByIdentity = new Map(
    input.targets.map((option) => [targetIdentity(option.target), option]),
  );

  return [
    ...input.journalEntries.map((entry) =>
      journalItem(entry, targetByIdentity.get(targetIdentity(entry.target))),
    ),
    ...input.harvests.map((harvest) => {
      const target = findPlantingTarget(input.targets, harvest.plantingGroupId);
      return harvestItem(harvest, target);
    }),
    ...input.wateringActivity.map((activity) =>
      wateringItem(activity, targets),
    ),
  ].sort((left, right) => right.sortAt.localeCompare(left.sortAt));
}

export function summarizeFeed(items: readonly FeedActivityItem[]): FeedSummary {
  return {
    harvests: items.filter((item) => item.type === 'harvest').length,
    memories: items.length,
    openIssues: items.filter(
      (item) =>
        item.type === 'issue' &&
        (item.status === 'open' || item.status === 'inProgress'),
    ).length,
    photos: items.reduce((total, item) => total + item.photos.length, 0),
    watering: items.filter((item) => item.type === 'watering').length,
  };
}

export function filterFeedActivity(
  items: readonly FeedActivityItem[],
  filters: FeedFiltersValue,
) {
  const query = normalize(filters.query);
  return items.filter((item) => {
    if (filters.type !== 'all' && item.type !== filters.type) return false;
    if (
      filters.targetValue !== 'all' &&
      item.targetValue !== filters.targetValue
    ) {
      return false;
    }
    if (filters.status !== 'all' && item.status !== filters.status)
      return false;
    if (!query) return true;
    return normalize(
      [
        item.title,
        item.body,
        item.targetLabel,
        item.type,
        item.status ?? '',
        ...item.meta,
      ].join(' '),
    ).includes(query);
  });
}

export function hasActiveFeedFilters(filters: FeedFiltersValue) {
  return (
    filters.query.trim() !== '' ||
    filters.status !== 'all' ||
    filters.targetValue !== 'all' ||
    filters.type !== 'all'
  );
}

export function validateFeedDraft(
  draft: FeedComposerDraft,
  targets: readonly FeedTargetOption[],
  ignoreFiles = false,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const target = targets.find((option) => option.value === draft.targetValue);
  if (!draft.occurredOn) errors.occurredOn = 'Choose the date this happened.';
  if (!target) errors.targetValue = 'Choose a saved garden target.';

  if (draft.mode === 'harvest') {
    if (target?.target.kind !== 'plantingGroup' || !target.cropId) {
      errors.targetValue = 'Choose the crop group that was harvested.';
    }
    if (draft.harvestUnit === 'freeform') {
      if (!draft.freeformAmount.trim()) {
        errors.freeformAmount = 'Describe the harvested amount.';
      }
    } else {
      const amount = Number(draft.harvestAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.harvestAmount = 'Enter an amount greater than zero.';
      }
    }
    return errors;
  }

  if (!draft.title.trim()) errors.title = 'Add a short title.';
  if (!draft.body.trim() && draft.mode !== 'photo') {
    errors.body = 'Add a useful garden detail.';
  }
  if (draft.mode === 'photo' && (ignoreFiles || draft.files.length === 0)) {
    errors.files = 'Choose at least one photo for a photo update.';
  }
  return errors;
}

export function createFeedEntryInput(
  draft: FeedComposerDraft,
  target: FeedTargetOption,
  withoutFiles = false,
): FeedCreateEntryInput {
  if (draft.mode === 'harvest') {
    return {
      amount:
        draft.harvestUnit === 'freeform' ? null : Number(draft.harvestAmount),
      cropId: target.cropId ?? '',
      freeformAmount: draft.freeformAmount.trim(),
      kind: 'harvest',
      notes: draft.body.trim(),
      occurredOn: draft.occurredOn,
      plantingGroupId: target.target.id ?? '',
      unit: draft.harvestUnit,
    };
  }
  if (draft.mode === 'issue') {
    return {
      body: draft.body.trim(),
      files: withoutFiles ? [] : draft.files,
      issue: {
        category: draft.issueCategory,
        severity: draft.issueSeverity,
        status: draft.issueStatus,
      },
      kind: 'issue',
      occurredOn: draft.occurredOn,
      target: target.target,
      title: draft.title.trim(),
    };
  }
  return {
    body: draft.body.trim(),
    files: withoutFiles ? [] : draft.files,
    kind: draft.mode,
    occurredOn: draft.occurredOn,
    target: target.target,
    title: draft.title.trim(),
  };
}

function journalItem(
  entry: GardenIssue | JournalEntry,
  target: FeedTargetOption | undefined,
): FeedActivityItem {
  const issue = entry.type === 'issue' ? (entry as GardenIssue) : null;
  return {
    body: entry.body,
    createdByUserId: entry.createdByUserId,
    id: `journal:${entry.id}`,
    issue,
    meta: issue
      ? [issue.category, `${issue.severity} severity`, issue.status]
      : [],
    occurredAt: entry.occurredOn,
    photos: [...entry.photos],
    sortAt: entry.createdAtIso,
    status: issue?.status ?? null,
    targetDeepLink: target?.deepLink ?? null,
    targetLabel: entry.target.label,
    targetValue: target?.value ?? targetIdentity(entry.target),
    title: entry.title,
    type: issue ? 'issue' : entry.type === 'photo' ? 'photo' : 'note',
    watering: null,
  };
}

function harvestItem(
  harvest: HarvestRecord,
  target: FeedTargetOption | undefined,
): FeedActivityItem {
  const cropLabel = target?.target.label ?? harvest.cropId;
  return {
    body: harvest.notes,
    createdByUserId: harvest.createdByUserId,
    id: `harvest:${harvest.id}`,
    issue: null,
    meta: [formatHarvestAmount(harvest)],
    occurredAt: harvest.occurredOn,
    photos: [],
    sortAt: harvest.createdAtIso,
    status: null,
    targetDeepLink: target?.deepLink ?? null,
    targetLabel: cropLabel,
    targetValue: target?.value ?? `planting:${harvest.plantingGroupId}`,
    title: `Harvested ${cropLabel}`,
    type: 'harvest',
    watering: null,
  };
}

function wateringItem(
  activity: FeedWateringActivity,
  targets: ReadonlyMap<string, FeedTargetOption>,
): FeedActivityItem {
  if (activity.kind === 'application') {
    const { application } = activity;
    const credited = application.outcome !== 'skipped';
    return {
      body: credited
        ? formatAppliedAmount(application.amount)
        : application.skipReason,
      createdByUserId: application.recordedByUserId,
      id: `water:${application.id}:${application.revision}`,
      issue: null,
      meta: [
        application.method,
        application.outcome === 'partial'
          ? 'partial amount credited'
          : application.outcome === 'applied'
            ? 'applied amount credited'
            : 'zero water credited',
        ...(application.revision > 1
          ? [`corrected revision ${application.revision}`]
          : []),
      ],
      occurredAt: application.appliedAtIso,
      photos: [],
      sortAt: application.recordedAtIso,
      status: application.outcome,
      targetDeepLink: activity.target.deepLink,
      targetLabel: activity.cropName,
      targetValue: activity.target.value,
      title:
        application.outcome === 'partial'
          ? `Partially watered ${activity.cropName}`
          : application.outcome === 'applied'
            ? `Watered ${activity.cropName}`
            : `Skipped watering for ${activity.cropName}`,
      type: 'watering',
      watering: activity,
    };
  }

  const { recommendation } = activity;
  const matchingTarget = [...targets.values()].find(
    (option) => option.target.id === recommendation.target.cropGroupId,
  );
  return {
    body: recommendation.reasonDetails
      .map((reason) => reason.message)
      .join(' '),
    createdByUserId: null,
    id: `water:${recommendation.id}`,
    issue: null,
    meta: recommendationMeta(recommendation),
    occurredAt: recommendation.calculatedAtIso,
    photos: [],
    sortAt: recommendation.calculatedAtIso,
    status: recommendation.status,
    targetDeepLink: `/app/plan?plantingId=${encodeURIComponent(recommendation.target.cropGroupId)}`,
    targetLabel:
      recommendation.target.cropGroupLabel ?? recommendation.target.cropName,
    targetValue:
      matchingTarget?.value ?? `planting:${recommendation.target.cropGroupId}`,
    title: wateringRecommendationTitle(recommendation),
    type: 'watering',
    watering: activity,
  };
}

function wateringRecommendationTitle(
  recommendation: Extract<
    FeedWateringActivity,
    { kind: 'recommendation' }
  >['recommendation'],
) {
  const actions = {
    checkSoil: 'Check soil for',
    planWatering: 'Plan watering for',
    waitForForecast: 'Rain may cover',
    waterNow: 'Water',
  } as const;
  return `${actions[recommendation.action]} ${recommendation.target.cropGroupLabel ?? recommendation.target.cropName}`;
}

function recommendationMeta(
  recommendation: Extract<
    FeedWateringActivity,
    { kind: 'recommendation' }
  >['recommendation'],
) {
  return [
    recommendation.recommendedDepthInches === null
      ? ''
      : `${formatNumber(recommendation.recommendedDepthInches)} in`,
    recommendation.recommendedGallons === null
      ? ''
      : `${formatNumber(recommendation.recommendedGallons)} gal`,
    `${recommendation.confidence} confidence`,
    `${recommendation.dataQuality} weather data`,
  ].filter(Boolean);
}

function formatAppliedAmount(amount: AppliedWaterAmount) {
  if (amount.unit === 'inches')
    return `${formatNumber(amount.depthInches)} inches applied.`;
  if (amount.unit === 'gallons')
    return `${formatNumber(amount.gallons)} gallons applied.`;
  return 'Water was applied, but the amount was not recorded.';
}

function formatHarvestAmount(harvest: HarvestRecord) {
  if (harvest.unit === 'freeform') return 'Freeform amount';
  return `${formatNumber(harvest.amount ?? 0)} ${harvest.unit}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(
    value,
  );
}

function findPlantingTarget(
  targets: readonly FeedTargetOption[],
  plantingGroupId: string,
) {
  return targets.find(
    (option) =>
      option.target.kind === 'plantingGroup' &&
      option.target.id === plantingGroupId,
  );
}

function targetIdentity(target: OperationTarget) {
  return `${target.kind}:${target.id ?? 'all'}`;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}
