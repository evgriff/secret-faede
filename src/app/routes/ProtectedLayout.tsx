import { Navigate, Outlet } from 'react-router-dom';

import { useServices } from '../providers';
import { useAuth } from '../../features/auth/auth-context';
import { routePaths } from '../../shared/lib/routes';
import { AppFrame } from '../../shared/ui/AppFrame';
import { LoadingState } from '../../shared/ui/LoadingState';

export function ProtectedLayout() {
  const { environment } = useServices();
  const { signOut, state } = useAuth();

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
    return <Navigate replace to={routePaths.signIn} />;
  }

  return (
    <AppFrame environment={environment} onSignOut={signOut} user={state.user}>
      <Outlet />
    </AppFrame>
  );
}
