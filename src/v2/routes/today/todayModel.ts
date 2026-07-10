import type { GardenTask } from '../../domain';
import { addGardenDays, getGardenDate } from '../../domain/time';
import type { WateringRecommendation } from '../../domain/watering';
import type {
  RecommendationBasisRow,
  RecommendationDisplay,
  TodayDateRange,
  TodayTaskActionInput,
  TodayTaskGroup,
  TodayWateringLogInput,
  WateringLogDraft,
  WateringLogErrors,
  WateringMethod,
} from './types';

const wateringMethodEfficiencies = {
  drip: { confidence: 'medium', fraction: 0.9 },
  hand: { confidence: 'medium', fraction: 0.8 },
  hose: { confidence: 'low', fraction: 0.75 },
  other: { confidence: 'low', fraction: 0.7 },
  sprinkler: { confidence: 'low', fraction: 0.65 },
} as const;

export const todayDateRanges: ReadonlyArray<{
  label: string;
  value: TodayDateRange;
}> = [
  { label: 'Today', value: 'today' },
  { label: 'Next 3 days', value: 'next3Days' },
  { label: 'Next 7 days', value: 'next7Days' },
  { label: 'All tasks', value: 'all' },
];

export function gardenToday(nowIso: string, timezone: string) {
  return getGardenDate(nowIso, timezone);
}

export function filterTasksByDateRange(
  tasks: readonly GardenTask[],
  today: string,
  range: TodayDateRange,
) {
  const end =
    range === 'today'
      ? today
      : range === 'next3Days'
        ? addGardenDays(today, 2)
        : range === 'next7Days'
          ? addGardenDays(today, 6)
          : null;

  return [...tasks]
    .filter((task) => end === null || task.dueOn <= end)
    .sort(compareTasks);
}

export function groupTasks(
  tasks: readonly GardenTask[],
  today: string,
): TodayTaskGroup[] {
  const groups = new Map<string, GardenTask[]>();
  for (const task of tasks) {
    const label =
      task.dueOn < today
        ? 'Overdue'
        : task.dueOn === today
          ? 'Today'
          : formatLocalDate(task.dueOn);
    groups.set(label, [...(groups.get(label) ?? []), task]);
  }
  return [...groups].map(([label, groupedTasks]) => ({
    label,
    tasks: groupedTasks,
  }));
}

function compareTasks(left: GardenTask, right: GardenTask) {
  if (left.status === 'done' && right.status !== 'done') return 1;
  if (left.status !== 'done' && right.status === 'done') return -1;
  const dateOrder = left.dueOn.localeCompare(right.dueOn);
  if (dateOrder !== 0) return dateOrder;
  const priorityOrder = { high: 0, medium: 1, low: 2 } as const;
  return priorityOrder[left.priority] - priorityOrder[right.priority];
}

export function taskAction(
  taskId: string,
  action: TodayTaskActionInput['action'],
  today: string,
): TodayTaskActionInput {
  const nextDueOn =
    action === 'snooze'
      ? addGardenDays(today, 1)
      : action === 'defer'
        ? addGardenDays(today, 7)
        : action === 'reopen'
          ? today
          : null;
  return { action, nextDueOn, taskId };
}

export function taskDeepLink(task: GardenTask) {
  if (task.target.kind === 'garden' || task.target.id === null) {
    return '/app/plan';
  }
  const parameter =
    task.target.kind === 'plantingGroup' ? 'plantingId' : 'structureId';
  return `/app/plan?${parameter}=${encodeURIComponent(task.target.id)}`;
}

export function recommendationDisplay(
  recommendation: WateringRecommendation,
  timezone?: string,
): RecommendationDisplay {
  const amount = exactRecommendationAmount(recommendation);
  switch (recommendation.status) {
    case 'due':
      return {
        amount,
        instruction: amount
          ? `Apply ${amount}. Recheck after watering has soaked in.`
          : 'Water now, using a measured amount for this crop group.',
        statusLabel: 'Water now',
        statusTone: 'warning',
      };
    case 'scheduled':
      return {
        amount,
        instruction: recommendation.scheduledForIso
          ? `Plan to water ${formatInstant(recommendation.scheduledForIso, timezone)}.`
          : 'Not due yet. Keep this crop group on the watering plan.',
        statusLabel: 'Scheduled',
        statusTone: 'info',
      };
    case 'suppressed':
      return {
        amount: null,
        instruction: recommendation.suppressedUntilIso
          ? `Hold watering for forecast rain. Recheck ${formatInstant(recommendation.suppressedUntilIso, timezone)}.`
          : 'Hold watering while useful forecast rain is expected.',
        statusLabel: 'Hold for rain',
        statusTone: 'success',
      };
    case 'checkSoil':
      return {
        amount: null,
        instruction:
          'Check moisture in the crop root zone before applying water. The available data cannot support an exact amount.',
        statusLabel: 'Check soil',
        statusTone: 'warning',
      };
  }
}

export function exactRecommendationAmount(
  recommendation: WateringRecommendation,
) {
  const depth = recommendation.recommendedDepthInches;
  const gallons = recommendation.recommendedGallons;
  if (depth === null) return null;
  if (gallons === null) return `${formatNumber(depth)} in`;
  return `${formatNumber(depth)} in · ${formatNumber(gallons)} gal`;
}

export function recommendationBasisRows(
  recommendation: WateringRecommendation,
): RecommendationBasisRow[] {
  const profile = recommendation.basis.cropProfile;
  const structure = recommendation.basis.structure;
  const area = recommendation.basis.area;
  return [
    {
      label: 'Crop demand',
      value: `${formatNumber(profile.baseWeeklyInches)} in/week · ${humanize(profile.stage)} stage`,
    },
    {
      label: 'Root zone',
      value: `${formatNumber(profile.rootDepthInches)} in root depth · ${formatNumber(recommendation.rootZoneCapacityInches)} in capacity`,
    },
    {
      label: 'Action threshold',
      value: `${formatNumber(recommendation.triggerDepletionInches)} in depletion`,
    },
    {
      label: 'Growing area',
      value:
        area.squareFeet === null
          ? `Unknown · ${humanize(area.reliability)}`
          : `${formatNumber(area.squareFeet)} sq ft · ${humanize(area.reliability)}`,
    },
    {
      label: 'Soil context',
      value: structure
        ? `${humanize(structure.soilType)} soil · ${humanize(structure.drainage)} drainage${structure.mulched ? ' · mulched' : ''}`
        : 'No reliable growing-area context',
    },
    {
      label: 'Model',
      value: `${recommendation.modelVersion} · calculation r${recommendation.calculationRevision}`,
    },
  ];
}

export function createWateringLogDraft(
  recommendation: WateringRecommendation,
  occurredOn: string,
): WateringLogDraft {
  const amountUnit =
    recommendation.recommendedGallons !== null ? 'gallons' : 'inches';
  const suggested =
    amountUnit === 'gallons'
      ? recommendation.recommendedGallons
      : recommendation.recommendedDepthInches;
  return {
    amount: suggested === null ? '' : String(suggested),
    amountUnit,
    method: 'drip',
    occurredOn,
    outcome: recommendation.status === 'suppressed' ? 'skipped' : 'applied',
    skipReason: '',
  };
}

export function validateWateringLogDraft(
  draft: WateringLogDraft,
  latestDate?: string,
): WateringLogErrors {
  const errors: WateringLogErrors = {};
  if (!isValidLocalDate(draft.occurredOn)) {
    errors.occurredOn = 'Choose the date this watering decision happened.';
  } else if (latestDate && draft.occurredOn > latestDate) {
    errors.occurredOn = 'The watering date cannot be in the future.';
  }
  if (draft.outcome === 'skipped') {
    if (!draft.skipReason.trim()) {
      errors.skipReason = 'Add the reason water was skipped.';
    }
    return errors;
  }
  const amount = Number(draft.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    errors.amount = 'Enter a measured amount greater than zero.';
  }
  return errors;
}

export function wateringLogInput(
  recommendation: WateringRecommendation,
  draft: WateringLogDraft,
): TodayWateringLogInput {
  if (draft.outcome === 'skipped') {
    return {
      amount: null,
      creditedDepthInches: 0,
      cropGroupId: recommendation.target.cropGroupId,
      method: draft.method,
      occurredOn: draft.occurredOn,
      outcome: 'skipped',
      recommendationId: recommendation.id,
      skipReason: draft.skipReason.trim(),
    };
  }
  return {
    amount: { unit: draft.amountUnit, value: Number(draft.amount) },
    cropGroupId: recommendation.target.cropGroupId,
    method: draft.method,
    occurredOn: draft.occurredOn,
    outcome: draft.outcome,
    recommendationId: recommendation.id,
    skipReason: null,
  };
}

export function wateringMethodEfficiency(method: WateringMethod) {
  return {
    ...wateringMethodEfficiencies[method],
    source: 'estimated' as const,
  };
}

export function formatLocalDate(value: string) {
  const parts = value.split('-').map(Number);
  const [year = 0, month = 1, day = 1] = parts;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (!Number.isFinite(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(date);
}

export function formatInstant(value: string, timezone?: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(date);
}

export function humanize(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (letter) => letter.toUpperCase());
}

function isValidLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}
