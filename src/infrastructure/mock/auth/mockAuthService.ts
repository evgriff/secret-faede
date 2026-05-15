import type {
  AuthService,
  AuthStateListener,
  PasswordSignInOptions,
} from '../../../domain/auth/AuthService';
import type { AuthAccessClaims, AuthUser } from '../../../domain/auth/types';
import {
  readJsonStorageValue,
  removeStorageValue,
  writeJsonStorageValue,
} from '../../../shared/lib/storage';

const mockLocalSessionKey = 'secret-faeries.auth.mock.session';
const mockSessionSessionKey = 'secret-faeries.auth.mock.session-tab';
const mockPassword = 'password';
const defaultMockAccessClaims: AuthAccessClaims = {
  gardenAccess: true,
  secretFaeriesMember: true,
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createMockUser(
  email: string,
  accessClaims: AuthAccessClaims,
): AuthUser {
  const normalizedEmail = normalizeEmail(email);
  const safeId = normalizedEmail
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return {
    accessClaims,
    displayName: getDisplayName(normalizedEmail),
    email: normalizedEmail,
    provider: 'mock',
    uid: `mock-${safeId || 'gardener'}`,
  };
}

export class MockAuthService implements AuthService {
  private readonly accessClaims: AuthAccessClaims;
  private listeners = new Set<AuthStateListener>();

  constructor(accessClaims: AuthAccessClaims = defaultMockAccessClaims) {
    this.accessClaims = accessClaims;
  }

  getCurrentUser(): AuthUser | null {
    return withAccessClaims(
      readJsonStorageValue<AuthUser>(mockLocalSessionKey) ??
        readSessionUser(mockSessionSessionKey),
      this.accessClaims,
    );
  }

  async sendPasswordReset(email: string): Promise<void> {
    void normalizeEmail(email);
  }

  async signInWithPassword(options: PasswordSignInOptions): Promise<AuthUser> {
    const normalizedEmail = normalizeEmail(options.email);

    if (!normalizedEmail || !options.password) {
      throw new Error('Enter your email and password.');
    }

    if (options.password !== mockPassword) {
      throw new Error('The email or password is incorrect.');
    }

    const user = createMockUser(normalizedEmail, this.accessClaims);

    removeStorageValue(mockLocalSessionKey);
    removeSessionUser(mockSessionSessionKey);

    if (options.rememberDevice) {
      writeJsonStorageValue(mockLocalSessionKey, user);
    } else {
      writeSessionUser(mockSessionSessionKey, user);
    }

    this.emit(user);
    return user;
  }

  async signOut(): Promise<void> {
    removeStorageValue(mockLocalSessionKey);
    removeSessionUser(mockSessionSessionKey);
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

function getDisplayName(email: string) {
  if (email === 'primary.gardener@example.com') {
    return 'Primary Gardener';
  }

  if (email === 'partner.gardener@example.com') {
    return 'Partner Gardener';
  }

  return null;
}

function withAccessClaims(
  user: AuthUser | null,
  accessClaims: AuthAccessClaims,
): AuthUser | null {
  return user
    ? {
        ...user,
        accessClaims: user.accessClaims ?? accessClaims,
      }
    : null;
}

function readSessionUser(key: string) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const value = window.sessionStorage.getItem(key);

    return value ? (JSON.parse(value) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeSessionUser(key: string, user: AuthUser) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(user));
  } catch {
    return;
  }
}

function removeSessionUser(key: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.removeItem(key);
  } catch {
    return;
  }
}
