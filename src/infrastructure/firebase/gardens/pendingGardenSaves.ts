import {
  CURRENT_GARDEN_SCHEMA_VERSION,
  parseGarden,
  type Garden,
} from '../../../domain/gardens/GardenRepository';
import {
  readJsonStorageValue,
  removeStorageValue,
  writeJsonStorageValue,
} from '../../../shared/lib/storage';

interface PendingGardenSave {
  conflictDetectedAtIso?: string | null;
  draftBaseRevisionId?: string | null;
  draftUpdatedAtIso?: string | null;
  garden: unknown;
  gardenUpdatedAtIso: string | null;
  kind?: PendingGardenSaveKind;
  publishedRevisionId?: string | null;
  queuedAtIso: string;
  schemaVersion?: number;
}

const pendingGardenSavePrefix = 'secret-faeries.pending-garden-save.v1:';
const pendingGardenSaveEvent = 'secret-faeries:pending-garden-save';

export interface PendingGardenSaveOptions {
  draftBaseRevisionId?: string | null;
  draftUpdatedAtIso?: string | null;
  kind?: PendingGardenSaveKind;
}

export type PendingGardenSaveKind = 'draft' | 'sharedOperations';

export function queuePendingGardenSave(
  garden: Garden,
  options: PendingGardenSaveOptions = {},
) {
  writeJsonStorageValue(getPendingGardenSaveKey(garden.userId), {
    conflictDetectedAtIso: null,
    draftBaseRevisionId: options.draftBaseRevisionId ?? null,
    draftUpdatedAtIso: options.draftUpdatedAtIso ?? null,
    garden,
    gardenUpdatedAtIso: garden.updatedAtIso,
    kind: options.kind ?? 'draft',
    publishedRevisionId: null,
    queuedAtIso: new Date().toISOString(),
    schemaVersion: CURRENT_GARDEN_SCHEMA_VERSION,
  } satisfies PendingGardenSave);
  dispatchPendingGardenSaveEvent();
}

export function readPendingGardenSave(userId: string): Garden | null {
  const stored = readJsonStorageValue<PendingGardenSave>(
    getPendingGardenSaveKey(userId),
  );

  if (!stored?.garden) {
    return null;
  }

  try {
    return parseGarden(userId, stored.garden);
  } catch {
    clearPendingGardenSave(userId);
    return null;
  }
}

export function clearPendingGardenSave(userId: string) {
  removeStorageValue(getPendingGardenSaveKey(userId));
  dispatchPendingGardenSaveEvent();
}

export interface PendingGardenSaveMetadata {
  conflictDetectedAtIso: string | null;
  draftBaseRevisionId: string | null;
  draftUpdatedAtIso: string | null;
  gardenUpdatedAtIso: string | null;
  publishedRevisionId: string | null;
  queuedAtIso: string;
  schemaVersion: number;
  kind: PendingGardenSaveKind;
  userId: string;
}

export function readPendingGardenSaveMetadata(
  userId: string,
): PendingGardenSaveMetadata | null {
  const stored = readJsonStorageValue<PendingGardenSave>(
    getPendingGardenSaveKey(userId),
  );

  if (!stored?.queuedAtIso) {
    return null;
  }

  return {
    conflictDetectedAtIso:
      typeof stored.conflictDetectedAtIso === 'string'
        ? stored.conflictDetectedAtIso
        : null,
    draftBaseRevisionId:
      typeof stored.draftBaseRevisionId === 'string'
        ? stored.draftBaseRevisionId
        : null,
    draftUpdatedAtIso:
      typeof stored.draftUpdatedAtIso === 'string'
        ? stored.draftUpdatedAtIso
        : null,
    gardenUpdatedAtIso: stored.gardenUpdatedAtIso ?? null,
    kind: stored.kind === 'sharedOperations' ? 'sharedOperations' : 'draft',
    publishedRevisionId:
      typeof stored.publishedRevisionId === 'string'
        ? stored.publishedRevisionId
        : null,
    queuedAtIso: stored.queuedAtIso,
    schemaVersion:
      typeof stored.schemaVersion === 'number'
        ? stored.schemaVersion
        : CURRENT_GARDEN_SCHEMA_VERSION,
    userId,
  };
}

export function markPendingGardenSaveConflict(
  userId: string,
  publishedRevisionId: string,
) {
  const stored = readJsonStorageValue<PendingGardenSave>(
    getPendingGardenSaveKey(userId),
  );

  if (!stored?.garden) {
    return;
  }

  writeJsonStorageValue(getPendingGardenSaveKey(userId), {
    ...stored,
    conflictDetectedAtIso: new Date().toISOString(),
    publishedRevisionId,
  } satisfies PendingGardenSave);
  dispatchPendingGardenSaveEvent();
}

export function getPendingGardenSaveUserIds() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    return Array.from({ length: window.localStorage.length }, (_, index) =>
      window.localStorage.key(index),
    )
      .filter((key): key is string => Boolean(key))
      .filter((key) => key.startsWith(pendingGardenSavePrefix))
      .map((key) =>
        decodeURIComponent(key.slice(pendingGardenSavePrefix.length)),
      );
  } catch {
    return [];
  }
}

function getPendingGardenSaveKey(userId: string) {
  return `${pendingGardenSavePrefix}${encodeURIComponent(userId)}`;
}

function dispatchPendingGardenSaveEvent() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(pendingGardenSaveEvent));
  }
}

export function subscribeToPendingGardenSaves(callback: () => void) {
  if (typeof window === 'undefined') {
    return () => undefined;
  }

  window.addEventListener(pendingGardenSaveEvent, callback);
  window.addEventListener('storage', callback);
  window.addEventListener('online', callback);

  return () => {
    window.removeEventListener(pendingGardenSaveEvent, callback);
    window.removeEventListener('storage', callback);
    window.removeEventListener('online', callback);
  };
}
