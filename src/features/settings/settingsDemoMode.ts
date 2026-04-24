import {
  createDefaultGarden,
  type Garden,
  type GardenRepository,
  type UserProfile,
} from '../../domain/gardens/GardenRepository';
import {
  createSampleGarden,
  createSampleUserProfile,
} from '../../domain/gardens/sampleGarden';
import type { UserProfileRepository } from '../../domain/users/UserProfileRepository';
import {
  clearDemoModeBackup,
  clearDemoModeSession,
  hasDemoModeSession,
  readDemoModeBackup,
  writeDemoModeBackup,
  writeDemoModeSession,
} from '../demo/demoModeStorage';

export type DemoModeStatus = 'idle' | 'loading' | 'loaded' | 'reset' | 'exited';

export interface SettingsDemoState {
  canExit: boolean;
  error: string | null;
  isActive: boolean;
  isBusy: boolean;
  message: string | null;
  status: DemoModeStatus;
}

const sampleGardenName = 'Sample Kitchen Garden';

export function readSettingsDemoState(
  uid: string | null | undefined,
  overrides: Partial<SettingsDemoState> = {},
): SettingsDemoState {
  return {
    canExit: uid ? Boolean(readDemoModeBackup(uid)) : false,
    error: null,
    isActive: uid ? hasDemoModeSession(uid) : false,
    isBusy: false,
    message: null,
    status: 'idle',
    ...overrides,
  };
}

export async function loadSettingsDemoGarden({
  email,
  gardenRepository,
  profileRepository,
  savedGarden,
  savedProfile,
  status,
  uid,
}: {
  email: string;
  gardenRepository: GardenRepository;
  profileRepository: UserProfileRepository;
  savedGarden: Garden | null;
  savedProfile: UserProfile;
  status: 'loaded' | 'reset';
  uid: string;
}) {
  const garden = savedGarden ?? createDefaultGarden(uid);
  const existingBackup = readDemoModeBackup(uid);

  if (
    !existingBackup &&
    !hasDemoModeSession(uid) &&
    savedGarden?.name !== sampleGardenName
  ) {
    writeDemoModeBackup(uid, {
      garden,
      profile: savedProfile,
      savedAtIso: new Date().toISOString(),
      sourceGardenName: garden.name,
    });
  }

  const demoGarden = createSampleGarden(uid);
  const demoProfile = createSampleUserProfile(uid, email);

  await Promise.all([
    gardenRepository.saveGarden(demoGarden),
    profileRepository.saveUserProfile(demoProfile),
  ]);
  writeDemoModeSession(uid);
  notifyDemoModeChanged();

  return {
    garden: demoGarden,
    message:
      status === 'reset' ? 'Sample garden reset.' : 'Sample garden ready.',
    profile: demoProfile,
  };
}

export async function exitSettingsDemoGarden({
  email,
  gardenRepository,
  profileRepository,
  uid,
}: {
  email: string;
  gardenRepository: GardenRepository;
  profileRepository: UserProfileRepository;
  uid: string;
}) {
  const backup = readDemoModeBackup(uid);

  if (!backup) {
    throw new Error(
      'No saved garden is available in this browser. Open the sample from a saved garden first.',
    );
  }

  const garden: Garden = {
    ...backup.garden,
    id: uid,
    userId: uid,
  };
  const profile: UserProfile = {
    ...backup.profile,
    email,
    uid,
    updatedAtIso: new Date().toISOString(),
  };

  await Promise.all([
    gardenRepository.saveGarden(garden),
    profileRepository.saveUserProfile(profile),
  ]);
  clearDemoModeBackup(uid);
  clearDemoModeSession(uid);
  notifyDemoModeChanged();

  return {
    garden,
    message: 'Saved garden restored.',
    profile,
  };
}

function notifyDemoModeChanged() {
  window.dispatchEvent(new Event('secret-faede:demo-mode-changed'));
}
