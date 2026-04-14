import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut,
} from 'firebase/auth';

import type {
  AuthService,
  AuthStateListener,
  CompleteEmailLinkOptions,
  EmailSignInRequestResult,
} from '../../../domain/auth/AuthService';
import type { AuthUser } from '../../../domain/auth/types';
import { routePaths } from '../../../shared/lib/routes';
import {
  readStorageValue,
  removeStorageValue,
  writeStorageValue,
} from '../../../shared/lib/storage';
import type { AppEnvironment } from '../../../shared/config/env';
import { getFirebaseAuthClient } from '../app';

const pendingEmailKey = 'secret-faede.auth.pending-email';

function mapFirebaseUser(
  user: { email: string | null; uid: string } | null,
): AuthUser | null {
  if (!user?.email) {
    return null;
  }

  return {
    email: user.email,
    provider: 'firebase',
    uid: user.uid,
  };
}

export class FirebaseAuthService implements AuthService {
  private readonly authClient;

  constructor(environment: AppEnvironment) {
    this.authClient = getFirebaseAuthClient(environment);
  }

  canHandleEmailLink(url: string): boolean {
    return isSignInWithEmailLink(this.authClient, url);
  }

  clearStoredEmail(): void {
    removeStorageValue(pendingEmailKey);
  }

  async completeEmailLinkSignIn(
    options: CompleteEmailLinkOptions,
  ): Promise<AuthUser> {
    const email = options.email ?? this.getStoredEmail();

    if (!email) {
      throw new Error('Email confirmation is required to complete sign-in.');
    }

    const result = await signInWithEmailLink(
      this.authClient,
      email,
      options.url,
    );
    this.clearStoredEmail();

    const user = mapFirebaseUser(result.user);

    if (!user) {
      throw new Error('Firebase auth returned an incomplete user record.');
    }

    return user;
  }

  getCurrentUser(): AuthUser | null {
    return mapFirebaseUser(this.authClient.currentUser);
  }

  getStoredEmail(): string | null {
    return readStorageValue(pendingEmailKey);
  }

  async requestEmailSignIn(email: string): Promise<EmailSignInRequestResult> {
    const actionCodeSettings = {
      handleCodeInApp: true,
      url: new URL(routePaths.authComplete, window.location.origin).toString(),
    };

    await sendSignInLinkToEmail(this.authClient, email, actionCodeSettings);
    this.setStoredEmail(email);

    return {
      delivery: 'email',
    };
  }

  setStoredEmail(email: string): void {
    writeStorageValue(pendingEmailKey, email.trim().toLowerCase());
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
