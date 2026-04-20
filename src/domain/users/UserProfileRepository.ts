import type { UserProfile } from '../gardens/GardenRepository';

export interface UserProfileRepository {
  getUserProfile(uid: string, email: string): Promise<UserProfile | null>;
  saveUserProfile(profile: UserProfile): Promise<void>;
}
