import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useServices } from '../providers';
import { useAuth } from '../../features/auth/auth-context';
import { rememberAppRoute } from '../../features/auth/sessionResume';
import { routePaths } from '../../shared/lib/routes';
import { AppFrame } from '../../shared/ui/AppFrame';
import { LoadingState } from '../../shared/ui/LoadingState';

export function ProtectedLayout() {
  const { environment } = useServices();
  const { signOut, state } = useAuth();
  const location = useLocation();
  const returnTo = `${location.pathname}${location.search}`;

  useEffect(() => {
    if (state.user) {
      rememberAppRoute(returnTo);
    }
  }, [returnTo, state.user]);

  if (state.status === 'loading') {
    return (
      <LoadingState
        message="Checking your sign-in state."
        title="Loading session"
      />
    );
  }

  if (state.accessStatus === 'denied') {
    return <Navigate replace to={routePaths.accessDenied} />;
  }

  if (!state.user) {
    return <Navigate replace state={{ returnTo }} to={routePaths.signIn} />;
  }

  return (
    <AppFrame environment={environment} onSignOut={signOut} user={state.user}>
      <Outlet />
    </AppFrame>
  );
}
