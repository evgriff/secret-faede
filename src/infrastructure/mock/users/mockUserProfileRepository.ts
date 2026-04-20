import {
  parseUserProfile,
  type UserProfile,
} from '../../../domain/gardens/GardenRepository';
import type { UserProfileRepository } from '../../../domain/users/UserProfileRepository';
import {
  readJsonStorageValue,
  writeJsonStorageValue,
} from '../../../shared/lib/storage';

export class MockUserProfileRepository implements UserProfileRepository {
  async getUserProfile(
    uid: string,
    email: string,
  ): Promise<UserProfile | null> {
    const storedProfile = readJsonStorageValue<unknown>(
      getUserProfileStorageKey(uid),
    );

    return storedProfile ? parseUserProfile(uid, email, storedProfile) : null;
  }

  async saveUserProfile(profile: UserProfile): Promise<void> {
    writeJsonStorageValue(getUserProfileStorageKey(profile.uid), profile);
  }
}

function getUserProfileStorageKey(uid: string) {
  return `secret-faede.user-profile.v1:${encodeURIComponent(uid)}`;
}
