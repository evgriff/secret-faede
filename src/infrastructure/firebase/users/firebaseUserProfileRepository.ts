import {
  parseUserProfile,
  type UserProfile,
} from '../../../domain/gardens/GardenRepository';
import type { UserProfileRepository } from '../../../domain/users/UserProfileRepository';
import type { AppEnvironment } from '../../../shared/config/env';
import { getFirestoreClient } from '../app';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';

export class FirebaseUserProfileRepository implements UserProfileRepository {
  private readonly firestore: Firestore;

  constructor(environment: AppEnvironment) {
    this.firestore = getFirestoreClient(environment);
  }

  async getUserProfile(
    uid: string,
    email: string,
  ): Promise<UserProfile | null> {
    const snapshot = await getDoc(this.getUserDocument(uid));

    return snapshot.exists()
      ? parseUserProfile(uid, email, snapshot.data())
      : null;
  }

  async saveUserProfile(profile: UserProfile): Promise<void> {
    await setDoc(this.getUserDocument(profile.uid), {
      ...profile,
      updatedAt: serverTimestamp(),
      updatedAtIso: new Date().toISOString(),
    });
  }

  private getUserDocument(uid: string) {
    return doc(this.firestore, 'users', uid);
  }
}
