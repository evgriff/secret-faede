import { lazy, Suspense, type ReactElement } from 'react';
import {
  createBrowserRouter,
  createMemoryRouter,
  Navigate,
  type RouteObject,
} from 'react-router-dom';

import { AccessDeniedPage } from '../features/auth/pages/AccessDeniedPage';
import { SignInPage } from '../features/auth/pages/SignInPage';
import { routePaths } from '../shared/lib/routes';
import { LoadingState } from '../shared/ui/LoadingState';
import { NotFoundPage } from './routes/NotFoundPage';
import { ProtectedLayout } from './routes/ProtectedLayout';
import { RouteErrorPage } from './routes/RouteErrorPage';
import { RootRedirect } from './routes/RootRedirect';

const PlanPage = lazy(() =>
  import('../features/plan/PlanPage').then((module) => ({
    default: module.PlanPage,
  })),
);
const TodayPage = lazy(() =>
  import('../features/today/TodayPage').then((module) => ({
    default: module.TodayPage,
  })),
);
const FeedPage = lazy(() =>
  import('../features/log/LogPage').then((module) => ({
    default: module.LogPage,
  })),
);
const SettingsPage = lazy(() =>
  import('../features/settings/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
);

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <RootRedirect />,
  },
  {
    path: '/sign-in',
    element: <SignInPage />,
  },
  {
    path: '/auth/complete',
    element: <Navigate replace to={routePaths.signIn} />,
  },
  {
    path: '/access-denied',
    element: <AccessDeniedPage />,
  },
  {
    path: routePaths.app,
    element: <ProtectedLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        element: <Navigate replace to={routePaths.plan} />,
      },
      {
        path: 'plan',
        element: withWorkspaceSuspense(<PlanPage />),
      },
      {
        path: 'today',
        element: withWorkspaceSuspense(<TodayPage />),
      },
      {
        path: 'feed',
        element: withWorkspaceSuspense(<FeedPage />),
      },
      {
        path: 'settings',
        element: withWorkspaceSuspense(<SettingsPage />),
      },
      {
        path: 'garden',
        element: <Navigate replace to={routePaths.plan} />,
      },
      {
        path: 'tasks',
        element: <Navigate replace to={routePaths.today} />,
      },
      {
        path: 'journal',
        element: <Navigate replace to={routePaths.feed} />,
      },
      {
        path: 'log',
        element: <Navigate replace to={routePaths.feed} />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
];

export const appRouter = createBrowserRouter(appRoutes);

export function createTestRouter(initialEntries: string[] = ['/']) {
  return createMemoryRouter(appRoutes, { initialEntries });
}

function withWorkspaceSuspense(element: ReactElement) {
  return (
    <Suspense
      fallback={
        <LoadingState message="Loading workspace." title="Loading workspace" />
      }
    >
      {element}
    </Suspense>
  );
}
