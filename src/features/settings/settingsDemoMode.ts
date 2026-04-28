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

const sampleGardenName = 'Sample Kitchen Garden';

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
      'No saved garden backup is available on this device. Open the sample from your garden first.',
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
    message: 'Returned to your garden.',
    profile,
  };
}

function notifyDemoModeChanged() {
  window.dispatchEvent(new Event('secret-faeries:demo-mode-changed'));
}
