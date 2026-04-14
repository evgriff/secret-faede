export interface AuthUser {
  email: string;
  provider: 'firebase' | 'mock';
  uid: string;
}

export interface AuthState {
  status: 'authenticated' | 'loading' | 'unauthenticated';
  user: AuthUser | null;
}
