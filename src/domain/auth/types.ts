export interface AuthUser {
  displayName: string | null;
  email: string;
  provider: 'firebase' | 'mock';
  uid: string;
}

export type AuthAccessStatus =
  | 'allowed'
  | 'config-error'
  | 'denied'
  | 'unknown';

export interface AuthState {
  accessStatus: AuthAccessStatus;
  deniedEmail: string | null;
  status: 'authenticated' | 'loading' | 'unauthenticated';
  user: AuthUser | null;
}
