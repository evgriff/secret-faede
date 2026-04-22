import {
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';

import type {
  AuthService,
  AuthStateListener,
  PasswordSignInOptions,
} from '../../../domain/auth/AuthService';
import type { AuthUser } from '../../../domain/auth/types';
import type { AppEnvironment } from '../../../shared/config/env';
import { getFirebaseAuthClient } from '../app';
import { getFirebaseAuthErrorMessage } from './firebaseAuthErrors';

function mapFirebaseUser(
  user: {
    displayName: string | null;
    email: string | null;
    uid: string;
  } | null,
): AuthUser | null {
  if (!user?.email) {
    return null;
  }

  return {
    displayName: user.displayName,
    email: user.email,
    provider: 'firebase',
    uid: user.uid,
  };
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
    return mapFirebaseUser(this.authClient.currentUser);
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
      const user = mapFirebaseUser(result.user);

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
    return onAuthStateChanged(this.authClient, (user) => {
      listener(mapFirebaseUser(user));
    });
  }
}
