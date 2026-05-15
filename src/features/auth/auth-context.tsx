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
  PasswordSignInOptions,
} from '../../domain/auth/AuthService';
import type { AuthState, AuthUser } from '../../domain/auth/types';
import { useServices } from '../../app/providers';
import { isEmailAllowed, normalizeEmail } from '../../shared/auth/allowlist';

interface AuthContextValue {
  clearAccessState(): void;
  sendPasswordReset(email: string): Promise<void>;
  service: AuthService;
  signInWithPassword(options: PasswordSignInOptions): Promise<AuthUser>;
  signOut(): Promise<void>;
  state: AuthState;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function hasRequiredFirebaseAccess(user: AuthUser): boolean {
  return (
    user.accessClaims?.gardenAccess === true &&
    user.accessClaims.secretFaeriesMember === true
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { authService, environment, telemetryService } = useServices();
  const [state, setState] = useState<AuthState>({
    accessStatus: 'unknown',
    deniedEmail: null,
    status: 'loading',
    user: null,
  });
  const autoSignOutInFlight = useRef(false);
  const trackedSignInUid = useRef<string | null>(null);

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

      if (
        normalizedUser &&
        environment.runtimeMode === 'firebase' &&
        !hasRequiredFirebaseAccess(normalizedUser)
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

      if (
        normalizedUser &&
        environment.runtimeMode === 'mock' &&
        environment.allowlistError
      ) {
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
        environment.runtimeMode === 'mock' &&
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
        if (trackedSignInUid.current !== normalizedUser.uid) {
          telemetryService.trackEvent('sign_in_complete', {
            provider: normalizedUser.provider,
            runtime_mode: environment.runtimeMode,
          });
          trackedSignInUid.current = normalizedUser.uid;
        }

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
  }, [
    authService,
    environment.allowedEmails,
    environment.allowlistError,
    environment.runtimeMode,
    telemetryService,
  ]);

  const value = useMemo<AuthContextValue>(
    () => ({
      clearAccessState: () => {
        setState((currentState) => ({
          ...currentState,
          accessStatus: currentState.user ? 'allowed' : 'unknown',
          deniedEmail: null,
        }));
      },
      sendPasswordReset: (email) => authService.sendPasswordReset(email),
      signInWithPassword: async (options) => {
        setState((currentState) => ({
          ...currentState,
          accessStatus: currentState.user ? 'allowed' : 'unknown',
          deniedEmail: null,
        }));

        return authService.signInWithPassword(options);
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
