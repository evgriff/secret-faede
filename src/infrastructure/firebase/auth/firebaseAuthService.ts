import {
  browserLocalPersistence,
  browserSessionPersistence,
  getIdTokenResult,
  onIdTokenChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';

import type {
  AuthService,
  AuthStateListener,
  PasswordSignInOptions,
} from '../../../domain/auth/AuthService';
import type { AuthAccessClaims, AuthUser } from '../../../domain/auth/types';
import type { AppEnvironment } from '../../../shared/config/env';
import { getFirebaseAuthClient } from '../app';
import { getFirebaseAuthErrorMessage } from './firebaseAuthErrors';

function createFirebaseUser(
  user: {
    displayName: string | null;
    email: string | null;
    uid: string;
  },
  accessClaims: AuthAccessClaims | null,
): AuthUser | null {
  if (!user?.email) {
    return null;
  }

  return {
    accessClaims,
    displayName: user.displayName,
    email: user.email,
    provider: 'firebase',
    uid: user.uid,
  };
}

function readAccessClaims(claims: Record<string, unknown>): AuthAccessClaims {
  return {
    gardenAccess: claims.gardenAccess === true,
    secretFaeriesMember: claims.secretFaeriesMember === true,
  };
}

async function mapFirebaseUser(
  user: User | null,
  options?: { forceRefresh?: boolean },
): Promise<AuthUser | null> {
  if (!user?.email) {
    return null;
  }

  const tokenResult = await getIdTokenResult(user, options?.forceRefresh);

  return createFirebaseUser(user, readAccessClaims(tokenResult.claims));
}

export class FirebaseAuthService implements AuthService {
  private readonly authClient;
  private persistenceReady: Promise<void>;

  constructor(environment: AppEnvironment) {
    this.authClient = getFirebaseAuthClient(environment);
    this.persistenceReady = setPersistence(
      this.authClient,
      browserLocalPersistence,
    ).catch(() => undefined);
  }

  getCurrentUser(): AuthUser | null {
    return this.authClient.currentUser
      ? createFirebaseUser(this.authClient.currentUser, null)
      : null;
  }

  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.authClient, email);
    } catch (error) {
      throw new Error(getFirebaseAuthErrorMessage(error));
    }
  }

  async signInWithPassword(options: PasswordSignInOptions): Promise<AuthUser> {
    const persistence = options.rememberDevice
      ? browserLocalPersistence
      : browserSessionPersistence;

    try {
      await this.persistenceReady;
      await setPersistence(this.authClient, persistence);
      this.persistenceReady = Promise.resolve();
      const result = await signInWithEmailAndPassword(
        this.authClient,
        options.email.trim().toLowerCase(),
        options.password,
      );
      const user = await mapFirebaseUser(result.user, { forceRefresh: true });

      if (!user) {
        throw new Error('Firebase auth returned an incomplete user record.');
      }

      return user;
    } catch (error) {
      throw new Error(getFirebaseAuthErrorMessage(error));
    }
  }

  async signOut(): Promise<void> {
    await signOut(this.authClient);
  }

  subscribe(listener: AuthStateListener): () => void {
    let sequence = 0;

    return onIdTokenChanged(this.authClient, (user) => {
      const currentSequence = (sequence += 1);

      void mapFirebaseUser(user)
        .then((mappedUser) => {
          if (currentSequence === sequence) {
            listener(mappedUser);
          }
        })
        .catch(() => {
          if (currentSequence === sequence) {
            listener(user ? createFirebaseUser(user, null) : null);
          }
        });
    });
  }
}
