import { render } from '@testing-library/react';
import { RouterProvider } from 'react-router-dom';

import { AppProviders } from '../app/providers';
import { createTestRouter } from '../app/router';
import type { AppServices } from '../infrastructure/runtime/services';

export function renderRoute(initialEntry: string, services: AppServices) {
  const router = createTestRouter([initialEntry]);

  return render(
    <AppProviders services={services}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}
