import type { AuthUser } from './types';

export interface EmailSignInRequestResult {
  completionPath?: string;
  delivery: 'email' | 'mock-link';
}

export interface CompleteEmailLinkOptions {
  email?: string;
  url: string;
}

export type AuthStateListener = (user: AuthUser | null) => void;

export interface AuthService {
  canHandleEmailLink(url: string): boolean;
  clearStoredEmail(): void;
  completeEmailLinkSignIn(options: CompleteEmailLinkOptions): Promise<AuthUser>;
  getCurrentUser(): AuthUser | null;
  getStoredEmail(): string | null;
  requestEmailSignIn(email: string): Promise<EmailSignInRequestResult>;
  setStoredEmail(email: string): void;
  signOut(): Promise<void>;
  subscribe(listener: AuthStateListener): () => void;
}
