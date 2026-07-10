import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  type Firestore,
} from 'firebase/firestore';

import type { CommitOutcome, UserProfile } from '../domain';
import type { WorkspaceSubscription } from './GardenRepository';
import type { UserProfileRepository } from './UserProfileRepository';
import { assertValidUserProfile } from './profileValidation';

export class FirebaseUserProfileRepository implements UserProfileRepository {
  constructor(
    private readonly db: Firestore,
    _isOnline: () => boolean = () => navigator.onLine,
    private readonly now: () => Date = () => new Date(),
  ) {
    void _isOnline;
  }

  async getProfile(userId: string) {
    const snapshot = await getDoc(this.ref(userId));
    if (!snapshot.exists()) throw new Error('User profile is missing.');
    const profile = snapshot.data() as UserProfile;
    assertValidUserProfile(profile);
    assertProfileOwner(profile, userId);
    return profile;
  }

  async saveProfile(profile: UserProfile): Promise<CommitOutcome> {
    assertValidUserProfile(profile);
    await setDoc(this.ref(profile.userId), profile, { merge: false });
    const nowIso = this.now().toISOString();
    return { committedAtIso: nowIso, status: 'committed' };
  }

  subscribe(
    userId: string,
    onChange: (profile: UserProfile) => void,
    onError: (error: Error) => void,
  ): WorkspaceSubscription {
    const unsubscribe = onSnapshot(
      this.ref(userId),
      (snapshot) => {
        if (!snapshot.exists())
          return onError(new Error('User profile is missing.'));
        try {
          const profile = snapshot.data() as UserProfile;
          assertValidUserProfile(profile);
          assertProfileOwner(profile, userId);
          onChange(profile);
        } catch (error) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
      },
      onError,
    );
    return { unsubscribe };
  }

  private ref(userId: string) {
    return doc(this.db, 'users', userId);
  }
}

function assertProfileOwner(profile: UserProfile, userId: string) {
  if (profile.userId !== userId)
    throw new Error('User profile owner mismatch.');
}
