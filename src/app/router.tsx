import { lazy, Suspense, type ReactElement } from 'react';
import {
  createBrowserRouter,
  createMemoryRouter,
  Navigate,
  type RouteObject,
} from 'react-router-dom';

import { AccessDeniedPage } from '../features/auth/pages/AccessDeniedPage';
import { AuthCompletePage } from '../features/auth/pages/AuthCompletePage';
import { SignInPage } from '../features/auth/pages/SignInPage';
import { routePaths } from '../shared/lib/routes';
import { LoadingState } from '../shared/ui/LoadingState';
import { NotFoundPage } from './routes/NotFoundPage';
import { ProtectedLayout } from './routes/ProtectedLayout';
import { RootRedirect } from './routes/RootRedirect';

const GardenEditorScreen = lazy(() =>
  import('../features/garden/GardenEditorScreen').then((module) => ({
    default: module.GardenEditorScreen,
  })),
);
const TasksPage = lazy(() =>
  import('../features/tasks/TasksPage').then((module) => ({
    default: module.TasksPage,
  })),
);
const JournalPage = lazy(() =>
  import('../features/journal/JournalPage').then((module) => ({
    default: module.JournalPage,
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
    element: <AuthCompletePage />,
  },
  {
    path: '/access-denied',
    element: <AccessDeniedPage />,
  },
  {
    path: routePaths.app,
    element: <ProtectedLayout />,
    children: [
      {
        index: true,
        element: <Navigate replace to={routePaths.garden} />,
      },
      {
        path: 'garden',
        element: withWorkspaceSuspense(<GardenEditorScreen />),
      },
      {
        path: 'tasks',
        element: withWorkspaceSuspense(<TasksPage />),
      },
      {
        path: 'journal',
        element: withWorkspaceSuspense(<JournalPage />),
      },
      {
        path: 'settings',
        element: withWorkspaceSuspense(<SettingsPage />),
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
