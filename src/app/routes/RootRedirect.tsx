import { Navigate } from 'react-router-dom';

import { useAuth } from '../../features/auth/auth-context';
import { routePaths } from '../../shared/lib/routes';

export function RootRedirect() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return <div className="pageShell pageCard">Loading...</div>;
  }

  if (state.accessStatus === 'denied') {
    return <Navigate replace to={routePaths.accessDenied} />;
  }

  if (!state.user) {
    return <Navigate replace to={routePaths.signIn} />;
  }

  return <Navigate replace to={routePaths.app} />;
}
