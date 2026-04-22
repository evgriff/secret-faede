import type {
  Garden,
  HarvestEvent,
  JournalEntryType,
  JournalIssueCategory,
  IssueStatus,
  JournalTargetType,
} from '../../domain/gardens/GardenRepository';

export interface TargetOption {
  id: string;
  label: string;
  plantingId: string | null;
  structureId: string | null;
  type: JournalTargetType;
}

export function buildTargetOptions(garden: Garden): TargetOption[] {
  return [
    {
      id: 'garden',
      label: 'Whole garden',
      plantingId: null,
      structureId: null,
      type: 'garden',
    },
    ...garden.structures.map((structure) => ({
      id: `structure:${structure.id}`,
      label: structure.label,
      plantingId: null,
      structureId: structure.id,
      type: 'structure' as const,
    })),
    ...garden.plantings.map((planting) => ({
      id: `planting:${planting.id}`,
      label: planting.label,
      plantingId: planting.id,
      structureId: null,
      type: 'planting' as const,
    })),
  ];
}

export function defaultEntryTitle(type: JournalEntryType) {
  return type === 'issue' ? 'Garden issue' : 'Garden note';
}

export function formatHarvestAmount(harvest: HarvestEvent) {
  if (harvest.unit === 'freeform') {
    return harvest.amountText || 'Harvest logged';
  }

  return `${harvest.quantity ?? 0} ${harvest.unit}`;
}

export function formatIssue(category: JournalIssueCategory) {
  const labels: Record<JournalIssueCategory, string> = {
    disease: 'Disease',
    general: 'General note',
    irrigation: 'Irrigation issue',
    nutrient: 'Nutrient issue',
    pest: 'Pest',
    weatherDamage: 'Weather damage',
  };

  return labels[category];
}

export function formatIssueStatus(status: IssueStatus | null) {
  const labels: Record<IssueStatus, string> = {
    inProgress: 'In progress',
    open: 'Open',
    resolved: 'Resolved',
  };

  return status ? labels[status] : 'Open';
}

export function formatIssueSeverity(value: string | null) {
  if (!value) {
    return 'Medium severity';
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)} severity`;
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    weekday: 'short',
  }).format(parseLocalDate(date));
}

export function parseLocalDate(date: string) {
  const [year = '1970', month = '1', day = '1'] = date.split('-');

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

export function toLocalDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}`;
}

export function toErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
