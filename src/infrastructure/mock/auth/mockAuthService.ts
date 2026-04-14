import type {
  AuthService,
  AuthStateListener,
  CompleteEmailLinkOptions,
  EmailSignInRequestResult,
} from '../../../domain/auth/AuthService';
import type { AuthUser } from '../../../domain/auth/types';
import { routePaths } from '../../../shared/lib/routes';
import {
  readJsonStorageValue,
  readStorageValue,
  removeStorageValue,
  writeJsonStorageValue,
  writeStorageValue,
} from '../../../shared/lib/storage';

const mockSessionKey = 'secret-faede.auth.mock.session';
const pendingEmailKey = 'secret-faede.auth.pending-email';
const pendingTokenKey = 'secret-faede.auth.mock.pending-token';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createMockUser(email: string): AuthUser {
  const normalizedEmail = normalizeEmail(email);
  const safeId = normalizedEmail
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    email: normalizedEmail,
    provider: 'mock',
    uid: `mock-${safeId || 'gardener'}`,
  };
}

export class MockAuthService implements AuthService {
  private listeners = new Set<AuthStateListener>();

  canHandleEmailLink(url: string): boolean {
    const parsedUrl = new URL(url);
    return parsedUrl.searchParams.has('mockSignInToken');
  }

  clearStoredEmail(): void {
    removeStorageValue(pendingEmailKey);
    removeStorageValue(pendingTokenKey);
  }

  async completeEmailLinkSignIn(
    options: CompleteEmailLinkOptions,
  ): Promise<AuthUser> {
    const parsedUrl = new URL(options.url);
    const token = parsedUrl.searchParams.get('mockSignInToken');
    const expectedToken = readStorageValue(pendingTokenKey);
    const email = normalizeEmail(options.email ?? this.getStoredEmail() ?? '');

    if (!token || !expectedToken || token !== expectedToken) {
      throw new Error(
        'This mock sign-in link is invalid or has already been used.',
      );
    }

    if (!email) {
      throw new Error('Email confirmation is required to complete sign-in.');
    }

    const user = createMockUser(email);
    writeJsonStorageValue(mockSessionKey, user);
    this.clearStoredEmail();
    this.emit(user);
    return user;
  }

  getCurrentUser(): AuthUser | null {
    return readJsonStorageValue<AuthUser>(mockSessionKey);
  }

  getStoredEmail(): string | null {
    return readStorageValue(pendingEmailKey);
  }

  async requestEmailSignIn(email: string): Promise<EmailSignInRequestResult> {
    const normalizedEmail = normalizeEmail(email);
    const token =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `mock-token-${Date.now()}`;

    this.setStoredEmail(normalizedEmail);
    writeStorageValue(pendingTokenKey, token);

    return {
      completionPath: `${routePaths.authComplete}?mockSignInToken=${token}`,
      delivery: 'mock-link',
    };
  }

  setStoredEmail(email: string): void {
    writeStorageValue(pendingEmailKey, normalizeEmail(email));
  }

  async signOut(): Promise<void> {
    removeStorageValue(mockSessionKey);
    this.emit(null);
  }

  subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getCurrentUser());

    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(user: AuthUser | null): void {
    for (const listener of this.listeners) {
      listener(user);
    }
  }
}
