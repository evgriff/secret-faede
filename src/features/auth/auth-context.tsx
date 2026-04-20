import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { isEmailAllowed, normalizeEmail } from '../../shared/auth/allowlist';

interface AuthContextValue {
  clearAccessState(): void;
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
  const { authService, environment } = useServices();
  const [state, setState] = useState<AuthState>({
    accessStatus: 'unknown',
    deniedEmail: null,
    status: 'loading',
    user: null,
  });
  const autoSignOutInFlight = useRef(false);

  useEffect(() => {
    let disposed = false;
    const unsubscribe = authService.subscribe((user) => {
      if (disposed) {
        return;
      }

      const normalizedUser = user
        ? {
            ...user,
            email: normalizeEmail(user.email),
          }
        : null;

      if (normalizedUser && environment.allowlistError) {
        setState({
          accessStatus: 'config-error',
          deniedEmail: null,
          status: 'unauthenticated',
          user: null,
        });

        if (!autoSignOutInFlight.current) {
          autoSignOutInFlight.current = true;
          void authService.signOut().finally(() => {
            autoSignOutInFlight.current = false;
          });
        }

        return;
      }

      if (
        normalizedUser &&
        !isEmailAllowed(environment.allowedEmails, normalizedUser.email)
      ) {
        setState({
          accessStatus: 'denied',
          deniedEmail: normalizedUser.email,
          status: 'unauthenticated',
          user: null,
        });

        if (!autoSignOutInFlight.current) {
          autoSignOutInFlight.current = true;
          void authService.signOut().finally(() => {
            autoSignOutInFlight.current = false;
          });
        }

        return;
      }

      if (normalizedUser) {
        setState({
          accessStatus: 'allowed',
          deniedEmail: null,
          status: 'authenticated',
          user: normalizedUser,
        });
        return;
      }

      setState((currentState) =>
        currentState.accessStatus === 'config-error' ||
        currentState.accessStatus === 'denied'
          ? {
              ...currentState,
              status: 'unauthenticated',
              user: null,
            }
          : {
              accessStatus: 'unknown',
              deniedEmail: null,
              status: 'unauthenticated',
              user: null,
            },
      );
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [authService, environment.allowedEmails, environment.allowlistError]);

  const value = useMemo<AuthContextValue>(
    () => ({
      clearAccessState: () => {
        setState((currentState) => ({
          ...currentState,
          accessStatus: currentState.user ? 'allowed' : 'unknown',
          deniedEmail: null,
        }));
      },
      completeEmailLinkSignIn: (options) =>
        authService.completeEmailLinkSignIn(options),
      requestEmailSignIn: async (email) => {
        setState((currentState) => ({
          ...currentState,
          accessStatus: currentState.user ? 'allowed' : 'unknown',
          deniedEmail: null,
        }));

        return authService.requestEmailSignIn(email);
      },
      service: authService,
      signOut: async () => {
        setState({
          accessStatus: 'unknown',
          deniedEmail: null,
          status: 'unauthenticated',
          user: null,
        });

        await authService.signOut();
      },
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
