import type { GardenIssue, GardenTask } from '../domain';
import { asRecord, readNonEmptyString } from './legacyMigrationReaders';

export function migrateLegacyTarget(legacy: Record<string, unknown>) {
  const plantingId = readNonEmptyString(
    legacy.plantingId ?? asRecord(legacy.target).id,
  );
  const structureId = readNonEmptyString(legacy.structureId);
  return {
    id: plantingId ?? structureId,
    kind: plantingId
      ? ('plantingGroup' as const)
      : structureId
        ? ('structure' as const)
        : ('garden' as const),
    label:
      readNonEmptyString(legacy.targetLabel ?? legacy.bedLabel) ??
      (plantingId
        ? 'Crop group'
        : structureId
          ? 'Growing area'
          : 'Whole garden'),
  };
}

export function isSafeLegacyPhotoPath(storagePath: string, entryId: string) {
  const parts = storagePath.split('/');
  return (
    parts.length === 6 &&
    parts[0] === 'gardenWorkspaces' &&
    parts[1] === 'main' &&
    parts[2] === 'journal' &&
    parts[3] === entryId &&
    parts.every((part) => part.length > 0 && part !== '..')
  );
}

export function readLegacyIssueCategory(
  value: unknown,
): GardenIssue['category'] {
  return [
    'disease',
    'general',
    'irrigation',
    'nutrient',
    'pest',
    'weatherDamage',
  ].includes(String(value))
    ? (value as GardenIssue['category'])
    : 'general';
}

export function readLegacyIssueSeverity(
  value: unknown,
): GardenIssue['severity'] {
  return ['high', 'low', 'medium'].includes(String(value))
    ? (value as GardenIssue['severity'])
    : 'medium';
}

export function readLegacyIssueStatus(value: unknown): GardenIssue['status'] {
  return ['inProgress', 'open', 'resolved'].includes(String(value))
    ? (value as GardenIssue['status'])
    : 'open';
}

export function readLegacyTaskKind(value: unknown): GardenTask['kind'] {
  const kind = String(value);
  if (
    [
      'fertilize',
      'harvest',
      'inspect',
      'mulch',
      'plant',
      'prune',
      'thin',
      'water',
      'weed',
    ].includes(kind)
  ) {
    return kind as GardenTask['kind'];
  }
  if (kind === 'amend') return 'fertilize';
  if (kind === 'sow' || kind === 'transplant') return 'plant';
  if (kind === 'trellis') return 'support';
  return 'inspect';
}

export function readLegacyTaskPriority(value: unknown): GardenTask['priority'] {
  return ['high', 'low', 'medium'].includes(String(value))
    ? (value as GardenTask['priority'])
    : 'medium';
}
