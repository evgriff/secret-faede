import { Navigate } from 'react-router-dom';

import { useAuth } from '../../features/auth/auth-context';
import { routePaths } from '../../shared/lib/routes';
import { LoadingState } from '../../shared/ui/LoadingState';

export function RootRedirect() {
  const { state } = useAuth();

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

  return <Navigate replace to={routePaths.garden} />;
}
