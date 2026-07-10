import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { rememberAppRoute } from './sessionResume';
import {
  AppShell,
  Button,
  ErrorState,
  RouteAnnouncement,
  SaveStatus,
  StatusBanner,
} from '../ui';
import { useV2Auth } from './AuthProvider';
import { useV2Runtime } from './RuntimeProvider';
import { ShellRouteLink } from './RouterLinks';
import { useV2Workspace } from './WorkspaceProvider';

const navigation = [
  { exact: true, href: '/app/plan', icon: '✦', label: 'Plan' },
  { exact: true, href: '/app/today', icon: '☀', label: 'Today' },
  { exact: true, href: '/app/feed', icon: '≋', label: 'Feed' },
  { exact: true, href: '/app/settings', icon: '⚙', label: 'Settings' },
] as const;

export function WorkspaceShell() {
  const auth = useV2Auth();
  const runtime = useV2Runtime();
  const workspace = useV2Workspace();
  const location = useLocation();
  const navigate = useNavigate();
  const route = routeDetails(location.pathname);
  const [isSigningOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  useEffect(() => {
    rememberAppRoute(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.scrollLeft = 0;
      main.scrollTop = 0;
    }
    window.scrollTo({ behavior: 'auto', left: 0, top: 0 });
  }, [location.pathname]);

  const banner =
    runtime.foregroundAlert || !runtime.isOnline || signOutError ? (
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {signOutError ? (
          <StatusBanner title="Sign-out failed" tone="error">
            {signOutError}
          </StatusBanner>
        ) : null}
        {!runtime.isOnline ? (
          <StatusBanner tone="warning">
            You are offline. A save may be accepted by this device before it
            reaches the shared workspace. Weather refreshes and photo uploads
            require a connection.
          </StatusBanner>
        ) : null}
        {runtime.foregroundAlert ? (
          <StatusBanner
            actions={
              <>
                <Button
                  onClick={() => {
                    const link = runtime.foregroundAlert?.link || '/app/today';
                    runtime.dismissForegroundAlert();
                    void navigate(link);
                  }}
                  variant="secondary"
                >
                  Open alert
                </Button>
                <Button
                  onClick={runtime.dismissForegroundAlert}
                  variant="quiet"
                >
                  Dismiss
                </Button>
              </>
            }
            live
            title={runtime.foregroundAlert.title}
            tone="info"
          >
            {runtime.foregroundAlert.body}
          </StatusBanner>
        ) : null}
      </div>
    ) : undefined;

  return (
    <AppShell
      activePath={location.pathname}
      {...(banner ? { banner } : {})}
      headerActions={
        <Button
          busyLabel="Signing out…"
          isBusy={isSigningOut}
          onClick={() => {
            if (isSigningOut) return;
            setSigningOut(true);
            setSignOutError(null);
            void auth
              .signOut()
              .catch(() => {
                setSignOutError(
                  'Your session is still open. Check your connection, then try again.',
                );
              })
              .finally(() => setSigningOut(false));
          }}
          variant="quiet"
        >
          Sign out
        </Button>
      }
      headerStatus={
        <SaveStatus
          {...(workspace.isDirty ? { message: 'Unsaved draft changes' } : {})}
          status={workspace.isDirty ? 'idle' : workspace.saveState}
        />
      }
      linkComponent={ShellRouteLink}
      navigation={navigation}
      {...(auth.user
        ? { userLabel: auth.user.displayName || auth.user.email }
        : {})}
    >
      <RouteAnnouncement
        focusTargetId="main-content"
        routeKey={`${location.pathname}${location.search}`}
        title={route.title}
      />
      {workspace.loadState === 'error' ? (
        <ErrorState
          detail={workspace.error?.message}
          onRetry={workspace.reload}
          title="The garden workspace could not be opened"
        />
      ) : (
        <Outlet />
      )}
    </AppShell>
  );
}

function routeDetails(pathname: string) {
  if (pathname.startsWith('/app/today')) return { title: 'Today' };
  if (pathname.startsWith('/app/feed')) return { title: 'Feed' };
  if (pathname.startsWith('/app/settings')) return { title: 'Settings' };
  return { title: 'Plan' };
}
