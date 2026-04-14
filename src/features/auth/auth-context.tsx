import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type {
  AuthService,
  CompleteEmailLinkOptions,
  EmailSignInRequestResult,
} from '../../domain/auth/AuthService';
import type { AuthState } from '../../domain/auth/types';
import { useServices } from '../../app/providers';

interface AuthContextValue {
  completeEmailLinkSignIn(
    options: CompleteEmailLinkOptions,
  ): Promise<{ email: string; provider: 'firebase' | 'mock'; uid: string }>;
  requestEmailSignIn(email: string): Promise<EmailSignInRequestResult>;
  service: AuthService;
  signOut(): Promise<void>;
  state: AuthState;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { authService } = useServices();
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
  });

  useEffect(() => {
    return authService.subscribe((user) => {
      setState(
        user
          ? {
              status: 'authenticated',
              user,
            }
          : {
              status: 'unauthenticated',
              user: null,
            },
      );
    });
  }, [authService]);

  const value = useMemo<AuthContextValue>(
    () => ({
      completeEmailLinkSignIn: (options) =>
        authService.completeEmailLinkSignIn(options),
      requestEmailSignIn: (email) => authService.requestEmailSignIn(email),
      service: authService,
      signOut: () => authService.signOut(),
      state,
    }),
    [authService, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
