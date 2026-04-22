import type {
  HarvestEvent,
  JournalIssueCategory,
} from '../../domain/gardens/GardenRepository';
import type {
  TodayQuickActionKind,
  TodayQuickActionState,
} from './components/TodayQuickActionRail';
import type { TodayTarget } from './todayActions';

export const harvestUnits: HarvestEvent['unit'][] = [
  'count',
  'bunch',
  'oz',
  'lb',
  'freeform',
];

export const issueCategories: JournalIssueCategory[] = [
  'general',
  'pest',
  'disease',
  'irrigation',
  'nutrient',
  'weatherDamage',
];

export function resolveQuickTargetId(
  action: TodayQuickActionState | null,
  targets: TodayTarget[],
) {
  if (action?.targetId) {
    return action.targetId;
  }

  if (action?.plantingId) {
    return `planting:${action.plantingId}`;
  }

  return targets[0]?.id ?? 'garden';
}

export function getQuickActionHeading(kind: TodayQuickActionKind) {
  const headings: Record<TodayQuickActionKind, string> = {
    harvest: 'Log harvest',
    issue: 'Report issue',
    note: 'Add note',
    photo: 'Add photo',
  };

  return headings[kind];
}

export function defaultQuickTitle(kind: TodayQuickActionKind | undefined) {
  if (kind === 'issue') {
    return 'Field issue';
  }

  if (kind === 'photo') {
    return 'Field photo';
  }

  return 'Field note';
}

export function defaultQuickBody(kind: TodayQuickActionKind | undefined) {
  return kind === 'photo' ? 'Photo from the garden.' : '';
}

export function formatHarvestUnit(unit: HarvestEvent['unit']) {
  const labels: Record<HarvestEvent['unit'], string> = {
    bunch: 'Bunches',
    count: 'Count',
    freeform: 'Freeform',
    lb: 'Pounds',
    oz: 'Ounces',
  };

  return labels[unit];
}

export function formatIssueCategory(category: JournalIssueCategory) {
  const labels: Record<JournalIssueCategory, string> = {
    disease: 'Disease',
    general: 'General',
    irrigation: 'Irrigation',
    nutrient: 'Nutrient',
    pest: 'Pest',
    weatherDamage: 'Weather damage',
  };

  return labels[category];
}
