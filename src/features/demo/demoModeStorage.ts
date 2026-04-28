import type {
  Garden,
  UserProfile,
} from '../../domain/gardens/GardenRepository';
import {
  readStorageValue,
  readJsonStorageValue,
  removeStorageValue,
  writeJsonStorageValue,
  writeStorageValue,
} from '../../shared/lib/storage';

const sampleGardenName = 'Sample Kitchen Garden';

export interface DemoModeBackup {
  garden: Garden;
  profile: UserProfile;
  savedAtIso: string;
  sourceGardenName: string;
}

export function isSampleGarden(garden: Garden | null | undefined) {
  return Boolean(
    garden?.name === sampleGardenName &&
    garden.plot.widthFt === 20 &&
    garden.plot.depthFt === 16 &&
    garden.plantings.some((planting) => planting.id.startsWith('demo-')),
  );
}

export function readDemoModeBackup(uid: string): DemoModeBackup | null {
  const backup = readJsonStorageValue<DemoModeBackup>(getBackupKey(uid));

  return backup?.garden && backup.profile ? backup : null;
}

export function writeDemoModeBackup(uid: string, backup: DemoModeBackup): void {
  writeJsonStorageValue(getBackupKey(uid), backup);
}

export function clearDemoModeBackup(uid: string): void {
  removeStorageValue(getBackupKey(uid));
}

export function hasDemoModeSession(uid: string): boolean {
  return Boolean(readStorageValue(getSessionKey(uid)));
}

export function writeDemoModeSession(uid: string): void {
  writeStorageValue(getSessionKey(uid), '1');
}

export function clearDemoModeSession(uid: string): void {
  removeStorageValue(getSessionKey(uid));
}

function getBackupKey(uid: string) {
  return `secret-faeries.demo-backup.v1:${encodeURIComponent(uid)}`;
}

function getSessionKey(uid: string) {
  return `secret-faeries.demo-session.v1:${encodeURIComponent(uid)}`;
}
