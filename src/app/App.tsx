import { RouterProvider } from 'react-router-dom';

import { ErrorBoundary } from '../shared/ui/ErrorBoundary';
import { appRouter } from './router';

export function App() {
  return (
    <ErrorBoundary>
      <RouterProvider router={appRouter} />
    </ErrorBoundary>
  );
}
