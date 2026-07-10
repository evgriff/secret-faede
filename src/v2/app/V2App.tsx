import { lazy, Suspense, type ReactNode } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { AccessDeniedPage, SignInPage } from '../routes/auth';
import { GlobalErrorBoundary, NotFoundPage } from '../routes/system';
import { BootstrapScreen } from '../routes/system/RecoveryPages';
import { V2AuthProvider, useV2Auth } from './AuthProvider';
import { V2RuntimeProvider } from './RuntimeProvider';
import type { V2Services } from './services';
import { V2ServicesProvider, useV2Services } from './V2ServicesContext';
import { V2WorkspaceProvider } from './WorkspaceProvider';
import { WorkspaceShell } from './WorkspaceShell';
import { getPostSignInRoute, readLastAppRoute } from './sessionResume';

const PlanPage = lazy(() =>
  import('../routes/plan').then((module) => ({ default: module.PlanPage })),
);
const TodayRoute = lazy(() =>
  import('./TodayRoute').then((module) => ({ default: module.TodayRoute })),
);
const FeedRoute = lazy(() =>
  import('./FeedRoute').then((module) => ({ default: module.FeedRoute })),
);
const SettingsRoute = lazy(() =>
  import('./SettingsRoute').then((module) => ({
    default: module.SettingsRoute,
  })),
);

export function V2App({ services }: { services: V2Services }) {
  return (
    <V2ServicesProvider services={services}>
      <V2AuthProvider services={services}>
        <BrowserRouter>
          <V2RuntimeProvider>
            <AppBoundary>
              <AppRoutes />
            </AppBoundary>
          </V2RuntimeProvider>
        </BrowserRouter>
      </V2AuthProvider>
    </V2ServicesProvider>
  );
}

function AppBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  const services = useV2Services();
  return (
    <GlobalErrorBoundary
      onError={(error, info) =>
        services.telemetryService.captureError(error, {
          context: 'v2_react_error_boundary',
          ...(info.componentStack
            ? { componentStack: info.componentStack }
            : {}),
        })
      }
      resetKeys={[location.pathname, location.search]}
      returnHref="/app/plan"
    >
      {children}
    </GlobalErrorBoundary>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<RootRoute />} path="/" />
      <Route element={<SignInRoute />} path="/sign-in" />
      <Route
        element={<Navigate replace to="/sign-in" />}
        path="/auth/complete"
      />
      <Route element={<DeniedRoute />} path="/access-denied" />
      <Route element={<ProtectedWorkspace />} path="/app">
        <Route element={<Navigate replace to="/app/plan" />} index />
        <Route
          element={
            <LazyPage>
              <PlanPage />
            </LazyPage>
          }
          path="plan"
        />
        <Route
          element={
            <LazyPage>
              <TodayRoute />
            </LazyPage>
          }
          path="today"
        />
        <Route
          element={
            <LazyPage>
              <FeedRoute />
            </LazyPage>
          }
          path="feed"
        />
        <Route
          element={
            <LazyPage>
              <SettingsRoute />
            </LazyPage>
          }
          path="settings"
        />
        <Route element={<Navigate replace to="/app/plan" />} path="garden" />
        <Route element={<Navigate replace to="/app/today" />} path="tasks" />
        <Route element={<Navigate replace to="/app/feed" />} path="journal" />
        <Route element={<Navigate replace to="/app/feed" />} path="log" />
        <Route element={<NotFoundPage returnHref="/app/plan" />} path="*" />
      </Route>
      <Route element={<NotFoundPage />} path="*" />
    </Routes>
  );
}

function ProtectedWorkspace() {
  const auth = useV2Auth();
  const services = useV2Services();
  const location = useLocation();
  if (auth.status === 'loading') return <BootstrapScreen status="loading" />;
  if (auth.status === 'denied') return <Navigate replace to="/access-denied" />;
  if (auth.status === 'configError') return <Navigate replace to="/sign-in" />;
  if (!auth.user) {
    return (
      <Navigate
        replace
        state={{ returnTo: `${location.pathname}${location.search}` }}
        to="/sign-in"
      />
    );
  }
  return (
    <V2WorkspaceProvider services={services}>
      <WorkspaceShell />
    </V2WorkspaceProvider>
  );
}

function RootRoute() {
  const auth = useV2Auth();
  if (auth.status === 'loading') return <BootstrapScreen status="loading" />;
  if (auth.status === 'denied') return <Navigate replace to="/access-denied" />;
  if (auth.status === 'configError') return <Navigate replace to="/sign-in" />;
  if (!auth.user) return <Navigate replace to="/sign-in" />;
  return <Navigate replace to={readLastAppRoute()} />;
}

function SignInRoute() {
  const auth = useV2Auth();
  const services = useV2Services();
  const location = useLocation();
  if (auth.status === 'authenticated') {
    return <Navigate replace to={getPostSignInRoute(location.state)} />;
  }
  if (auth.status === 'denied') return <Navigate replace to="/access-denied" />;
  return (
    <SignInPage
      configurationError={
        (services.environment.runtimeMode === 'mock'
          ? services.environment.allowlistError
          : null) ||
        (auth.status === 'configError'
          ? 'The two-account mock access list is not configured.'
          : null)
      }
      getErrorMessage={(error) =>
        error instanceof Error ? error.message : 'The sign-in request failed.'
      }
      isEmailAllowed={(email) =>
        services.environment.runtimeMode === 'firebase' ||
        services.environment.allowedEmails.includes(email)
      }
      onPasswordReset={auth.resetPassword}
      onSignIn={auth.signIn}
      runtimeNotice={services.environment.fallbackReason}
      sessionStatus={auth.status === 'loading' ? 'checking' : 'ready'}
    />
  );
}

function DeniedRoute() {
  const auth = useV2Auth();
  const navigate = useNavigate();
  if (auth.status === 'loading') return <BootstrapScreen status="loading" />;
  if (auth.status === 'authenticated') {
    return <Navigate replace to={readLastAppRoute()} />;
  }
  if (auth.status === 'configError') return <Navigate replace to="/sign-in" />;
  return (
    <AccessDeniedPage
      attemptedEmail={auth.deniedEmail}
      onReturnToSignIn={async () => {
        await auth.signOut();
        void navigate('/sign-in', { replace: true });
      }}
    />
  );
}

function LazyPage({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<BootstrapScreen status="loading" />}>
      {children}
    </Suspense>
  );
}
