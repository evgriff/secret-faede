import { Navigate, Outlet } from 'react-router-dom';

import { useServices } from '../providers';
import { useAuth } from '../../features/auth/auth-context';
import { routePaths } from '../../shared/lib/routes';
import { AppFrame } from '../../shared/ui/AppFrame';

interface ProtectedLayoutProps {
  frame?: boolean;
}

export function ProtectedLayout({ frame = false }: ProtectedLayoutProps) {
  const { environment } = useServices();
  const { signOut, state } = useAuth();

  if (state.status === 'loading') {
    return <div className="pageShell pageCard">Loading your session...</div>;
  }

  if (state.accessStatus === 'denied') {
    return <Navigate replace to={routePaths.accessDenied} />;
  }

  if (!state.user) {
    return <Navigate replace to={routePaths.signIn} />;
  }

  if (!frame) {
    return <Outlet />;
  }

  return (
    <AppFrame environment={environment} onSignOut={signOut} user={state.user}>
      <Outlet />
    </AppFrame>
  );
}
