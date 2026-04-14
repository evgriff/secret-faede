import { Navigate } from 'react-router-dom';

import { useAuth } from '../../features/auth/auth-context';
import { useSelectedGarden } from '../../features/gardens/garden-context';
import { buildGardenPath, routePaths } from '../../shared/lib/routes';

export function RootRedirect() {
  const { state } = useAuth();
  const { selectedGardenId } = useSelectedGarden();

  if (state.status === 'loading') {
    return <div className="pageShell pageCard">Loading your garden shell…</div>;
  }

  if (!state.user) {
    return <Navigate replace to={routePaths.signIn} />;
  }

  if (selectedGardenId) {
    return <Navigate replace to={buildGardenPath(selectedGardenId)} />;
  }

  return <Navigate replace to={routePaths.gardens} />;
}
