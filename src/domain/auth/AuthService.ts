import type { AuthUser } from './types';

export interface PasswordSignInOptions {
  email: string;
  password: string;
  rememberDevice: boolean;
}

export type AuthStateListener = (user: AuthUser | null) => void;

export interface AuthService {
  getCurrentUser(): AuthUser | null;
  sendPasswordReset(email: string): Promise<void>;
  signInWithPassword(options: PasswordSignInOptions): Promise<AuthUser>;
  signOut(): Promise<void>;
  subscribe(listener: AuthStateListener): () => void;
}
