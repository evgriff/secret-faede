import {
  createBrowserRouter,
  createMemoryRouter,
  type RouteObject,
} from 'react-router-dom';

import { AccessDeniedPage } from '../features/auth/pages/AccessDeniedPage';
import { AuthCompletePage } from '../features/auth/pages/AuthCompletePage';
import { SignInPage } from '../features/auth/pages/SignInPage';
import { GardenEditorScreen } from '../features/garden/GardenEditorScreen';
import { NotFoundPage } from './routes/NotFoundPage';
import { ProtectedLayout } from './routes/ProtectedLayout';
import { RootRedirect } from './routes/RootRedirect';

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
    element: <ProtectedLayout frame />,
    children: [
      {
        path: '/app',
        element: <GardenEditorScreen />,
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
