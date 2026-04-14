import {
  createBrowserRouter,
  createMemoryRouter,
  type RouteObject,
} from 'react-router-dom';

import { AuthCompletePage } from '../features/auth/pages/AuthCompletePage';
import { SignInPage } from '../features/auth/pages/SignInPage';
import { GardenHomePage } from '../features/gardens/pages/GardenHomePage';
import { GardenSelectionPage } from '../features/gardens/pages/GardenSelectionPage';
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
    element: <ProtectedLayout />,
    children: [
      {
        path: '/gardens',
        element: <GardenSelectionPage />,
      },
      {
        path: '/gardens/:gardenId',
        element: <GardenHomePage />,
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
