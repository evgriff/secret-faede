import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { AuthUser } from '../../domain/auth/types';
import type { V2Services } from './services';

export type V2AuthStatus =
  | 'authenticated'
  | 'configError'
  | 'denied'
  | 'loading'
  | 'unauthenticated';

export interface V2AuthContextValue {
  deniedEmail: string | null;
  resetPassword(email: string): Promise<void>;
  signIn(input: {
    email: string;
    password: string;
    rememberDevice: boolean;
  }): Promise<void>;
  signOut(): Promise<void>;
  status: V2AuthStatus;
  user: AuthUser | null;
}

const AuthContext = createContext<V2AuthContextValue | null>(null);

interface AccessRejection {
  deniedEmail: string | null;
  status: Extract<V2AuthStatus, 'configError' | 'denied'>;
}

export function V2AuthProvider({
  children,
  services,
}: {
  children: ReactNode;
  services: V2Services;
}) {
  const [status, setStatus] = useState<V2AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [deniedEmail, setDeniedEmail] = useState<string | null>(null);
  const accessRejection = useRef<AccessRejection | null>(null);
  const automaticSignOutInFlight = useRef(false);

  const acceptUser = useCallback(
    (nextUser: AuthUser | null) => {
      if (!nextUser) {
        setUser(null);
        const rejection = accessRejection.current;
        if (rejection) {
          setDeniedEmail(rejection.deniedEmail);
          setStatus(rejection.status);
        } else {
          setDeniedEmail(null);
          setStatus('unauthenticated');
        }
        return;
      }
      const access = getAccessStatus(nextUser, services);
      if (access === 'allowed') {
        accessRejection.current = null;
        setDeniedEmail(null);
        setUser(nextUser);
        setStatus('authenticated');
        return;
      }
      const rejection: AccessRejection = {
        deniedEmail:
          access === 'denied' ? nextUser.email.trim().toLowerCase() : null,
        status: access,
      };
      accessRejection.current = rejection;
      setDeniedEmail(rejection.deniedEmail);
      setUser(null);
      setStatus(rejection.status);

      if (!automaticSignOutInFlight.current) {
        automaticSignOutInFlight.current = true;
        void services.authService
          .signOut()
          .catch((error) => {
            services.telemetryService.captureError(error, {
              context: 'v2_access_rejection_sign_out',
            });
          })
          .finally(() => {
            automaticSignOutInFlight.current = false;
          });
      }
    },
    [services],
  );

  useEffect(() => {
    setStatus('loading');
    return services.authService.subscribe((nextUser) => {
      acceptUser(nextUser);
    });
  }, [acceptUser, services.authService]);

  const signIn = useCallback(
    async (input: {
      email: string;
      password: string;
      rememberDevice: boolean;
    }) => {
      accessRejection.current = null;
      setDeniedEmail(null);
      await services.authService.signInWithPassword(input);
    },
    [services.authService],
  );

  const signOut = useCallback(async () => {
    const previousRejection = accessRejection.current;
    accessRejection.current = null;
    setDeniedEmail(null);
    try {
      await services.authService.signOut();
      setUser(null);
      setStatus('unauthenticated');
    } catch (error) {
      accessRejection.current = previousRejection;
      if (previousRejection) {
        setDeniedEmail(previousRejection.deniedEmail);
        setStatus(previousRejection.status);
      }
      throw error;
    }
  }, [services.authService]);

  const value = useMemo<V2AuthContextValue>(
    () => ({
      deniedEmail,
      resetPassword: (email) => services.authService.sendPasswordReset(email),
      signIn,
      signOut,
      status,
      user,
    }),
    [deniedEmail, services.authService, signIn, signOut, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useV2Auth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useV2Auth must be used inside V2AuthProvider.');
  return value;
}

function getAccessStatus(user: AuthUser, services: V2Services) {
  if (services.environment.runtimeMode === 'mock') {
    if (services.environment.allowlistError) return 'configError' as const;
    const normalized = user.email.trim().toLowerCase();
    return services.environment.allowedEmails.includes(normalized)
      ? ('allowed' as const)
      : ('denied' as const);
  }
  return user.accessClaims?.gardenAccess === true &&
    user.accessClaims.secretFaeriesMember === true
    ? ('allowed' as const)
    : ('denied' as const);
}
