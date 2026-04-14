import { Navigate, Outlet } from 'react-router-dom';

import { useServices } from '../providers';
import { useAuth } from '../../features/auth/auth-context';
import { routePaths } from '../../shared/lib/routes';
import { AppFrame } from '../../shared/ui/AppFrame';

export function ProtectedLayout() {
  const { environment } = useServices();
  const { signOut, state } = useAuth();

  if (state.status === 'loading') {
    return <div className="pageShell pageCard">Loading your session…</div>;
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
