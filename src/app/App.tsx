import { RouterProvider } from 'react-router-dom';

import { ErrorBoundary } from '../shared/ui/ErrorBoundary';
import { appRouter } from './router';
import { useServices } from './providers';

export function App() {
  const { telemetryService } = useServices();

  return (
    <ErrorBoundary
      onError={(error, errorInfo) =>
        telemetryService.captureError(error, {
          context: 'react_error_boundary',
          ...(errorInfo.componentStack
            ? { componentStack: errorInfo.componentStack }
            : {}),
        })
      }
    >
      <RouterProvider router={appRouter} />
    </ErrorBoundary>
  );
}
