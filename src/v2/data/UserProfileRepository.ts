import type { CommitOutcome, UserProfile } from '../domain';
import type { WorkspaceSubscription } from './GardenRepository';

export interface UserProfileRepository {
  getProfile(userId: string): Promise<UserProfile>;
  saveProfile(profile: UserProfile): Promise<CommitOutcome>;
  subscribe(
    userId: string,
    onChange: (profile: UserProfile) => void,
    onError: (error: Error) => void,
  ): WorkspaceSubscription;
}
