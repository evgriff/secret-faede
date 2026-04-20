import {
  parseGarden,
  type Garden,
} from '../../../domain/gardens/GardenRepository';
import {
  readJsonStorageValue,
  removeStorageValue,
  writeJsonStorageValue,
} from '../../../shared/lib/storage';

interface PendingGardenSave {
  garden: unknown;
  queuedAtIso: string;
}

const pendingGardenSavePrefix = 'secret-faede.pending-garden-save.v1:';

export function queuePendingGardenSave(garden: Garden) {
  writeJsonStorageValue(getPendingGardenSaveKey(garden.userId), {
    garden,
    queuedAtIso: new Date().toISOString(),
  } satisfies PendingGardenSave);
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
